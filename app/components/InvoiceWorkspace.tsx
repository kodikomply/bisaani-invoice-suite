"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
type R = Record<string, any>;
type Item = {
  id: number;
  description: string;
  quantity: number;
  rate: number;
  per: string;
};
const currencyLabel = (currency: string) =>
  currency === "TZS" ? "TSH" : currency;
const units = [
  "Trip",
  "Container",
  "Shipment",
  "Vehicle",
  "Ton",
  "KG",
  "Unit",
  "Service",
  "Custom",
];
const fmt = (n: number, c: string) =>
  `${currencyLabel(c)} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: c === "USD" ? 2 : 0, maximumFractionDigits: c === "USD" ? 2 : 0 })}`;
function numberWords(n: number): string {
  const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ],
    t = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
  n = Math.floor(n);
  if (n < 20) return a[n];
  if (n < 100) return t[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  if (n < 1000)
    return (
      a[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + numberWords(n % 100) : "")
    );
  if (n < 1e6)
    return (
      numberWords(Math.floor(n / 1000)) +
      " Thousand" +
      (n % 1000 ? " " + numberWords(n % 1000) : "")
    );
  if (n < 1e9)
    return (
      numberWords(Math.floor(n / 1e6)) +
      " Million" +
      (n % 1e6 ? " " + numberWords(n % 1e6) : "")
    );
  return numberWords(Math.floor(n / 1e9)) + " Billion";
}
export function InvoiceWorkspace() {
  const [company, setCompany] = useState<R>({}),
    [banks, setBanks] = useState<R[]>([]),
    [customers, setCustomers] = useState<R[]>([]),
    [id, setId] = useState<number | null>(null),
    [bankId, setBankId] = useState(""),
    [customerId, setCustomerId] = useState(""),
    [customer, setCustomer] = useState(""),
    [address, setAddress] = useState(""),
    [physicalAddress, setPhysicalAddress] = useState(""),
    [country, setCountry] = useState("Tanzania"),
    [tin, setTin] = useState(""),
    [vrn, setVrn] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [invoiceNo, setInvoiceNo] = useState(
      `ST00/${String(new Date().getFullYear()).slice(-2)}/${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}`,
    ),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [due, setDue] = useState(""),
    [supplierRef, setSupplierRef] = useState(""),
    [otherRef, setOtherRef] = useState(""),
    [currency, setCurrency] = useState("TZS"),
    [fontScale, setFontScale] = useState(1.15),
    [signature, setSignature] = useState(true),
    [items, setItems] = useState<Item[]>([
      {
        id: Date.now(),
        description: "Logistics service",
        quantity: 1,
        rate: 0,
        per: "Trip",
      },
    ]),
    [status, setStatus] = useState("Not saved"),
    [saving, setSaving] = useState(false),
    [mobile, setMobile] = useState("edit");
  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/banks").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/invoices/draft").then((r) => (r.ok ? r.json() : null)),
    ]).then(([co, ba, cu, d]) => {
      setCompany(co || {});
      setBanks(Array.isArray(ba) ? ba : []);
      setCustomers(Array.isArray(cu) ? cu : []);
      const def = ba?.find((x: R) => x.is_default);
      if (def) setBankId(String(def.id));
      if (d) {
        setId(Number(d.id));
        setBankId(d.bank_account_id ? String(d.bank_account_id) : "");
        setCustomerId(d.customer_id ? String(d.customer_id) : "");
        setCustomer(d.customer_name || "");
        setAddress(d.postal_address || "");
        setPhysicalAddress(d.physical_address || "");
        setCountry(d.customer_country || "Tanzania");
        setTin(d.tin || "");
        setVrn(d.vrn || "");
        setEmail(d.customer_email || "");
        setPhone(d.customer_phone || "");
        setInvoiceNo(d.invoice_number);
        setDate(String(d.invoice_date).slice(0, 10));
        setDue(d.due_date ? String(d.due_date).slice(0, 10) : "");
        setSupplierRef(d.supplier_reference || "");
        setOtherRef(d.other_reference || "");
        setCurrency(d.currency);
        setFontScale(Number(d.font_scale || 1.15));
        setSignature(d.include_signature);
        if (d.items?.length) setItems(d.items);
        setStatus("Draft loaded");
      }
    });
  }, []);
  const subtotal = useMemo(
      () => items.reduce((s, i) => s + i.quantity * i.rate, 0),
      [items],
    ),
    total = subtotal,
    bank = banks.find((b) => String(b.id) === bankId);
  const chooseCustomer = (v: string) => {
    setCustomerId(v);
    const c = customers.find((x) => String(x.id) === v);
    if (c) {
      setCustomer(c.name);
      setAddress(c.postal_address || "");
      setPhysicalAddress(c.physical_address || "");
      setCountry(c.country || "Tanzania");
      setTin(c.tin || "");
      setVrn(c.vrn || "");
      setEmail(c.email || "");
      setPhone(c.phone || "");
    }
  };
  const payload = () => ({
    id,
    bankAccountId: bankId || null,
    customerId: customerId || null,
    customer,
    address,
    physicalAddress,
    customerCountry: country,
    tin,
    vrn,
    customerEmail: email,
    customerPhone: phone,
    invoiceNo,
    date,
    due,
    supplierReference: supplierRef,
    otherReference: otherRef,
    currency,
    fontScale,
    includeSig: signature,
    items,
    amountWords: `${currency === "TZS" ? "Tanzanian Shillings" : "USD"} ${numberWords(total)} Only.`,
  });
  const save = async (show = true) => {
    setSaving(true);
    const r = await fetch("/api/invoices/draft", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setStatus(d.error || "Save failed");
      return null;
    }
    setId(d.id);
    setStatus(show ? "Draft saved" : "Auto-saved");
    return d.id;
  };
  useEffect(() => {
    if (!customer || !invoiceNo) return;
    const x = setTimeout(() => save(false), 1600);
    return () => clearTimeout(x);
  }, [
    customer,
    address,
    tin,
    vrn,
    email,
    phone,
    invoiceNo,
    date,
    due,
    supplierRef,
    otherRef,
    currency,
    fontScale,
    bankId,
    items,
    signature,
  ]);
  const markPaid = async () => {
    const saved = await save();
    if (saved) {
      await fetch("/api/invoices", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: saved, status: "Paid" }),
      });
      setStatus("Marked paid");
    }
  };
  const duplicate = async () => {
    const saved = await save();
    if (saved) {
      const r = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: saved }),
      });
      const d = await r.json();
      if (r.ok) {
        setId(d.id);
        setInvoiceNo(d.invoice_number);
        setStatus("Duplicated as new draft");
      }
    }
  };
  const upd = (id: number, k: keyof Item, v: any) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [k]: v } : i)));
  return (
    <>
      <section className="actionbar">
        <div>
          <div>
            <b>{id ? "Edit Draft" : "New Invoice"}</b>
            <span>{saving ? "Saving…" : status}</span>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => save()}>Save Draft</button>
          <button onClick={() => setMobile("preview")}>Preview</button>
          <button
            className="primary"
            onClick={async () => {
              const saved = await save();
              if (saved) window.print();
            }}
          >
            Download PDF
          </button>
          <button onClick={() => window.print()}>Print</button>
          <button onClick={markPaid}>Mark as Paid</button>
          <button onClick={duplicate}>Duplicate</button>
        </div>
      </section>
      <div className="mobile-tabs">
        <button onClick={() => setMobile("edit")}>Edit</button>
        <button onClick={() => setMobile("preview")}>Preview</button>
      </div>
      <div className={`workspace ${mobile}`}>
        <section className="editor">
          <div className="card">
            <div className="card-title">
              <div>
                <span>▤</span>
                <h2>Invoice details</h2>
              </div>
            </div>
            <div className="form-grid three">
              <F l="Invoice number">
                <input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  required
                />
              </F>
              <F l="Invoice date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </F>
              <F l="Due date">
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </F>
              <F l="Supplier reference">
                <input
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                />
              </F>
              <F l="Other reference">
                <input
                  value={otherRef}
                  onChange={(e) => setOtherRef(e.target.value)}
                />
              </F>
              <F l="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="TZS">TSH</option>
                  <option value="USD">USD</option>
                </select>
              </F>
            </div>
          </div>
          <div className="card">
            <div className="card-title">
              <div>
                <span>♙</span>
                <h2>Bill to</h2>
              </div>
              <button className="text-btn" onClick={() => chooseCustomer("")}>
                ＋ New customer
              </button>
            </div>
            <F l="Select existing customer">
              <select
                value={customerId}
                onChange={(e) => chooseCustomer(e.target.value)}
              >
                <option value="">New customer</option>
                {customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </F>
            <div className="form-grid two">
              <F l="Customer/company name">
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </F>
              <F l="Postal address">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </F>
              <F l="Physical address">
                <input
                  value={physicalAddress}
                  onChange={(e) => setPhysicalAddress(e.target.value)}
                />
              </F>
              <F l="Country">
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </F>
              <F l="TIN">
                <input value={tin} onChange={(e) => setTin(e.target.value)} />
              </F>
              <F l="VRN">
                <input value={vrn} onChange={(e) => setVrn(e.target.value)} />
              </F>
              <F l="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </F>
              <F l="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </F>
            </div>
          </div>
          <div className="card">
            <div className="card-title">
              <div>
                <span>≡</span>
                <h2>Invoice items</h2>
              </div>
            </div>
            {items.map((i) => (
              <div className="item-row" key={i.id}>
                <textarea
                  value={i.description}
                  onChange={(e) => upd(i.id, "description", e.target.value)}
                />
                <input
                  type="number"
                  value={i.quantity}
                  onChange={(e) => upd(i.id, "quantity", +e.target.value)}
                />
                <input
                  type="number"
                  value={i.rate}
                  onChange={(e) => upd(i.id, "rate", +e.target.value)}
                />
                <select
                  value={i.per}
                  onChange={(e) => upd(i.id, "per", e.target.value)}
                >
                  {units.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <b>{fmt(i.quantity * i.rate, currency)}</b>
                <button
                  className="delete"
                  onClick={() => setItems(items.filter((x) => x.id !== i.id))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="add-item"
              onClick={() =>
                setItems([
                  ...items,
                  {
                    id: Date.now(),
                    description: "",
                    quantity: 1,
                    rate: 0,
                    per: "Service",
                  },
                ])
              }
            >
              ＋ Add line item
            </button>
            <div className="totals-editor">
              <span />
              <div>
                <span>
                  Subtotal<b>{fmt(subtotal, currency)}</b>
                </span>
                <strong>
                  Total<b>{fmt(total, currency)}</b>
                </strong>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="form-grid two">
              <F l="Payment account">
                <select
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                >
                  <option value="">No account selected</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} — {b.currency} {b.account_number}
                    </option>
                  ))}
                </select>
              </F>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={signature}
                  onChange={(e) => setSignature(e.target.checked)}
                />{" "}
                Include authorized signature
              </label>
            </div>
          </div>
        </section>
        <section className="preview-pane">
          <div className="preview-label">
            <span>LIVE A4 PREVIEW</span>
            <label className="font-control">
              Invoice font
              <select
                aria-label="Invoice font size"
                value={fontScale}
                onChange={(e) => setFontScale(Number(e.target.value))}
              >
                <option value="1">Standard</option>
                <option value="1.15">Large</option>
                <option value="1.25">Extra large</option>
              </select>
            </label>
          </div>
          <article
            className="invoice-sheet"
            style={{ "--invoice-scale": fontScale } as CSSProperties}
          >
            <div className="invoice-accent" />
            <header className="invoice-header">
              <div className="company">
                <img src="/bisaani-logo.png" alt="Bisaani" />
                <p>
                  {company.postal_address}, {company.physical_location},{" "}
                  {company.country}
                  <br />
                  TIN: {company.tin} · VRN: {company.vrn}
                  <br />
                  {company.email} · {company.phone}
                </p>
              </div>
              <div className="invoice-title">
                <h2>INVOICE</h2>
                <span>#{invoiceNo}</span>
              </div>
            </header>
            <div className="invoice-meta">
              <div>
                <label>BILL TO</label>
                <h3>{customer || "Customer"}</h3>
                <p>
                  {address}
                  <br />
                  {physicalAddress}
                  <br />
                  TIN: {tin} · VRN: {vrn}
                  <br />
                  {email} {phone}
                </p>
              </div>
              <div className="meta-grid">
                <span>
                  <label>Invoice date</label>
                  <b>{date}</b>
                </span>
                <span>
                  <label>Due date</label>
                  <b>{due || "—"}</b>
                </span>
                <span>
                  <label>Supplier reference</label>
                  <b>{supplierRef || "—"}</b>
                </span>
                <span>
                  <label>Other reference</label>
                  <b>{otherRef || "—"}</b>
                </span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Per</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.description}</td>
                    <td>{i.quantity}</td>
                    <td>{i.rate}</td>
                    <td>{i.per}</td>
                    <td>{fmt(i.quantity * i.rate, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="invoice-summary">
              <div />
              <div>
                <span>
                  Subtotal<b>{fmt(subtotal, currency)}</b>
                </span>
                <strong>
                  TOTAL<b>{fmt(total, currency)}</b>
                </strong>
              </div>
            </div>
            <div className="amount-words">
              <label>AMOUNT IN WORDS</label>
              <p>
                {currency === "TZS" ? "Tanzanian Shillings" : "USD"}{" "}
                {numberWords(total)} Only.
              </p>
            </div>
            <div className="bank-sign">
              <div className="bank">
                <label>BANK / PAYMENT DETAILS</label>
                {bank ? (
                  <>
                    <h4>{bank.bank_name}</h4>
                    <p>
                      <b>Account name</b> {bank.account_name}
                      <br />
                      <b>Account no.</b> {bank.account_number} {bank.currency}
                      <br />
                      <b>Branch</b> {bank.branch} · <b>SWIFT</b>{" "}
                      {bank.swift_code}
                    </p>
                  </>
                ) : (
                  <p>No payment account selected.</p>
                )}
              </div>
              <div className="sign">
                <p>For {company.name}</p>
                <div className="marks">
                  {signature && <span className="signature">Authorized</span>}
                </div>
                <b>Authorized Signatory</b>
              </div>
            </div>
            <footer>
              <label>DECLARATION</label>
              <p>{company.declaration}</p>
              <span>Thank you for your business.</span>
            </footer>
          </article>
        </section>
      </div>
    </>
  );
}
function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{l}</span>
      {children}
    </label>
  );
}
