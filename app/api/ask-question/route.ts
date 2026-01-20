import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { question, context } = await req.json();

    if (!question || !context) {
      return NextResponse.json(
        { error: "Missing question or context" },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional interviewer assistant. Answer only from the provided resume context.",
          },
          {
            role: "user",
            content: `Resume:\n${context}\n\nQuestion:\n${question}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    return NextResponse.json({
      answer: response.choices[0].message.content,
    });
  } catch (error: any) {
    console.error("OpenAI error:", error);

    if (error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 408 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: "OpenAI quota exceeded. Try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 500 }
    );
  }
}
