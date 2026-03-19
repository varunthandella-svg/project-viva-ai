import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const HR_QUESTIONS = [
  "Why do you want to work with our company?",
  "Why should we hire you for this role?",
  "What are your key professional strengths?",
  "What motivates you to do your best work?",
  "What kind of work environment helps you perform best?",
  "Where do you see yourself in the next 3 years?",
  "How do you define success in your career?",
  "What makes you a strong fit for this opportunity?",
  "What type of role are you currently looking for and why?",
  "How do you usually add value in a team or organization?",
];

const BEHAVIORAL_QUESTIONS = [
  "Tell me about a time you faced a difficult challenge and how you handled it.",
  "Describe a situation where you had to work under pressure.",
  "Tell me about a time you made a mistake and what you learned from it.",
  "Describe a time when you had to learn something quickly.",
  "Tell me about a time you took initiative without being asked.",
  "Describe a situation where you had to deal with ambiguity.",
  "Tell me about a time you handled conflicting priorities.",
  "Describe a time when you worked with someone difficult and how you managed it.",
  "Tell me about a time you had to solve a problem with limited guidance.",
  "Describe a situation where you improved a process or workflow.",
];

function getRandomItem(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSessionVariationHint() {
  const variations = [
    "Focus one question on impact/results and the other on technical depth.",
    "Focus one question on ownership and the other on problem-solving.",
    "Focus one question on project decisions and the other on measurable outcomes.",
    "Focus one question on challenges faced and the other on implementation details.",
    "Focus one question on role contribution and the other on learning/growth.",
  ];

  return getRandomItem(variations);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const resumeText = body?.resumeText;

    if (!resumeText || typeof resumeText !== "string") {
      return NextResponse.json(
        { error: "resumeText is required" },
        { status: 400 }
      );
    }

    const cleanedResumeText = resumeText.trim().slice(0, 12000);

    const selectedHRQuestion = getRandomItem(HR_QUESTIONS);
    const selectedBehavioralQuestion = getRandomItem(BEHAVIORAL_QUESTIONS);
    const variationHint = getSessionVariationHint();

    const prompt = `
You are an interview question generator.

Your job is to generate exactly 5 interview questions in valid JSON format.

STRICT RULES:
1. Output exactly 5 questions.
2. Return JSON only.
3. Do not add markdown.
4. Do not add explanations.
5. Do not repeat questions.
6. Avoid predictable patterns and overly generic phrasing.
7. Questions 2 and 3 must be based on the candidate's actual resume/profile below.
8. Questions 2 and 3 must be different in focus from each other.
9. Questions 2 and 3 should feel natural, interviewer-style, and personalized to the resume.
10. Do not ask two very similar resume questions.
11. Keep all questions concise, professional, and interview-ready.

QUESTION STRUCTURE:
1. Fixed question:
   "Tell me about yourself."

2. Question 2:
   A resume-adaptive question based on candidate profile.

3. Question 3:
   Another resume-adaptive question, clearly different from Question 2.

4. Question 4:
   Use this exact HR question:
   "${selectedHRQuestion}"

5. Question 5:
   Use this exact behavioral question:
   "${selectedBehavioralQuestion}"

SESSION VARIATION GUIDANCE:
${variationHint}

IMPORTANT FOR Q2 AND Q3:
- If the resume contains projects, experience, internships, achievements, tools, or skills, use them.
- Prefer asking about impact, decisions, ownership, implementation, challenges, trade-offs, outcomes, or learning.
- Make the questions sound like a real interviewer.
- Avoid generic questions like "Can you explain your project?" unless it is made specific.

Candidate Resume/Profile:
"""
${cleanedResumeText}
"""

Return in exactly this JSON format:
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 1.1,
      messages: [
        {
          role: "system",
          content:
            "You generate structured interview questions in strict JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from OpenAI" },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse OpenAI response",
          raw: content,
        },
        { status: 500 }
      );
    }

    if (
      !parsed.questions ||
      !Array.isArray(parsed.questions) ||
      parsed.questions.length !== 5
    ) {
      return NextResponse.json(
        {
          error: "Invalid questions format returned by OpenAI",
          parsed,
        },
        { status: 500 }
      );
    }

    const questions = parsed.questions.map((q: any) => String(q).trim());

    return NextResponse.json({
      questions,
      meta: {
        hrQuestion: selectedHRQuestion,
        behavioralQuestion: selectedBehavioralQuestion,
        variationHint,
      },
    });
  } catch (error: any) {
    console.error("Error generating project questions:", error);

    return NextResponse.json(
      {
        error: "Failed to generate questions",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}