import { NextResponse } from "next/server";
import { Plan } from "../../../../lib/types";
import { currentContext } from "../../../../lib/api";
import { saveStore } from "../../../../lib/store";
import { audit, createNurseUser, floorHasRoom, normalizeName, nurseForTask } from "../../../../lib/domain";

export async function POST(req:Request){
  const c=await currentContext();if(!c)return NextResponse.json({error:"unauthorized"},{status:401});
  if(c.user.role!=="doctor")return NextResponse.json({error:"doctor_only"},{status:403});
  const body=await req.json();const parsed=Plan.safeParse(body.proposal);
  if(!parsed.success||parsed.data.type!=="proposal")return NextResponse.json({error:"invalid_proposal"},{status:400});
  const operations=parsed.data.operations as any[];
  const nurseAccess:any[]=[];
  if(c.store.revision!==Number(body.revision))return NextResponse.json({error:"revision_conflict"},{status:409});
  const doctor=c.user;
  for(const op of operations){
    if(op.action==="update_floor"){const n=doctor.nurses.find(x=>x.id===op.nurseId);if(!n||n.floor!==op.from||n.floor===op.to)return NextResponse.json({error:"stale_or_invalid_operation"},{status:409})}
    if(op.action==="create_nurse"){if(!op.name||!op.birthDate||op.name.trim().split(/\s+/).length<2)return NextResponse.json({error:"name_and_birth_date_required"},{status:400});if(doctor.nurses.some(n=>normalizeName(n.name)===normalizeName(op.name)))return NextResponse.json({error:"nurse_exists"},{status:409})}
    if(op.action==="create_patient"){if(!op.fullName||!op.birthDate)return NextResponse.json({error:"patient_data_required"},{status:400});if(c.store.patients.some(p=>normalizeName(p.fullName)===normalizeName(op.fullName)&&p.birthDate===op.birthDate))return NextResponse.json({error:"patient_exists"},{status:409});if(op.floor&&op.bed&&!floorHasRoom(c.store,op.floor,op.bed))return NextResponse.json({error:"bed_unavailable"},{status:409})}
    if(op.action==="assign_patient"||op.action==="move_patient"){const p=c.store.patients.find(x=>x.id===op.patientId);const destination=op.action==="assign_patient"?op.floor:op.to;if(!p||!floorHasRoom(c.store,destination,op.bed||1))return NextResponse.json({error:"bed_unavailable"},{status:409})}
    if(op.action==="discharge_patient"&&!c.store.patients.some(p=>p.id===op.patientId))return NextResponse.json({error:"patient_not_found"},{status:404});
    if(op.action==="create_shift"){const n=doctor.nurses.find(x=>x.id===op.nurseId);if(!n||c.store.shifts.some(s=>s.nurseId===op.nurseId&&s.date===op.date&&s.kind===op.kind&&s.status==="scheduled"))return NextResponse.json({error:"shift_conflict"},{status:409})}
    if(op.action==="create_medication"){if(!op.patientId||!op.name||!Array.isArray(op.times)||!op.times.length)return NextResponse.json({error:"medication_data_required"},{status:400});const p=c.store.patients.find(p=>p.id===op.patientId&&p.status!=="discharged");if(!p)return NextResponse.json({error:"patient_not_found"},{status:404});if(typeof p.floor!=="number"&&!op.floor)return NextResponse.json({error:"patient_or_floor_required"},{status:400});}
  }
  for(const op of operations){
    if(op.action==="update_floor"){const n=doctor.nurses.find(x=>x.id===op.nurseId)!;n.floor=op.to;audit(c.store,doctor,"move","nurse",n.id,{from:op.from,to:op.to});continue}
    if(op.action==="create_nurse"){const result=createNurseUser(c.store,doctor,op.name,op.phone,op.birthDate);result.nurse.floor=op.floor;nurseAccess.push({name:result.nurse.name,email:result.nurse.email,password:result.password,message:result.message,floor:result.nurse.floor});audit(c.store,doctor,"assign","nurse",result.nurse.id,{floor:op.floor});continue}
    if(op.action==="create_patient"){const p={id:crypto.randomUUID(),fullName:op.fullName,birthDate:op.birthDate,reason:op.reason,allergies:op.allergies,emergencyContact:op.emergencyContact,emergencyPhone:op.emergencyPhone,floor:(op.floor||"unassigned") as any,bed:op.bed,admittedAt:new Date().toISOString(),status:"admitted" as const,notes:op.notes};c.store.patients.push(p);audit(c.store,doctor,"create","patient",p.id);continue}
    if(op.action==="assign_patient"){const p=c.store.patients.find(x=>x.id===op.patientId)!;p.floor=op.floor;p.bed=op.bed;p.status="admitted";audit(c.store,doctor,"assign","patient",p.id,{floor:op.floor,bed:op.bed});continue}
    if(op.action==="move_patient"){const p=c.store.patients.find(x=>x.id===op.patientId)!;p.floor=op.to;if(op.bed)p.bed=op.bed;audit(c.store,doctor,"move","patient",p.id,{from:op.from,to:op.to});continue}
    if(op.action==="discharge_patient"){const p=c.store.patients.find(x=>x.id===op.patientId)!;p.status="discharged";p.floor="unassigned";p.bed=undefined;audit(c.store,doctor,"discharge","patient",p.id);continue}
    if(op.action==="create_shift"){const shift={id:crypto.randomUUID(),nurseId:op.nurseId,floor:op.floor,date:"fixed",kind:op.kind,startsAt:op.kind==="day"?"05:00":"17:00",endsAt:op.kind==="day"?"17:00":"05:00",status:"scheduled" as const};c.store.shifts.push(shift);const n=doctor.nurses.find(x=>x.id===op.nurseId)!;n.shifts=[...(n.shifts||[]),shift.id];audit(c.store,doctor,"create","shift",shift.id);continue}
    if(op.action==="create_medication"){const patient=c.store.patients.find(p=>p.id===op.patientId)!;const floor=(op.floor||patient.floor) as 1|2|3|4;const startDate=op.startDate||new Date().toISOString().slice(0,10);const m={id:crypto.randomUUID(),patientId:op.patientId,name:op.name,dose:op.dose,times:op.times,startDate,endDate:op.endDate,floor,nurseId:op.nurseId||nurseForTask(c.store,doctor,floor,startDate+"T"+op.times[0]+":00"),status:"active" as const,notes:op.notes};c.store.medications.push(m);for(const time of op.times){const scheduledAt=m.startDate+"T"+time+":00";c.store.tasks.push({id:crypto.randomUUID(),patientId:op.patientId,medicationId:m.id,title:"Administrar "+m.name+(m.dose?" ("+m.dose+")":""),scheduledAt,nurseId:nurseForTask(c.store,doctor,m.floor,scheduledAt,m.nurseId),floor:m.floor,status:"pending"})}audit(c.store,doctor,"create","medication",m.id);continue}
  }
  c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true,doctor,revision:c.store.revision,nurseAccess});
}
