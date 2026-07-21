import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
export const hashPassword=(p:string,s=randomBytes(16).toString("hex"))=>`${s}:${scryptSync(p,s,32).toString("hex")}`;
export const verifyPassword=(p:string,h:string)=>{const [s,d]=h.split(":");if(!s||!d)return false;const x=scryptSync(p,s,32);return timingSafeEqual(x,Buffer.from(d,"hex"));};
const key=()=>new TextEncoder().encode(process.env.SESSION_SECRET||"dev-only-change-me-rxlist-session-secret");
export async function signSession(id:string,role:string){return new SignJWT({id,role}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").sign(key())}
export async function readSession(token:string){try{return (await jwtVerify(token,key())).payload as {id:string;role:string}}catch{return null}}
