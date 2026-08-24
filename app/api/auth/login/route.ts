import { cookies } from "next/headers";
import { login, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return Response.json({ error: "Email and password are required" }, { status: 400 });
    const token = await login(email, password);
    if (!token) return Response.json({ error: "Invalid email or password" }, { status: 401 });
    (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return Response.json({ authenticated: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Login failed" }, { status: 500 }); }
}
