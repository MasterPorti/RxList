import { NextResponse } from "next/server";
import { signSession } from "../../../../lib/auth";
import { getStore } from "../../../../lib/store";

export async function GET(req: Request) {
  if (process.env.ALLOW_DEMO_LOGIN !== "true") {
    return NextResponse.json({ error: "demo_login_disabled" }, { status: 404 });
  }

  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const store = await getStore();
  const user = store.users.find(candidate => candidate.email.toLowerCase() === email);
  if (!user) return NextResponse.json({ error: "demo_user_not_found" }, { status: 404 });

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("rxlist_session", await signSession(user.id, user.role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 28800,
    path: "/",
  });
  return response;
}
