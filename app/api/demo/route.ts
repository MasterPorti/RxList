import { NextResponse } from "next/server";
import { getStore } from "../../../lib/store";
export async function GET(){const s=await getStore();return NextResponse.json({floors:s.floors,patients:s.patients.filter(p=>p.status!=="discharged"),nurses:s.users.filter(u=>u.role==="doctor").flatMap(u=>u.nurses),tasks:s.tasks,medications:s.medications})}
