export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  const { resumeText, question, answer } = await req.json();

  if (!resumeText || !question || !answer) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `
Resume:
${resumeText}

Previous Question:
${question}

Candidate Answer:
${answer}

Ask ONE deeper follow-up question.
Return ONLY the question.
        `,
      },
    ],
  });

  return NextResponse.json({
    nextQuestion: response.choices[0].message.content,
  });
}
