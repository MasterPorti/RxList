import { hashPassword } from "./auth";
import type { Nurse, Store, User, FloorId } from "./types";

export function normalizeName(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
export function emailForName(name:string,used:string[]=[]){const parts=normalizeName(name).replace(/[^a-z0-9 ]/g,"").split(" ").filter(Boolean);const base=parts.length>1?`${parts[0]}.${parts[parts.length-1]}`:parts[0]||"enfermero";let number=1;let email="";do{number=Math.floor(Math.random()*100)+1;email=`${base}.${number}@rxlist.com`}while(used.some(x=>normalizeName(x)===normalizeName(email)));return email}
export function temporaryPassword(){return "RX-"+crypto.randomUUID().replace(/-/g,"").slice(0,10)+"!"}
export function nurseMessage(n:Nurse,password:string){return "RXList\nUsuario: "+n.email+"\nContraseña temporal: "+password+"\nEntra en /login y cambia tu contraseña."}
export function audit(st:Store,actor:User,action:string,entity:string,entityId:string|undefined,details?:Record<string,unknown>){st.audit.push({id:crypto.randomUUID(),actorId:actor.id,actorRole:actor.role,action,entity,entityId,details,at:new Date().toISOString()})}
export function findDoctor(st:Store,id:string){const u=st.users.find(x=>x.id===id);return u?.role==="doctor"?u:null}
export function nurseById(st:Store,id:string){for(const u of st.users)if(u.role==="doctor"){const n=u.nurses.find(x=>x.id===id);if(n)return {doctor:u,nurse:n}}return null}
export function floorHasRoom(st:Store,floor:FloorId,bed:number){const p=st.patients.find(x=>x.floor===floor&&x.bed===bed&&x.status!=="discharged");return !p && bed<=((st.floors.find(x=>x.id===floor)?.beds)||0)}
export function nurseForTask(st:Store,doctor:User,floor:FloorId,scheduledAt:string,preferredId?:string){if(doctor.role!=="doctor")return undefined;const candidates=doctor.nurses.filter(n=>n.status!=="inactive"&&n.floor===floor);if(preferredId&&candidates.some(n=>n.id===preferredId))return preferredId;const hour=Number(scheduledAt.slice(11,13));const kind=hour>=5&&hour<17?"day":"night";const shift=st.shifts.find(s=>s.floor===floor&&s.kind===kind&&s.status==="scheduled"&&candidates.some(n=>n.id===s.nurseId));return shift?.nurseId||candidates[0]?.id}
export function seedNurses(){return [
  {id:crypto.randomUUID(),name:"Sofía Rivero",alias:"Sofi",email:"sofia.rivero@rxlist.com",floor:1 as const,status:"active" as const},
  {id:crypto.randomUUID(),name:"Pablo Martínez",alias:"Pablito",email:"pablo.martinez@rxlist.com",floor:2 as const,status:"active" as const},
  {id:crypto.randomUUID(),name:"Juan Pérez",alias:"Juanito",email:"juan.perez@rxlist.com",floor:3 as const,status:"active" as const},
] satisfies Nurse[]}
export function createNurseUser(st:Store,actor:User,name:string,phone?:string,birthDate?:string){const doctor=actor.role==="doctor"?actor:null;if(!doctor)throw new Error("doctor_required");const existing=doctor.nurses.some(n=>normalizeName(n.name)===normalizeName(name));if(existing)throw new Error("nurse_exists");const id=crypto.randomUUID(),userId=crypto.randomUUID(),email=emailForName(name,st.users.map(u=>u.email)),password=temporaryPassword();const nurse:Nurse={id,name,birthDate,email,phone,floor:"unassigned",status:"active",userId,shifts:[]};doctor.nurses.push(nurse);st.users.push({id:userId,name,email,passwordHash:hashPassword(password),role:"nurse",nurseId:id,mustChangePassword:true});audit(st,actor,"create","nurse",id,{name,email,birthDate});return {nurse,password,message:nurseMessage(nurse,password)}}
