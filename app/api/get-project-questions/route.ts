import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { resumeText } = await req.json();

    if (!resumeText) {
      return NextResponse.json(
        { error: "Missing resume text" },
        { status: 400 }
      );
    }

    const prompt = `
You are a technical interviewer.

From the resume below:
1. Identify the MAIN PROJECTS mentioned (ignore skills, education, tools).
2. From those projects, generate EXACTLY 3 deep, project-based interview questions.
3. Questions must test ownership, decisions, challenges, and impact.
4. Each question must be specific to a project in the resume.

Return output STRICTLY as JSON in this format:
{
  "questions": [
    "question 1",
    "question 2",
    "question 3"
  ]
}

Resume:
${resumeText}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0].message.content || "";

    let questions: string[] = [];

    try {
      const parsed = JSON.parse(text);
      questions = parsed.questions;
    } catch {
      // fallback safety (never crash)
      questions = text
        .split("\n")
        .map((q) => q.replace(/^[0-9.-]+/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    // 🔒 HARD GUARANTEE: ALWAYS 3 QUESTIONS
    questions = questions.slice(0, 3);

    if (questions.length < 3) {
      return NextResponse.json(
        { error: "Could not generate enough project questions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to generate project questions" },
      { status: 500 }
    );
  }
}
