import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Helper to read data.js and extract the JS object as JSON
const readDBFile = (): any => {
  const filePath = path.join(process.cwd(), "lib", "data.js");
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const jsonStart = fileContent.indexOf("{");
  const jsonEnd = fileContent.lastIndexOf("}");
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Invalid format in data.js");
  }
  
  const jsonStr = fileContent.substring(jsonStart, jsonEnd + 1);
  return JSON.parse(jsonStr);
};

// Helper to write JSON object back to data.js as JS export
const writeDBFile = (db: any) => {
  const filePath = path.join(process.cwd(), "lib", "data.js");
  const fileContent = `export const db = ${JSON.stringify(db, null, 2)};\n`;
  fs.writeFileSync(filePath, fileContent, "utf-8");
};

export async function GET() {
  try {
    const db = readDBFile();
    return NextResponse.json({ success: true, db });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, db } = body;

    if (action === "read") {
      const currentDB = readDBFile();
      return NextResponse.json({ success: true, db: currentDB });
    }

    if (action === "write") {
      if (!db) {
        return NextResponse.json({ success: false, error: "No database provided" }, { status: 400 });
      }
      writeDBFile(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
