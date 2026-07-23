import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession,hashPassword } from "../../../../lib/auth";
import { getStore,saveStore } from "../../../../lib/store";
import { seedNurses, audit } from "../../../../lib/domain";
export async function POST(req:Request){
  const s=await readSession((await cookies()).get("rxlist_session")?.value||"");
  if(s?.role!=="admin")return NextResponse.json({error:"forbidden"},{status:403});
  const {name,email,password}=await req.json();
  if(!name||!email||!password)return NextResponse.json({error:"missing_fields"},{status:400});
  const st=await getStore();
  if(st.users.some(u=>u.email.toLowerCase()===String(email).toLowerCase()))return NextResponse.json({error:"email_exists"},{status:409});
  const doctor={id:crypto.randomUUID(),name:String(name).trim(),email:String(email).trim(),passwordHash:hashPassword(String(password)),role:"doctor" as const,nurses:seedNurses()};
  st.users.push(doctor);const admin=st.users.find(u=>u.id===s.id);if(admin)audit(st,admin,"create","doctor",doctor.id,{email:doctor.email});
  st.revision++;await saveStore(st);return NextResponse.json({ok:true});
}
