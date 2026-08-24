import { currentUser } from "../../../../lib/auth";
export async function GET() { try { const user = await currentUser(); return user ? Response.json(user) : Response.json({ error: "Not authenticated" }, { status: 401 }); } catch { return Response.json({ error: "Authentication unavailable" }, { status: 503 }); } }
