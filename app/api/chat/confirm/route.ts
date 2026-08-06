import { NextResponse } from "next/server";
import { Plan } from "../../../../lib/types";
import { currentContext } from "../../../../lib/api";
import { saveStore } from "../../../../lib/store";
import { audit, createNurseUser, floorHasRoom, medicationTimes, normalizeName, nurseForTask } from "../../../../lib/domain";

function floorValue(value: unknown) {
  if (typeof value === "number" && value >= 1 && value <= 4) return value;
  const text = normalizeName(String(value || ""));
  if (/piso\s*1|medicina interna/.test(text)) return 1;
  if (/piso\s*2|pediatria/.test(text)) return 2;
  if (/piso\s*3|cirugia/.test(text)) return 3;
  if (/piso\s*4|urgencias|emergencias/.test(text)) return 4;
  return undefined;
}

export async function POST(req:Request){
  const c=await currentContext();if(!c)return NextResponse.json({error:"unauthorized"},{status:401});
  if(c.user.role!=="doctor")return NextResponse.json({error:"doctor_only"},{status:403});
  const body=await req.json();const parsed=Plan.safeParse(body.proposal);
  if(!parsed.success||parsed.data.type!=="proposal")return NextResponse.json({error:"invalid_proposal"},{status:400});
  const operations=parsed.data.operations as any[];
  if (!operations.length) return NextResponse.json({error:"empty_proposal"},{status:400});
  const nurseAccess:any[]=[];
  if(c.store.revision!==Number(body.revision))return NextResponse.json({error:"revision_conflict"},{status:409});
  const doctor=c.user;
  for(const op of operations){
    if(op.action==="update_floor"){const n=doctor.nurses.find(x=>x.id===op.nurseId);if(!n||n.floor!==op.from||n.floor===op.to)return NextResponse.json({error:"stale_or_invalid_operation"},{status:409})}
    if(op.action==="create_nurse"){if(!op.name||!op.birthDate||op.name.trim().split(/\s+/).length<2)return NextResponse.json({error:"name_and_birth_date_required"},{status:400});if(doctor.nurses.some(n=>normalizeName(n.name)===normalizeName(op.name)))return NextResponse.json({error:"nurse_exists"},{status:409})}
    if(op.action==="create_patient"){if(!op.fullName||!op.birthDate||!op.reason||!op.allergies||!op.emergencyContact||!op.emergencyPhone||typeof op.floor!=="number")return NextResponse.json({error:"patient_required_data"},{status:400});if(typeof op.bed!=="number"){const floor=c.store.floors.find(f=>f.id===op.floor);const occupied=new Set(c.store.patients.filter(p=>p.status!=="discharged"&&p.floor===op.floor).map(p=>p.bed).filter(Boolean));op.bed=floor?Array.from({length:floor.beds},(_,i)=>i+1).find(bed=>!occupied.has(bed)):undefined;}if(typeof op.bed!=="number")return NextResponse.json({error:"bed_unavailable"},{status:409});if(c.store.patients.some(p=>normalizeName(p.fullName)===normalizeName(op.fullName)&&p.birthDate===op.birthDate))return NextResponse.json({error:"patient_exists"},{status:409});if(!floorHasRoom(c.store,op.floor,op.bed))return NextResponse.json({error:"bed_unavailable"},{status:409})}
    if(op.action==="assign_patient"||op.action==="move_patient"){
      const requestedName=op.fullName||op.name||op.patientName;
      const p=c.store.patients.find(x=>x.id===op.patientId)||(requestedName?c.store.patients.find(x=>normalizeName(x.fullName)===normalizeName(String(requestedName))):undefined);
      const destination=op.action==="assign_patient"?floorValue(op.floor):floorValue(op.to??op.floor);
      if(!p||typeof destination!=="number")return NextResponse.json({error:"patient_floor_required"},{status:400});
      op.patientId=p.id;
      if(op.action==="assign_patient")op.floor=destination;else op.to=destination;
      if(typeof op.bed==="number"&&!floorHasRoom(c.store,destination as 1|2|3|4,op.bed,p.id))return NextResponse.json({error:"bed_unavailable"},{status:409})
    }
    if(op.action==="discharge_patient"){if(!c.store.patients.some(p=>p.id===op.patientId))return NextResponse.json({error:"patient_not_found"},{status:404});if(!op.reason)return NextResponse.json({error:"discharge_reason_required"},{status:400});}
    if(op.action==="create_shift"){const n=doctor.nurses.find(x=>x.id===op.nurseId);if(!n||typeof op.floor!=="number"||!["day","night"].includes(op.kind))return NextResponse.json({error:"invalid_shift"},{status:400});if(c.store.shifts.some(s=>s.nurseId===op.nurseId&&s.status==="scheduled"))return NextResponse.json({error:"nurse_one_shift_only"},{status:409});if(c.store.shifts.some(s=>s.floor===op.floor&&s.kind===op.kind&&s.status==="scheduled"))return NextResponse.json({error:"floor_shift_conflict"},{status:409})}
    if(op.action==="create_medication"){if(!op.patientId||!op.name||(!Array.isArray(op.times)&&!op.frequency)||!medicationTimes(op.times,op.frequency).length)return NextResponse.json({error:"medication_data_required"},{status:400});const p=c.store.patients.find(p=>p.id===op.patientId&&p.status!=="discharged");if(!p)return NextResponse.json({error:"patient_not_found"},{status:404});if(typeof p.floor!=="number"&&!op.floor)return NextResponse.json({error:"patient_or_floor_required"},{status:400});}
    if(op.action==="create_task"){if(!op.patientId||!op.title||!op.scheduledAt)return NextResponse.json({error:"task_data_required"},{status:400});const p=c.store.patients.find(p=>p.id===op.patientId&&p.status!=="discharged");if(!p)return NextResponse.json({error:"patient_not_found"},{status:404});if(typeof p.floor!=="number"&&!op.floor)return NextResponse.json({error:"patient_or_floor_required"},{status:400});}
    if(op.action==="send_message"){
      const requested=Array.isArray(op.recipientIds)?op.recipientIds.map(String):[];
      const recipients=requested.map((id:string)=>doctor.nurses.find(n=>n.userId===id||n.id===id)?.userId).filter((id:string|undefined):id is string=>Boolean(id));
      const targetFloor=floorValue(op.floor);
      if(typeof targetFloor==="number") recipients.push(...doctor.nurses.filter(n=>n.floor===targetFloor&&n.userId).map(n=>n.userId as string));
      op.recipientIds=[...new Set(recipients)];
      if(!op.body||!op.recipientIds.length)return NextResponse.json({error:"message_data_required"},{status:400});
    }
  }
  for(const op of operations){
    if(op.action==="update_floor"){const n=doctor.nurses.find(x=>x.id===op.nurseId)!;n.floor=op.to;audit(c.store,doctor,"move","nurse",n.id,{from:op.from,to:op.to});continue}
    if(op.action==="create_nurse"){const result=createNurseUser(c.store,doctor,op.name,op.phone,op.birthDate);result.nurse.floor=op.floor;nurseAccess.push({name:result.nurse.name,email:result.nurse.email,password:result.password,message:result.message,floor:result.nurse.floor});audit(c.store,doctor,"assign","nurse",result.nurse.id,{floor:op.floor});continue}
    if(op.action==="create_patient"){const p={id:crypto.randomUUID(),fullName:op.fullName,birthDate:op.birthDate,reason:op.reason,allergies:op.allergies,emergencyContact:op.emergencyContact,emergencyPhone:op.emergencyPhone,floor:op.floor as any,bed:op.bed,admittedAt:new Date().toISOString(),status:"admitted" as const,notes:op.notes};c.store.patients.push(p);audit(c.store,doctor,"create","patient",p.id,{reason:op.reason,floor:op.floor,bed:op.bed});continue}
    if(op.action==="assign_patient"){const p=c.store.patients.find(x=>x.id===op.patientId)!;p.floor=op.floor;p.bed=typeof op.bed==="number"?op.bed:undefined;p.status="admitted";audit(c.store,doctor,"assign","patient",p.id,{floor:op.floor,bed:p.bed??null});continue}
    if(op.action==="move_patient"){const p=c.store.patients.find(x=>x.id===op.patientId)!;p.floor=op.to as any;p.bed=typeof op.bed==="number"?op.bed:undefined;audit(c.store,doctor,"move","patient",p.id,{from:op.from,to:op.to,bed:p.bed??null});continue}
    if(op.action==="discharge_patient"){const p=c.store.patients.find(x=>x.id===op.patientId)!;p.status="discharged";p.floor="unassigned";p.bed=undefined;p.dischargedAt=new Date().toISOString();p.dischargeReason=op.reason;c.store.medications.filter(m=>m.patientId===p.id&&m.status==="active").forEach(m=>m.status="cancelled");c.store.tasks.filter(t=>t.patientId===p.id&&["pending","in_progress"].includes(t.status)).forEach(t=>t.status="skipped");audit(c.store,doctor,"discharge","patient",p.id,{reason:op.reason});continue}
    if(op.action==="create_shift"){const shift={id:crypto.randomUUID(),nurseId:op.nurseId,floor:op.floor,date:"fixed",kind:op.kind,startsAt:op.kind==="day"?"05:00":"17:00",endsAt:op.kind==="day"?"17:00":"05:00",status:"scheduled" as const};c.store.shifts.push(shift);const n=doctor.nurses.find(x=>x.id===op.nurseId)!;n.shifts=[...(n.shifts||[]),shift.id];audit(c.store,doctor,"create","shift",shift.id);continue}
    if(op.action==="create_medication"){const patient=c.store.patients.find(p=>p.id===op.patientId)!;const floor=(op.floor||patient.floor) as 1|2|3|4;const times=medicationTimes(op.times,op.frequency);const startDate=op.startDate||new Date().toISOString().slice(0,10);const m={id:crypto.randomUUID(),patientId:op.patientId,name:op.name,dose:op.dose,times,frequency:op.frequency?String(op.frequency):undefined,startDate,endDate:op.endDate,floor,nurseId:op.nurseId||nurseForTask(c.store,doctor,floor,startDate+"T"+times[0]+":00"),status:"active" as const,notes:op.notes};c.store.medications.push(m);for(const time of times){const scheduledAt=m.startDate+"T"+time+":00";c.store.tasks.push({id:crypto.randomUUID(),patientId:op.patientId,medicationId:m.id,title:"Administrar "+m.name+(m.dose?" ("+m.dose+")":""),scheduledAt,nurseId:nurseForTask(c.store,doctor,m.floor,scheduledAt),floor:m.floor,status:"pending"})}audit(c.store,doctor,"create","medication",m.id,{frequency:m.frequency});continue}
    if(op.action==="create_task"){const patient=c.store.patients.find(p=>p.id===op.patientId)!;const floor=(op.floor||patient.floor) as 1|2|3|4;const raw=String(op.scheduledAt);const scheduledAt=/^\d{2}:\d{2}$/.test(raw)?`${new Date().toISOString().slice(0,10)}T${raw}:00`:raw;const task={id:crypto.randomUUID(),patientId:op.patientId,title:op.title,scheduledAt,nurseId:nurseForTask(c.store,doctor,floor,scheduledAt,op.nurseId),floor,status:"pending" as const,notes:op.notes};c.store.tasks.push(task);audit(c.store,doctor,"create","task",task.id,{patientId:op.patientId,title:op.title,scheduledAt});continue}
    if(op.action==="send_message"){const recipientIds=op.recipientIds as string[];const threadId=[doctor.id,...recipientIds].sort().join(":");const message={id:crypto.randomUUID(),threadId,senderId:doctor.id,senderName:doctor.name,senderRole:"doctor" as const,recipientIds,body:String(op.body),createdAt:new Date().toISOString(),readBy:[doctor.id]};c.store.messages.push(message);audit(c.store,doctor,"send","message",message.id,{recipientIds,body:message.body});continue}
  }
  c.store.revision++;await saveStore(c.store);return NextResponse.json({ok:true,doctor,revision:c.store.revision,nurseAccess});
}
