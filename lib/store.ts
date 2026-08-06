import { createClient } from "redis";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hashPassword } from "./auth";
import { emailForName } from "./domain";
import type { Store, FloorRecord } from "./types";
import { demoStore } from "./demo-data";
const floors:FloorRecord[]=[{id:1,name:"Medicina interna",description:"Atención general y recuperación",beds:20},{id:2,name:"Pediatría",description:"Atención pediátrica",beds:16},{id:3,name:"Cirugía",description:"Pre y postoperatorio",beds:18},{id:4,name:"Urgencias",description:"Atención prioritaria",beds:12}];
const seed:Store={schemaVersion:3,revision:1,users:[{id:"admin",name:"Administración",email:"admin@rxlist.local",passwordHash:hashPassword("RXList-Admin-2026!","rxlist-admin-salt"),role:"admin"}],floors,patients:[],shifts:[],medications:[],tasks:[],vitals:[],messages:[],audit:[],chatHistory:{},settings:{agyEnabled:true}};
const file=path.join(process.cwd(),"data","rxlist.json"); let client:ReturnType<typeof createClient>|null=null;
function addDemoClinicalData(s:Store){if(!s.patients.some(p=>p.id.startsWith("demo-patient-")))return;const patient=s.patients.find(p=>p.id==="demo-patient-1")||s.patients[0];if(!s.vitals.length&&patient){s.vitals.push({id:"demo-vital-1",taskId:"demo-task-1",patientId:patient.id,temperature:"37.4",bloodPressure:"122/78",heartRate:"82",oxygenSaturation:"97",notes:"Paciente estable.",recordedBy:"demo-nurse-user-1",recordedAt:"2026-07-27T08:30:00.000Z"},{id:"demo-vital-2",taskId:"demo-task-1",patientId:patient.id,temperature:"37.8",bloodPressure:"124/80",heartRate:"86",oxygenSaturation:"96",notes:"Vigilar temperatura.",recordedBy:"demo-nurse-user-1",recordedAt:"2026-07-27T14:30:00.000Z"},{id:"demo-vital-3",taskId:"demo-task-1",patientId:patient.id,temperature:"37.2",bloodPressure:"120/76",heartRate:"79",oxygenSaturation:"98",notes:"Evolución favorable.",recordedBy:"demo-nurse-user-1",recordedAt:"2026-07-27T20:30:00.000Z"});}if(!s.tasks.some(t=>t.id==="demo-task-upcoming")&&patient){s.tasks.push({id:"demo-task-upcoming",patientId:patient.id,title:"Revisar signos vitales",scheduledAt:new Date(Date.now()+2*60*60*1000).toISOString(),nurseId:"demo-nurse-1",floor:(patient.floor==="unassigned"?1:patient.floor) as 1|2|3|4,status:"pending",notes:"Tarea de demostración"});}}
function migrate(raw:Partial<Store>):Store{const s={...seed,...raw};s.schemaVersion=3;s.floors=s.floors?.length?s.floors:floors;s.patients=s.patients||[];s.shifts=s.shifts||[];s.medications=s.medications||[];s.tasks=s.tasks||[];s.vitals=s.vitals||[];s.messages=s.messages||[];s.audit=s.audit||[];s.chatHistory=s.chatHistory||{};s.settings={agyEnabled:raw.settings?.agyEnabled ?? true};addDemoClinicalData(s as Store);return s as Store}
function completeNurseEmails(s:Store){
  const used=s.users.map(u=>u.email).filter(Boolean);
  let changed=false;
  for(const doctor of s.users){
    if(doctor.role!=="doctor")continue;
    for(const nurse of doctor.nurses){
      if(nurse.email)continue;
      const email=emailForName(nurse.name,used);
      nurse.email=email; used.push(email); changed=true;
      const account=s.users.find(u=>u.role==="nurse"&&u.nurseId===nurse.id);
      if(account)account.email=email;
    }
  }
  return changed;
}
async function local(){try{const raw=JSON.parse(await fs.readFile(file,"utf8"));const s=migrate(raw);if(completeNurseEmails(s)||s.vitals.length>(raw.vitals?.length||0)||s.tasks.length>(raw.tasks?.length||0))await fs.writeFile(file,JSON.stringify(s,null,2));return s}catch{await fs.mkdir(path.dirname(file),{recursive:true});const s=process.env.DEMO_MODE==="true"?demoStore():migrate(seed);await fs.writeFile(file,JSON.stringify(s,null,2));return s}}
export async function getStore(){if(process.env.REDIS_URL){client ??=createClient({url:process.env.REDIS_URL});if(!client.isOpen)await client.connect();const raw=await client.get("rxlist:store");if(raw){const parsed=JSON.parse(raw);const s=migrate(parsed);if(completeNurseEmails(s)||s.vitals.length>(parsed.vitals?.length||0)||s.tasks.length>(parsed.tasks?.length||0))await client.set("rxlist:store",JSON.stringify(s));return s}const s=process.env.DEMO_MODE==="true"?demoStore():migrate(seed);completeNurseEmails(s);await client.set("rxlist:store",JSON.stringify(s));return s}return local()}
export async function saveStore(s:Store){if(process.env.REDIS_URL){client ??=createClient({url:process.env.REDIS_URL});if(!client.isOpen)await client.connect();await client.set("rxlist:store",JSON.stringify(s));return}await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(s,null,2))}
