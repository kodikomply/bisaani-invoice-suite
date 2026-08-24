import { hash } from "bcryptjs";
import { db } from "../../../lib/db";
import { requireUser } from "../../../lib/auth";

export async function GET() {
  const auth = await requireUser(["admin"]);
  if (auth.response) return auth.response;
  const rows =
    await db()`SELECT id, full_name, email, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC`;
  return Response.json(rows);
}
export async function POST(request: Request) {
  const auth = await requireUser(["admin"]);
  if (auth.response) return auth.response;
  const body = await request.json();
  if (
    !body.fullName ||
    !body.email ||
    !body.password ||
    body.password.length < 10
  )
    return Response.json(
      {
        error:
          "Name, email and a password of at least 10 characters are required",
      },
      { status: 400 },
    );
  try {
    const rows =
      await db()`INSERT INTO users(full_name,email,password_hash,role) VALUES(${body.fullName},${body.email.toLowerCase()},${await hash(body.password, 12)},${body.role || "staff"}) RETURNING id,full_name,email,role,is_active`;
    await db()`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(${auth.user!.id},'user.created','user',${String(rows[0].id)},${JSON.stringify({ email: rows[0].email, role: rows[0].role })})`;
    return Response.json(rows[0], { status: 201 });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message.includes("unique")
            ? "A user with that email already exists"
            : "Could not create user",
      },
      { status: 409 },
    );
  }
}
export async function PUT(request: Request) {
  const auth = await requireUser(["admin"]);
  if (auth.response) return auth.response;
  const b = await request.json();
  if (!["admin", "manager", "staff", "viewer"].includes(b.role))
    return Response.json({ error: "Invalid role" }, { status: 400 });
  if (Number(b.id) === auth.user!.id && b.is_active === false)
    return Response.json(
      { error: "You cannot disable your own account" },
      { status: 400 },
    );
  const sql = db();
  const r =
    await sql`UPDATE users SET full_name=${b.full_name},email=${String(b.email).toLowerCase()},role=${b.role},is_active=${!!b.is_active},updated_at=NOW() WHERE id=${b.id} RETURNING id,full_name,email,role,is_active`;
  if (b.password) {
    if (String(b.password).length < 12)
      return Response.json(
        { error: "Reset password must have at least 12 characters" },
        { status: 400 },
      );
    await sql`UPDATE users SET password_hash=${await hash(b.password, 12)} WHERE id=${b.id}`;
    await sql`DELETE FROM user_sessions WHERE user_id=${b.id}`;
  }
  await sql`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(${auth.user!.id},'user.updated','user',${String(b.id)},${JSON.stringify({ role: b.role, is_active: !!b.is_active })})`;
  return Response.json(r[0]);
}
