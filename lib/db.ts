import postgres from "postgres";

const globalDb = globalThis as unknown as {
  bisaaniSql?: ReturnType<typeof postgres>;
  bisaaniReady?: Promise<void>;
};
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  globalDb.bisaaniSql ??= postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return globalDb.bisaaniSql;
}

export function ensureDatabase() {
  globalDb.bisaaniReady ??= initialize();
  return globalDb.bisaaniReady;
}

async function initialize() {
  const sql = db();
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, postal_address TEXT, physical_location TEXT,
    country TEXT NOT NULL DEFAULT 'Tanzania', tin TEXT, vrn TEXT, email TEXT, phone TEXT,
    website TEXT, logo_url TEXT, signature_url TEXT, stamp_url TEXT, declaration TEXT,
    invoice_number_format TEXT NOT NULL DEFAULT 'ST00/YY/MMDD', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, postal_address TEXT, physical_address TEXT, country TEXT,
    tin TEXT UNIQUE, vrn TEXT, email TEXT, phone TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS bank_accounts (
    id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL, account_name TEXT NOT NULL, account_number TEXT NOT NULL, currency CHAR(3) NOT NULL,
    branch TEXT, swift_code TEXT, instructions TEXT, is_default BOOLEAN NOT NULL DEFAULT FALSE
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY, company_id BIGINT REFERENCES companies(id), customer_id BIGINT REFERENCES customers(id),
    bank_account_id BIGINT REFERENCES bank_accounts(id), invoice_number TEXT NOT NULL UNIQUE, invoice_date DATE NOT NULL,
    due_date DATE, supplier_reference TEXT, other_reference TEXT, currency CHAR(3) NOT NULL CHECK(currency IN ('USD','TZS')),
    vat_mode TEXT NOT NULL DEFAULT 'Exempt', subtotal NUMERIC(18,2) NOT NULL DEFAULT 0, vat_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    total NUMERIC(18,2) NOT NULL DEFAULT 0, amount_words TEXT, status TEXT NOT NULL DEFAULT 'Draft',
    include_signature BOOLEAN NOT NULL DEFAULT TRUE, include_stamp BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGSERIAL PRIMARY KEY, invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL, quantity NUMERIC(18,3) NOT NULL,
    rate NUMERIC(18,2) NOT NULL, per_unit TEXT NOT NULL, vat_rate NUMERIC(7,3) NOT NULL DEFAULT 0,
    amount NUMERIC(18,2) NOT NULL
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','manager','staff','viewer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE, last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id), action TEXT NOT NULL,
    entity_type TEXT, entity_id TEXT, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id)`,
  );
  await sql.unsafe(
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id)`,
  );
  await sql.unsafe(
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS custom_vat_rate NUMERIC(7,3) NOT NULL DEFAULT 0`,
  );
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_invoices_customer_date ON invoices(customer_id, invoice_date DESC)`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_invoices_status_date ON invoices(status, invoice_date DESC)`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_position ON invoice_items(invoice_id, position)`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON user_sessions(expires_at)`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_audit_user_date ON audit_logs(user_id, created_at DESC)`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_invoices_creator_status ON invoices(created_by,status,updated_at DESC)`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_login_attempts_email_date ON login_attempts(email,attempted_at DESC)`,
  );
  await sql`INSERT INTO companies (name, postal_address, physical_location, country, tin, vrn, email, phone, website, declaration)
    SELECT 'BISAANI LOGISTICS COMPANY LIMITED', 'P.O. Box 36004', 'Dar es Salaam', 'Tanzania', '152-975-732', '40-044748-E',
    'info@bisaanilogistics.co.tz', '+255 754 000 440', 'bisaanilogistics.co.tz',
    'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.'
    WHERE NOT EXISTS (SELECT 1 FROM companies)`;
}
