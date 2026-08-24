import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "../../../../lib/db";
import { SESSION_COOKIE } from "../../../../lib/auth";
export async function POST() { const jar = await cookies(); const token = jar.get(SESSION_COOKIE)?.value; if (token) { try { await db()`DELETE FROM user_sessions WHERE token_hash=${createHash("sha256").update(token).digest("hex")}`; } catch {} } jar.delete(SESSION_COOKIE); return Response.json({ signedOut: true }); }
