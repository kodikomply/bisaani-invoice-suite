import { db, ensureDatabase } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";

const statuses = ["Draft", "Sent", "Pending", "Paid", "Overdue", "Cancelled"];

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  await ensureDatabase();
  return Response.json(
    await db()`
    SELECT i.id, i.invoice_number, i.invoice_date, i.due_date,
      i.total::float8 AS total, i.currency, i.status, c.name AS customer
    FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
    ORDER BY i.invoice_date DESC, i.id DESC
  `,
  );
}

export async function PUT(req: Request) {
  const auth = await requireUser(["admin", "manager", "staff"]);
  if (auth.response) return auth.response;
  const body = await req.json();
  if (!statuses.includes(body.status))
    return Response.json({ error: "Invalid status" }, { status: 400 });
  const sql = db();
  const rows = await sql`
    UPDATE invoices SET status = ${body.status}, updated_by = ${auth.user!.id},
      created_by = CASE WHEN ${body.status} = 'Draft' THEN ${auth.user!.id} ELSE created_by END,
      updated_at = NOW()
    WHERE id = ${body.id} RETURNING *
  `;
  if (!rows.length)
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  await sql`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
    VALUES(${auth.user!.id},'status_changed','invoice',${body.id},${JSON.stringify({ status: body.status })}::jsonb)`;
  return Response.json(rows[0]);
}

export async function POST(req: Request) {
  const auth = await requireUser(["admin", "manager", "staff"]);
  if (auth.response) return auth.response;
  const body = await req.json();
  const sql = db();
  const source = await sql`SELECT * FROM invoices WHERE id = ${body.id}`;
  if (!source.length)
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  const invoiceNumber = `${source[0].invoice_number}-COPY-${Date.now().toString().slice(-6)}`;
  const rows = await sql`
    INSERT INTO invoices(company_id,customer_id,bank_account_id,invoice_number,invoice_date,due_date,
      supplier_reference,other_reference,currency,vat_mode,custom_vat_rate,font_scale,subtotal,vat_total,total,
      amount_words,declaration,status,include_signature,include_stamp,created_by,updated_by)
    SELECT company_id,customer_id,bank_account_id,${invoiceNumber},CURRENT_DATE,due_date,
      supplier_reference,other_reference,currency,vat_mode,custom_vat_rate,font_scale,subtotal,vat_total,total,
      amount_words,declaration,'Draft',include_signature,FALSE,${auth.user!.id},${auth.user!.id}
    FROM invoices WHERE id = ${body.id} RETURNING id
  `;
  await sql`
    INSERT INTO invoice_items(invoice_id,position,description,quantity,rate,per_unit,vat_rate,amount)
    SELECT ${rows[0].id},position,description,quantity,rate,per_unit,vat_rate,amount
    FROM invoice_items WHERE invoice_id = ${body.id}
  `;
  await sql`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
    VALUES(${auth.user!.id},'duplicated','invoice',${rows[0].id},${JSON.stringify({ source_id: body.id })}::jsonb)`;
  return Response.json(
    { id: rows[0].id, invoice_number: invoiceNumber },
    { status: 201 },
  );
}

export async function DELETE(req: Request) {
  const auth = await requireUser(["admin"]);
  if (auth.response) return auth.response;
  const id = new URL(req.url).searchParams.get("id");
  if (!id)
    return Response.json({ error: "Invoice id is required" }, { status: 400 });
  const sql = db();
  const rows =
    await sql`DELETE FROM invoices WHERE id = ${id} RETURNING invoice_number`;
  if (!rows.length)
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  await sql`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details)
    VALUES(${auth.user!.id},'deleted','invoice',${id},${JSON.stringify({ invoice_number: rows[0].invoice_number })}::jsonb)`;
  return Response.json({ deleted: true });
}
