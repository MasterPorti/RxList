import { NextResponse } from "next/server";
import { currentContext } from "../../../../lib/api";
export async function GET(){
  const ctx=await currentContext();if(!ctx||ctx.user.role!=="doctor")return NextResponse.json({error:"unauthorized"},{status:401});
  const s=ctx.store;const patients=s.patients;
  return NextResponse.json({doctor:{id:ctx.user.id,name:ctx.user.name,email:ctx.user.email,nurses:ctx.user.nurses},nurses:ctx.user.nurses,floors:s.floors,patients,shifts:s.shifts,medications:s.medications,tasks:s.tasks,vitals:s.vitals,audit:s.audit.filter(a=>a.actorId===ctx.user.id||a.entity==="patient").slice(-50),revision:s.revision});
}
