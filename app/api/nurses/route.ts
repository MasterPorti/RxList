import { NextResponse } from "next/server";
import { currentContext } from "../../../lib/api";
import { saveStore } from "../../../lib/store";
import { createNurseUser } from "../../../lib/domain";
export async function POST(req:Request){
  const ctx=await currentContext();if(!ctx)return NextResponse.json({error:"unauthorized"},{status:401});
  if(ctx.user.role!=="admin"&&ctx.user.role!=="doctor")return NextResponse.json({error:"forbidden"},{status:403});
  const body=await req.json();const name=String(body.name||"").trim();const birthDate=String(body.birthDate||"");if(name.split(/\s+/).length<2||!birthDate)return NextResponse.json({error:"name_and_birth_date_required"},{status:400});
  let doctor=ctx.user;
  if(ctx.user.role==="admin"){doctor=ctx.store.users.find(x=>x.id===String(body.doctorId)&&x.role==="doctor") as typeof doctor;if(!doctor)return NextResponse.json({error:"doctor_required"},{status:400})}
  try{const created=createNurseUser(ctx.store,doctor,name,body.phone?String(body.phone):undefined,birthDate);if(body.floor){const floor=Number(body.floor);if(![1,2,3,4].includes(floor))return NextResponse.json({error:"invalid_floor"},{status:400});created.nurse.floor=floor as 1|2|3|4}ctx.store.revision++;await saveStore(ctx.store);return NextResponse.json({ok:true,...created})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"create_failed"},{status:409})}
}
