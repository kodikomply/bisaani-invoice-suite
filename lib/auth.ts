import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, ensureDatabase } from "./db";

export const SESSION_COOKIE = "bisaani_session";
export type SessionUser = {
  id: number;
  fullName: string;
  email: string;
  role: "admin" | "manager" | "staff" | "viewer";
};
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function seedInitialAdmin() {
  await ensureDatabase();
  const sql = db();
  const count = await sql`SELECT COUNT(*)::int AS count FROM users`;
  if (count[0].count > 0) return;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password || password.length < 10)
    throw new Error(
      "Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (minimum 10 characters)",
    );
  await sql`INSERT INTO users(full_name, email, password_hash, role) VALUES(${process.env.INITIAL_ADMIN_NAME || "System Administrator"}, ${email.toLowerCase()}, ${await hash(password, 12)}, 'admin')`;
}

export async function login(email: string, password: string) {
  await seedInitialAdmin();
  const sql = db();
  const normalizedEmail = email.toLowerCase().trim();
  const attempts =
    await sql`SELECT COUNT(*)::int AS count FROM login_attempts WHERE email=${normalizedEmail} AND attempted_at>NOW()-INTERVAL '15 minutes'`;
  if (attempts[0].count >= 5)
    throw new Error("Too many sign-in attempts. Try again in 15 minutes.");
  const users =
    await sql`SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email=${normalizedEmail} LIMIT 1`;
  if (
    !users.length ||
    !users[0].is_active ||
    !(await compare(password, users[0].password_hash))
  ) {
    await sql`INSERT INTO login_attempts(email) VALUES(${normalizedEmail})`;
    return null;
  }
  const token = randomBytes(32).toString("base64url");
  await sql.begin(async (tx) => {
    await tx`DELETE FROM user_sessions WHERE expires_at < NOW()`;
    await tx`INSERT INTO user_sessions(user_id, token_hash, expires_at) VALUES(${users[0].id}, ${tokenHash(token)}, NOW() + INTERVAL '7 days')`;
    await tx`UPDATE users SET last_login_at=NOW() WHERE id=${users[0].id}`;
    await tx`DELETE FROM login_attempts WHERE email=${normalizedEmail}`;
  });
  return token;
}

export async function currentUser(): Promise<SessionUser | null> {
  await ensureDatabase();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows =
    await db()`SELECT u.id, u.full_name, u.email, u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>NOW() AND u.is_active=TRUE LIMIT 1`;
  if (!rows.length) return null;
  return {
    id: Number(rows[0].id),
    fullName: rows[0].full_name,
    email: rows[0].email,
    role: rows[0].role,
  };
}

export async function requireUser(roles?: SessionUser["role"][]) {
  const user = await currentUser();
  if (!user)
    return {
      user: null,
      response: Response.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  if (roles && !roles.includes(user.role))
    return {
      user: null,
      response: Response.json(
        { error: "Administrator access required" },
        { status: 403 },
      ),
    };
  return { user, response: null };
}
