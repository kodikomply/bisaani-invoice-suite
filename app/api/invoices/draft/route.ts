import { db, ensureDatabase } from "../../../../lib/db";
import { requireUser } from "../../../../lib/auth";

export async function GET() {
  try {
    const auth = await requireUser(); if (auth.response) return auth.response;
    await ensureDatabase();
    const sql = db();
    const rows = await sql`SELECT i.*, c.name AS customer_name, c.postal_address, c.physical_address, c.tin, c.vrn
      FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
      WHERE i.status = 'Draft' ORDER BY i.updated_at DESC LIMIT 1`;
    if (!rows.length) return Response.json(null);
    const items = await sql`SELECT id, description, quantity::float8 AS quantity, rate::float8 AS rate,
      per_unit AS per, vat_rate::float8 AS vat FROM invoice_items WHERE invoice_id = ${rows[0].id} ORDER BY position`;
    return Response.json({ ...rows[0], items });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireUser(["admin", "manager", "staff"]); if (auth.response) return auth.response;
    const body = await request.json();
    await ensureDatabase();
    const sql = db();
    await sql.begin(async tx => {
      const existingCustomer = body.tin ? await tx`SELECT id FROM customers WHERE tin = ${body.tin} LIMIT 1` : [];
      const customerRows = existingCustomer.length
        ? await tx`UPDATE customers SET name=${body.customer}, postal_address=${body.address}, vrn=${body.vrn}, updated_at=NOW() WHERE id=${existingCustomer[0].id} RETURNING id`
        : await tx`INSERT INTO customers(name, postal_address, country, tin, vrn) VALUES(${body.customer}, ${body.address}, 'Tanzania', ${body.tin || null}, ${body.vrn || null}) RETURNING id`;
      const company = await tx`SELECT id FROM companies ORDER BY id LIMIT 1`;
      const saved = await tx`INSERT INTO invoices(company_id, customer_id, invoice_number, invoice_date, due_date, currency, vat_mode, subtotal, vat_total, total, amount_words, status, include_signature, include_stamp)
        VALUES(${company[0].id}, ${customerRows[0].id}, ${body.invoiceNo}, ${body.date}, ${body.due || null}, ${body.currency}, ${body.vatMode}, ${body.subtotal}, ${body.vat}, ${body.total}, ${body.amountWords}, 'Draft', ${body.includeSig}, ${body.includeStamp})
        ON CONFLICT(invoice_number) DO UPDATE SET customer_id=EXCLUDED.customer_id, invoice_date=EXCLUDED.invoice_date,
        due_date=EXCLUDED.due_date, currency=EXCLUDED.currency, vat_mode=EXCLUDED.vat_mode, subtotal=EXCLUDED.subtotal,
        vat_total=EXCLUDED.vat_total, total=EXCLUDED.total, amount_words=EXCLUDED.amount_words,
        include_signature=EXCLUDED.include_signature, include_stamp=EXCLUDED.include_stamp, updated_at=NOW() RETURNING id`;
      await tx`DELETE FROM invoice_items WHERE invoice_id=${saved[0].id}`;
      for (let position = 0; position < body.items.length; position++) {
        const item = body.items[position];
        await tx`INSERT INTO invoice_items(invoice_id, position, description, quantity, rate, per_unit, vat_rate, amount)
          VALUES(${saved[0].id}, ${position}, ${item.description}, ${item.quantity}, ${item.rate}, ${item.per}, ${item.vat || 0}, ${item.quantity * item.rate})`;
      }
    });
    return Response.json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save invoice";
    return Response.json({ error: message }, { status: message.includes("unique") ? 409 : 500 });
  }
}
