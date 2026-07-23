import { NextResponse } from "next/server";
import { currentContext } from "../../../lib/api";
import { saveStore } from "../../../lib/store";
import { audit, floorHasRoom, normalizeName } from "../../../lib/domain";
export async function GET(){const c=await currentContext();if(!c)return NextResponse.json({error:"unauthorized"},{status:401});return NextResponse.json({patients:c.store.patients})}
export async function POST(req:Request){
  const c=await currentContext();if(!c||c.user.role!=="doctor")return NextResponse.json({error:"forbidden"},{status:403});const b=await req.json();const fullName=String(b.fullName||"").trim(),birthDate=String(b.birthDate||"");
  if(fullName.split(/\s+/).length<2||!birthDate)return NextResponse.json({error:"name_and_birth_date_required"},{status:400});
  if(c.store.patients.some(p=>normalizeName(p.fullName)===normalizeName(fullName)&&p.birthDate===birthDate))return NextResponse.json({error:"patient_exists"},{status:409});
  const floor=b.floor?Number(b.floor):"unassigned";const bed=b.bed?Number(b.bed):undefined;
  if(floor!=="unassigned"&&(![1,2,3,4].includes(floor)||bed===undefined||!floorHasRoom(c.store,floor as 1|2|3|4,bed)))return NextResponse.json({error:"bed_unavailable"},{status:409});
  const patient={id:crypto.randomUUID(),fullName,birthDate,reason:String(b.reason||""),allergies:String(b.allergies||""),emergencyContact:String(b.emergencyContact||""),emergencyPhone:String(b.emergencyPhone||""),floor:floor as 1|2|3|4|"unassigned",bed,admittedAt:new Date().toISOString(),status:"admitted" as const,notes:String(b.notes||"")};
  c.store.patients.push(patient);audit(c.store,c.user,"create","patient",patient.id,{fullName});c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true,patient,revision:c.store.revision});
}
