import { NextResponse } from "next/server";
import { currentContext } from "../../../../lib/api";
import { saveStore } from "../../../../lib/store";
export async function POST(){
  const c=await currentContext();
  if(!c||c.user.role!=="doctor")return NextResponse.json({error:"unauthorized"},{status:401});
  delete c.store.chatHistory[c.user.id];
  await saveStore(c.store);
  return NextResponse.json({ok:true});
}
