import { db, ensureDatabase } from "../../../../lib/db";
import { requireUser } from "../../../../lib/auth";
const validCurrency = (x: string) => ["USD", "TZS"].includes(x);
const number = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
export async function GET() {
  try {
    const a = await requireUser();
    if (a.response) return a.response;
    await ensureDatabase();
    const sql = db();
    const r =
      await sql`SELECT i.*,c.name customer_name,c.postal_address,c.physical_address,c.country customer_country,c.tin,c.vrn,c.email customer_email,c.phone customer_phone FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE i.status='Draft' AND i.created_by=${a.user!.id} ORDER BY i.updated_at DESC LIMIT 1`;
    if (!r.length) return Response.json(null);
    const items =
      await sql`SELECT id,description,quantity::float8 quantity,rate::float8 rate,per_unit per,vat_rate::float8 vat FROM invoice_items WHERE invoice_id=${r[0].id} ORDER BY position`;
    return Response.json({ ...r[0], items });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Database unavailable" },
      { status: 503 },
    );
  }
}
export async function PUT(req: Request) {
  try {
    const a = await requireUser(["admin", "manager", "staff"]);
    if (a.response) return a.response;
    const b = await req.json();
    if (
      !b.invoiceNo ||
      !b.date ||
      !b.customer ||
      !Array.isArray(b.items) ||
      !b.items.length ||
      !validCurrency(b.currency)
    )
      return Response.json(
        {
          error:
            "Invoice number, date, customer, currency and at least one item are required",
        },
        { status: 400 },
      );
    const items = b.items.map((i: any) => ({
      description: String(i.description || "").trim(),
      quantity: number(i.quantity),
      rate: number(i.rate),
      per: String(i.per || "Unit"),
    }));
    if (items.some((i: any) => !i.description || i.quantity < 0 || i.rate < 0))
      return Response.json(
        {
          error:
            "Each item requires a description and non-negative quantity/rate",
        },
        { status: 400 },
      );
    const subtotal = items.reduce(
      (s: number, i: any) => s + i.quantity * i.rate,
      0,
    );
    const vat = 0;
    const total = subtotal + vat;
    const fontScale = Math.max(1, Math.min(1.25, number(b.fontScale) || 1.15));
    await ensureDatabase();
    const sql = db();
    let invoiceId = 0;
    await sql.begin(async (tx) => {
      let customerId = b.customerId || null;
      if (customerId) {
        const own = await tx`SELECT id FROM customers WHERE id=${customerId}`;
        if (!own.length) customerId = null;
      }
      if (!customerId) {
        const existing = b.tin
          ? await tx`SELECT id FROM customers WHERE tin=${b.tin} LIMIT 1`
          : [];
        const c = existing.length
          ? await tx`UPDATE customers SET name=${b.customer},postal_address=${b.address || null},physical_address=${b.physicalAddress || null},country=${b.customerCountry || "Tanzania"},vrn=${b.vrn || null},email=${b.customerEmail || null},phone=${b.customerPhone || null},updated_at=NOW() WHERE id=${existing[0].id} RETURNING id`
          : await tx`INSERT INTO customers(name,postal_address,physical_address,country,tin,vrn,email,phone) VALUES(${b.customer},${b.address || null},${b.physicalAddress || null},${b.customerCountry || "Tanzania"},${b.tin || null},${b.vrn || null},${b.customerEmail || null},${b.customerPhone || null}) RETURNING id`;
        customerId = c[0].id;
      }
      const company = await tx`SELECT id FROM companies ORDER BY id LIMIT 1`;
      const existingDraft = b.id
        ? await tx`SELECT id FROM invoices WHERE id=${b.id} AND status='Draft' AND created_by=${a.user!.id}`
        : [];
      if (!existingDraft.length) {
        const duplicate =
          await tx`SELECT id FROM invoices WHERE invoice_number=${b.invoiceNo}`;
        if (duplicate.length) throw new Error("DUPLICATE_INVOICE_NUMBER");
      }
      const saved = existingDraft.length
        ? await tx`UPDATE invoices SET customer_id=${customerId},bank_account_id=${b.bankAccountId || null},invoice_number=${b.invoiceNo},invoice_date=${b.date},due_date=${b.due || null},supplier_reference=${b.supplierReference || null},other_reference=${b.otherReference || null},currency=${b.currency},vat_mode='None',custom_vat_rate=0,font_scale=${fontScale},subtotal=${subtotal},vat_total=0,total=${total},amount_words=${b.amountWords},include_signature=${!!b.includeSig},include_stamp=FALSE,updated_by=${a.user!.id},updated_at=NOW() WHERE id=${existingDraft[0].id} RETURNING id`
        : await tx`INSERT INTO invoices(company_id,customer_id,bank_account_id,invoice_number,invoice_date,due_date,supplier_reference,other_reference,currency,vat_mode,custom_vat_rate,font_scale,subtotal,vat_total,total,amount_words,status,include_signature,include_stamp,created_by,updated_by) VALUES(${company[0].id},${customerId},${b.bankAccountId || null},${b.invoiceNo},${b.date},${b.due || null},${b.supplierReference || null},${b.otherReference || null},${b.currency},'None',0,${fontScale},${subtotal},0,${total},${b.amountWords},'Draft',${!!b.includeSig},FALSE,${a.user!.id},${a.user!.id}) RETURNING id`;
      invoiceId = Number(saved[0].id);
      await tx`DELETE FROM invoice_items WHERE invoice_id=${invoiceId}`;
      for (let p = 0; p < items.length; p++) {
        const i = items[p];
        await tx`INSERT INTO invoice_items(invoice_id,position,description,quantity,rate,per_unit,vat_rate,amount) VALUES(${invoiceId},${p},${i.description},${i.quantity},${i.rate},${i.per},0,${i.quantity * i.rate})`;
      }
      await tx`INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES(${a.user!.id},'invoice.saved','invoice',${String(invoiceId)})`;
    });
    return Response.json({ saved: true, id: invoiceId, subtotal, vat, total });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Could not save invoice";
    return Response.json(
      {
        error:
          m === "DUPLICATE_INVOICE_NUMBER"
            ? "Invoice number already exists"
            : m,
      },
      { status: m === "DUPLICATE_INVOICE_NUMBER" ? 409 : 500 },
    );
  }
}
