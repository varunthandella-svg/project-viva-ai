import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await pdfParse(buffer);
    const resumeText = (parsed.text || "").trim();

    if (!resumeText) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      resumeText,
    });
  } catch (error: any) {
    console.error("Resume upload error:", error);

    return NextResponse.json(
      {
        error: "Failed to upload and parse resume",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}