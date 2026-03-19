import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questions, answers } = body;

    if (!questions || !answers) {
      return NextResponse.json(
        { error: "Missing questions or answers" },
        { status: 400 }
      );
    }

    const prompt = `
You are an AI Interview Evaluator.

Strictly evaluate ONLY based on the answers.

Return STRICT VALID JSON only.

SCORING:
- Each question: 10 marks
- Total: 50

Parameters:
Clarity, Structure, Confidence, Relevance, Professionalism (2 each)

Verdict:
>=35 → Hire
<35 → Reject

Questions:
${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

Answers:
${answers.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}

OUTPUT JSON ONLY:

{
  "questionWiseScores": [
    { "questionNumber": 1, "score": 0 },
    { "questionNumber": 2, "score": 0 },
    { "questionNumber": 3, "score": 0 },
    { "questionNumber": 4, "score": 0 },
    { "questionNumber": 5, "score": 0 }
  ],
  "totalScore": 0,
  "strengths": [],
  "improvementAreas": [],
  "finalVerdict": "Reject"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    let raw = response.choices[0].message.content || "{}";

    // 🔥 CLEAN RESPONSE (important)
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    // 🔥 FIX COMMON JSON ERRORS
    raw = raw.replace(/]\s*"finalVerdict"/g, '], "finalVerdict"');

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("❌ FINAL RAW:", raw);

      return NextResponse.json(
        {
          error: "JSON parsing failed",
          raw,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      report: parsed,
    });

  } catch (error: any) {
    console.error("REPORT ERROR:", error);

    return NextResponse.json(
      {
        error: "Report generation failed",
        details: error?.message,
      },
      { status: 500 }
    );
  }
}