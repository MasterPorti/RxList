import { createClient } from "redis";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hashPassword } from "./auth";
import type { Store } from "./types";
const seed:Store={schemaVersion:1,revision:1,users:[{id:"admin",name:"Administración",email:"admin@rxlist.local",passwordHash:hashPassword("RXList-Admin-2026!","rxlist-admin-salt"),role:"admin"}],audit:[]};
const file=path.join(process.cwd(),"data","rxlist.json"); let client:ReturnType<typeof createClient>|null=null;
async function local(){try{return JSON.parse(await fs.readFile(file,"utf8")) as Store}catch{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(seed,null,2));return seed}}
export async function getStore(){if(process.env.REDIS_URL){client ??=createClient({url:process.env.REDIS_URL});if(!client.isOpen)await client.connect();const raw=await client.get("rxlist:store");if(raw)return JSON.parse(raw) as Store;await client.set("rxlist:store",JSON.stringify(seed));return seed}return local()}
export async function saveStore(s:Store){if(process.env.REDIS_URL){client ??=createClient({url:process.env.REDIS_URL});if(!client.isOpen)await client.connect();await client.set("rxlist:store",JSON.stringify(s));return}await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(s,null,2))}
