import { NextResponse } from "next/server";
const pdfParse = require("pdf-parse");

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume") as File; // must match frontend key
    if (!file) {
      return NextResponse.json({ error: "No resume uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);

    return NextResponse.json({ resumeText: parsed.text });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
