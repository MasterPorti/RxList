import { NextResponse } from "next/server";
import { currentContext } from "../../../../lib/api";
import { hashPassword } from "../../../../lib/auth";
import { saveStore } from "../../../../lib/store";
export async function POST(req:Request){const c=await currentContext();if(!c)return NextResponse.json({error:"unauthorized"},{status:401});const b=await req.json();const password=String(b.password||"");if(!password)return NextResponse.json({error:"password_required"},{status:400});c.user.passwordHash=hashPassword(password);if(c.user.role==="nurse")c.user.mustChangePassword=false;c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true})}
