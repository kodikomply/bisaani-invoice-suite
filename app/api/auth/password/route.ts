import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "../../../../lib/db";
import { requireUser, SESSION_COOKIE } from "../../../../lib/auth";

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword || newPassword.length < 12) return Response.json({ error: "The new password must contain at least 12 characters" }, { status: 400 });
  const sql = db();
  const rows = await sql`SELECT password_hash FROM users WHERE id=${auth.user!.id}`;
  if (!rows.length || !(await compare(currentPassword, rows[0].password_hash))) return Response.json({ error: "Current password is incorrect" }, { status: 400 });
  await sql.begin(async tx => {
    await tx`UPDATE users SET password_hash=${await hash(newPassword, 12)}, updated_at=NOW() WHERE id=${auth.user!.id}`;
    await tx`DELETE FROM user_sessions WHERE user_id=${auth.user!.id}`;
    await tx`INSERT INTO audit_logs(user_id,action,entity_type,entity_id) VALUES(${auth.user!.id},'password.changed','user',${String(auth.user!.id)})`;
  });
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ changed: true, signInAgain: true });
}
