import { createClient } from "redis";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hashPassword } from "./auth";
import { emailForName } from "./domain";
import type { Store, FloorRecord } from "./types";
const floors:FloorRecord[]=[{id:1,name:"Medicina interna",description:"Atención general y recuperación",beds:20},{id:2,name:"Pediatría",description:"Atención pediátrica",beds:16},{id:3,name:"Cirugía",description:"Pre y postoperatorio",beds:18},{id:4,name:"Urgencias",description:"Atención prioritaria",beds:12}];
const seed:Store={schemaVersion:2,revision:1,users:[{id:"admin",name:"Administración",email:"admin@rxlist.local",passwordHash:hashPassword("RXList-Admin-2026!","rxlist-admin-salt"),role:"admin"}],floors,patients:[],shifts:[],medications:[],tasks:[],vitals:[],audit:[],chatHistory:{}};
const file=path.join(process.cwd(),"data","rxlist.json"); let client:ReturnType<typeof createClient>|null=null;
function migrate(raw:Partial<Store>):Store{const s={...seed,...raw};s.schemaVersion=2;s.floors=s.floors?.length?s.floors:floors;s.patients=s.patients||[];s.shifts=s.shifts||[];s.medications=s.medications||[];s.tasks=s.tasks||[];s.vitals=s.vitals||[];s.audit=s.audit||[];s.chatHistory=s.chatHistory||{};return s as Store}
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
async function local(){try{const s=migrate(JSON.parse(await fs.readFile(file,"utf8")));if(completeNurseEmails(s))await fs.writeFile(file,JSON.stringify(s,null,2));return s}catch{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(seed,null,2));return seed}}
export async function getStore(){if(process.env.REDIS_URL){client ??=createClient({url:process.env.REDIS_URL});if(!client.isOpen)await client.connect();const raw=await client.get("rxlist:store");if(raw){const s=migrate(JSON.parse(raw));if(completeNurseEmails(s))await client.set("rxlist:store",JSON.stringify(s));return s}const s=migrate(seed);completeNurseEmails(s);await client.set("rxlist:store",JSON.stringify(s));return s}return local()}
export async function saveStore(s:Store){if(process.env.REDIS_URL){client ??=createClient({url:process.env.REDIS_URL});if(!client.isOpen)await client.connect();await client.set("rxlist:store",JSON.stringify(s));return}await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(s,null,2))}
