import { z } from "zod";
export const Floor = z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal("unassigned")]);
export const AssignedFloor = z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]);
export type Nurse = { id:string; name:string; alias?:string; floor:1|2|3|4|"unassigned" };
export type Doctor = { id:string; name:string; email:string; passwordHash:string; role:"doctor"; nurses:Nurse[] };
export type User = Doctor | {id:string;name:string;email:string;passwordHash:string;role:"admin"};
export type Store = {schemaVersion:1;revision:number;users:User[];audit:{id:string;doctorId:string;nurseId:string;from: number;to:number;at:string}[]};
export const Plan = z.object({type:z.enum(["proposal","clarification","rejected","no_change"]),message:z.string().max(1000),operations:z.array(z.union([z.object({action:z.literal("update_floor").optional(),nurseId:z.string(),from:AssignedFloor,to:AssignedFloor,name:z.string().min(2).max(100).optional(),alias:z.string().max(50).optional(),floor:AssignedFloor.optional()}),z.object({action:z.literal("create_nurse"),nurseId:z.string(),from:Floor,to:Floor,name:z.string().min(2).max(100),alias:z.string().max(50).optional(),floor:Floor})])).max(20)});
export type Plan = z.infer<typeof Plan>;
