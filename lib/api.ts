import { cookies } from "next/headers";
import { readSession } from "./auth";
import { getStore } from "./store";
import type { Store, User } from "./types";

export async function currentContext():Promise<{store:Store;user:User}|null>{
  const token=(await cookies()).get("rxlist_session")?.value;
  const session=token?await readSession(token):null;
  if(!session?.id)return null;
  const store=await getStore();
  const user=store.users.find(x=>x.id===session.id);
  return user?{store,user}:null;
}
