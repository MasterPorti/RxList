import { NextResponse } from "next/server";

function clearSession(response: NextResponse) {
  response.cookies.delete("rxlist_session");
  return response;
}

export async function POST() { return clearSession(NextResponse.json({ ok: true })); }

export async function GET(req: Request) {
  return clearSession(new NextResponse(null, { status: 303, headers: { Location: "/login" } }));
}
