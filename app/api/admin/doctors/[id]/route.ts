import { NextResponse } from "next/server";
import { currentContext } from "../../../../../lib/api";
import { hashPassword } from "../../../../../lib/auth";
import { saveStore } from "../../../../../lib/store";
import { audit, temporaryPassword } from "../../../../../lib/domain";

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const c=await currentContext();if(!c||c.user.role!=="admin")return NextResponse.json({error:"forbidden"},{status:403});
  const {id}=await params;const doctor=c.store.users.find(u=>u.id===id&&u.role==="doctor");
  if(!doctor||doctor.role!=="doctor")return NextResponse.json({error:"not_found"},{status:404});
  const body=await req.json();const action=String(body.action||"edit");
  if(action==="reset_password"){
    const password=temporaryPassword();doctor.passwordHash=hashPassword(password);audit(c.store,c.user,"reset_password","doctor",doctor.id);c.store.revision++;await saveStore(c.store);
    return NextResponse.json({ok:true,password});
  }
  if(body.name)doctor.name=String(body.name).trim();
  if(body.email){
    const email=String(body.email).trim().toLowerCase();
    if(c.store.users.some(u=>u.id!==doctor.id&&u.email.toLowerCase()===email))return NextResponse.json({error:"email_exists"},{status:409});
    doctor.email=email;
  }
  if(body.password!==undefined){const password=String(body.password);if(!password)return NextResponse.json({error:"password_required"},{status:400});doctor.passwordHash=hashPassword(password)}
  audit(c.store,c.user,"update","doctor",doctor.id,{name:doctor.name,email:doctor.email});c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true,doctor:{id:doctor.id,name:doctor.name,email:doctor.email},revision:c.store.revision});
}

export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  const c=await currentContext();if(!c||c.user.role!=="admin")return NextResponse.json({error:"forbidden"},{status:403});
  const {id}=await params;const index=c.store.users.findIndex(u=>u.id===id&&u.role==="doctor");if(index<0)return NextResponse.json({error:"not_found"},{status:404});
  const doctor=c.store.users[index];if(doctor.role!=="doctor")return NextResponse.json({error:"not_found"},{status:404});
  c.store.users.splice(index,1);audit(c.store,c.user,"delete","doctor",doctor.id,{name:doctor.name});c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true,revision:c.store.revision});
}
