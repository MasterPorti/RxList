import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readSession } from "../lib/auth";
export default async function Home(){const token=(await cookies()).get("rxlist_session")?.value;const session=token?await readSession(token):null;redirect(session?.role==="admin"?"/admin":session?.role==="doctor"?"/chat":session?.role==="nurse"?"/nurse":"/login")}
