import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ScoreItem = {
  questionNumber: number;
  score: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questions, answers } = body;

    if (!questions || !answers || !Array.isArray(questions) || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Missing questions or answers" },
        { status: 400 }
      );
    }

    const prompt = `
You are an AI Interview Evaluator.

Strictly evaluate ONLY based on the candidate's answers.
Do not assume anything not present in the answers.
Do not give generic feedback.

IMPORTANT SCORING INSTRUCTION:
Be balanced and slightly soft/learner-friendly in evaluation.
If an answer shows some relevant intent, partial structure, or reasonable communication effort,
award fair partial credit instead of being overly harsh.
Do not inflate blindly, but avoid unnecessarily strict scoring.

SCORING:
Each question is scored out of 10 on:
- Clarity (2)
- Structure (2)
- Confidence (2)
- Relevance (2)
- Professionalism & Articulation (2)

Total score = 50

VERDICT LOGIC:
- If totalScore >= 30 → "Hire"
- If totalScore < 30 → "Reject"

Questions:
${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

Answers:
${answers.map((a: string, i: number) => `${i + 1}. ${a || ""}`).join("\n")}

Return STRICT VALID JSON ONLY in this exact structure:

{
  "questionWiseScores": [
    { "questionNumber": 1, "score": 0 },
    { "questionNumber": 2, "score": 0 },
    { "questionNumber": 3, "score": 0 },
    { "questionNumber": 4, "score": 0 },
    { "questionNumber": 5, "score": 0 }
  ],
  "totalScore": 0,
  "strengths": ["..."],
  "improvementAreas": ["..."],
  "finalVerdict": "Reject"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    let raw = response.choices[0]?.message?.content || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    raw = raw.replace(/]\s*"finalVerdict"/g, '], "finalVerdict"');

    let parsed: any;

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("JSON PARSE ERROR:", raw);
      return NextResponse.json(
        { error: "JSON parsing failed", raw },
        { status: 500 }
      );
    }

    const normalizedScores: ScoreItem[] = Array.from({ length: 5 }, (_, index) => {
      const found = parsed?.questionWiseScores?.find(
        (item: any) => Number(item?.questionNumber) === index + 1
      );

      let score = Number(found?.score ?? 0);

      if (Number.isNaN(score)) score = 0;
      if (score < 0) score = 0;
      if (score > 10) score = 10;

      return {
        questionNumber: index + 1,
        score,
      };
    });

    const totalScore = normalizedScores.reduce((sum, item) => sum + item.score, 0);
    const finalVerdict = totalScore >= 30 ? "Hire" : "Reject";

    const report = {
      questionWiseScores: normalizedScores,
      totalScore,
      strengths: Array.isArray(parsed?.strengths) ? parsed.strengths.slice(0, 5) : [],
      improvementAreas: Array.isArray(parsed?.improvementAreas)
        ? parsed.improvementAreas.slice(0, 5)
        : [],
      finalVerdict,
    };

    return NextResponse.json({ report });
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