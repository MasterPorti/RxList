import { NextResponse } from "next/server";
import { currentContext } from "../../../lib/api";
import { saveStore } from "../../../lib/store";
import { audit } from "../../../lib/domain";
export async function GET(){const c=await currentContext();if(!c)return NextResponse.json({error:"unauthorized"},{status:401});return NextResponse.json({floors:c.store.floors})}
export async function PATCH(req:Request){const c=await currentContext();if(!c||c.user.role!=="doctor"&&c.user.role!=="admin")return NextResponse.json({error:"forbidden"},{status:403});const b=await req.json();const f=c.store.floors.find(x=>x.id===Number(b.id));if(!f)return NextResponse.json({error:"not_found"},{status:404});f.name=String(b.name||f.name);f.description=String(b.description||f.description);f.beds=Math.max(1,Number(b.beds)||f.beds);c.store.revision++;audit(c.store,c.user,"update","floor",String(f.id),{name:f.name,beds:f.beds});await saveStore(c.store);return NextResponse.json({ok:true,floor:f,revision:c.store.revision})}
