import { NextResponse } from "next/server";
import { getStore } from "../../../lib/store";
export async function GET(){if(process.env.PUBLIC_DEMO!=="true")return NextResponse.json({error:"demo_disabled"},{status:404});const s=await getStore();return NextResponse.json({floors:s.floors,patients:s.patients.filter(p=>p.status!=="discharged"),nurses:s.users.filter(u=>u.role==="doctor").flatMap(u=>u.nurses).map(({email,phone,birthDate,...n})=>n),tasks:s.tasks,medications:s.medications})}
