import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { resumeText } = await req.json();

    if (!resumeText) {
      return NextResponse.json(
        { error: "Resume text missing" },
        { status: 400 }
      );
    }

    const prompt = `
You are a technical interviewer.

TASK (VERY IMPORTANT):
1. Extract ONLY the PROJECTS from the resume below.
2. Identify real projects mentioned by the candidate.
3. For EACH project, generate ONE deep, implementation-level interview question.

STRICT RULES:
- Questions must be strictly based on the resume projects.
- Do NOT ask generic questions.
- Do NOT invent projects.
- If there is only 1 project, generate up to 3 questions from it.
- Return ONLY valid JSON. No explanations. No markdown.

OUTPUT FORMAT:
{
  "projects": [
    {
      "name": "Project Name",
      "question": "Deep project-based question"
    }
  ]
}

RESUME:
${resumeText}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });

    let content: string = response.choices[0].message.content || "";

    // ✅ CLEAN MARKDOWN (handles ```json ... ```)
    content = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse failed:", content);
      return NextResponse.json(
        { error: "Failed to parse project questions" },
        { status: 500 }
      );
    }

    if (!parsed.projects || parsed.projects.length === 0) {
      return NextResponse.json(
        { error: "No projects found in resume" },
        { status: 422 }
      );
    }

    // Take maximum 3 project-based questions
    const questions = parsed.projects
      .slice(0, 3)
      .map((p: any) => p.question);

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Project question generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate project-based questions" },
      { status: 500 }
    );
  }
}
