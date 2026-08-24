import { db, ensureDatabase } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  await ensureDatabase();
  const sql = db();
  const totals = await sql`
    SELECT currency,
      COALESCE(SUM(total), 0)::float8 AS total_invoiced,
      COALESCE(SUM(total) FILTER (WHERE status = 'Paid'), 0)::float8 AS paid,
      COALESCE(SUM(total) FILTER (WHERE status IN ('Sent', 'Pending')), 0)::float8 AS outstanding,
      COALESCE(SUM(total) FILTER (
        WHERE status = 'Overdue'
          OR (due_date < CURRENT_DATE AND status NOT IN ('Paid', 'Cancelled'))
      ), 0)::float8 AS overdue,
      COUNT(*)::int AS invoice_count
    FROM invoices
    GROUP BY currency
    ORDER BY currency
  `;
  const recent = await sql`
    SELECT i.id, i.invoice_number, i.total::float8 AS total, i.currency, i.status,
      c.name AS customer
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    ORDER BY i.updated_at DESC
    LIMIT 5
  `;
  const monthly = await sql`
    SELECT TO_CHAR(date_trunc('month', invoice_date), 'Mon') AS month_label,
      EXTRACT(YEAR FROM date_trunc('month', invoice_date))::int AS year,
      currency,
      COALESCE(SUM(total), 0)::float8 AS total
    FROM invoices
    WHERE invoice_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
    GROUP BY date_trunc('month', invoice_date), currency
    ORDER BY date_trunc('month', invoice_date), currency
  `;

  return Response.json({
    totals,
    recent,
    monthly: monthly.map((row) => ({ ...row, month: row.month_label })),
  });
}
