import { NextResponse } from "next/server";
import { currentContext } from "../../../lib/api";
import { saveStore } from "../../../lib/store";
import { audit, floorHasRoom, normalizeName } from "../../../lib/domain";
export async function GET(){const c=await currentContext();if(!c)return NextResponse.json({error:"unauthorized"},{status:401});if(c.user.role!=="nurse")return NextResponse.json({patients:c.store.patients});const nurseId=(c.user as Extract<typeof c.user,{role:"nurse"}>).nurseId;const owner=c.store.users.find(u=>u.role==="doctor"&&u.nurses.some(n=>n.id===nurseId));const profile=owner?.role==="doctor"?owner.nurses.find(n=>n.id===nurseId):undefined;return NextResponse.json({patients:c.store.patients.filter(p=>p.status!=="discharged"&&profile?.floor!==undefined&&p.floor===profile.floor)})}
export async function POST(req:Request){
  const c=await currentContext();if(!c||c.user.role!=="doctor")return NextResponse.json({error:"forbidden"},{status:403});const b=await req.json();const fullName=String(b.fullName||"").trim(),birthDate=String(b.birthDate||"");
  const reason=String(b.reason||"").trim(),allergies=String(b.allergies||"").trim(),emergencyContact=String(b.emergencyContact||"").trim(),emergencyPhone=String(b.emergencyPhone||"").trim();
  if(fullName.split(/\s+/).length<2||!birthDate||!reason||!allergies||!emergencyContact||!emergencyPhone)return NextResponse.json({error:"patient_required_data"},{status:400});
  if(c.store.patients.some(p=>normalizeName(p.fullName)===normalizeName(fullName)&&p.birthDate===birthDate))return NextResponse.json({error:"patient_exists"},{status:409});
  const floor=b.floor?Number(b.floor):undefined;let bed=b.bed?Number(b.bed):undefined;
  if(floor===undefined)return NextResponse.json({error:"patient_floor_required"},{status:400});
  if(![1,2,3,4].includes(floor))return NextResponse.json({error:"bed_unavailable"},{status:409});
  if(bed===undefined){const capacity=c.store.floors.find(item=>item.id===floor)?.beds||0;const occupied=new Set(c.store.patients.filter(patient=>patient.status!=="discharged"&&patient.floor===floor).map(patient=>patient.bed).filter(Boolean));bed=Array.from({length:capacity},(_,index)=>index+1).find(candidate=>!occupied.has(candidate));}
  if(bed===undefined||!floorHasRoom(c.store,floor as 1|2|3|4,bed))return NextResponse.json({error:"bed_unavailable"},{status:409});
  const patient={id:crypto.randomUUID(),fullName,birthDate,reason,allergies,emergencyContact,emergencyPhone,floor:floor as 1|2|3|4|"unassigned",bed,admittedAt:new Date().toISOString(),status:"admitted" as const,notes:String(b.notes||"")};
  c.store.patients.push(patient);audit(c.store,c.user,"create","patient",patient.id,{fullName});c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true,patient,revision:c.store.revision});
}
