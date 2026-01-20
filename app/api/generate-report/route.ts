import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    if (!questions || !answers || questions.length === 0) {
      return NextResponse.json(
        { error: "Missing interview data" },
        { status: 400 }
      );
    }

    const prompt = `
You are a senior technical interviewer.

Below is a completed project-based interview.

INTERVIEW DATA:
${questions
  .map(
    (q: string, i: number) =>
      `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`
  )
  .join("\n\n")}

TASK:
Generate a FINAL INTERVIEW REPORT with the following sections:

1. Overall Summary (2–3 lines)
2. Strengths (bullet points)
3. Gaps (bullet points)
4. Areas of Improvement (actionable bullet points)
5. Final Verdict (STRICTLY ONE WORD ONLY)

VERDICT RULES (VERY IMPORTANT):
Final Verdict MUST be exactly one of:
- Below Average
- Average
- Good

Do NOT use any other wording.

OUTPUT FORMAT:

Overall Summary:
...

Strengths:
- ...

Gaps:
- ...

Areas of Improvement:
- ...

Final Verdict:
<Below Average | Average | Good>
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    return NextResponse.json({
      report: response.choices[0].message.content || "",
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
