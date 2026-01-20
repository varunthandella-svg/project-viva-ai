import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { resumeText } = await req.json();

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { error: "Invalid resume text" },
        { status: 400 }
      );
    }

    const prompt = `
You are a senior technical interviewer.

TASK:
1. Read the resume below.
2. Identify ONLY real projects mentioned by the candidate.
3. From those projects, generate EXACTLY 3 detailed, project-specific interview questions.
4. Questions must test ownership, decisions, challenges, and impact.
5. Each question must be a FULL sentence (minimum 12 words).

STRICT OUTPUT FORMAT (NO EXTRA TEXT):
{
  "questions": [
    "Full question 1",
    "Full question 2",
    "Full question 3"
  ]
}

Resume:
${resumeText}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0].message.content;

    if (!raw) {
      throw new Error("Empty OpenAI response");
    }

    let parsed: any;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("JSON parse failed:", raw);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    if (
      !parsed.questions ||
      !Array.isArray(parsed.questions)
    ) {
      return NextResponse.json(
        { error: "Invalid questions format" },
        { status: 500 }
      );
    }

    // ✅ FINAL VALIDATION
    const questions = parsed.questions
      .filter(
        (q: any) =>
          typeof q === "string" &&
          q.trim().length > 20 &&      // avoids 1-word questions
          q.split(" ").length >= 6
      )
      .slice(0, 3);

    if (questions.length !== 3) {
      return NextResponse.json(
        { error: "Failed to generate 3 valid questions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Question generation failed" },
      { status: 500 }
    );
  }
}
