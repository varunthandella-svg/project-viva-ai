"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false);

  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [answer, setAnswer] = useState("");
  const [timer, setTimer] = useState(160);
  const [listening, setListening] = useState(false);

  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");

  /* ---------------- UPLOAD ---------------- */

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFetchingQuestions(true);

    const formData = new FormData();
    formData.append("resume", file);

    const res = await fetch("/api/upload-resume", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      await fetchQuestions(data.resumeText);
      setInterviewStarted(true);
    } else {
      alert(data.error);
    }

    setIsFetchingQuestions(false);
  }

  async function fetchQuestions(resumeText: string) {
    const res = await fetch("/api/get-project-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText }),
    });

    const data = await res.json();

    if (res.ok) {
      setQuestions(data.questions);
      setAnswers([]);
      setCurrentIndex(0);
    } else {
      alert(data.error);
    }
  }

  /* ---------------- VOICE (STABLE) ---------------- */

  function startListening() {
    if (listening) return;

    stopListening(); // safety

    finalTranscriptRef.current = "";
    setAnswer("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const rec = new SpeechRecognition();

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);

    rec.onend = () => {
      setListening(false);
      setAnswer(finalTranscriptRef.current.trim());
    };

    rec.onresult = (event: any) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      setAnswer(
        (finalTranscriptRef.current + interim).trim()
      );
    };

    recognitionRef.current = rec;
    rec.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }

  /* ---------------- TIMER (STRICT) ---------------- */

  useEffect(() => {
    if (!interviewStarted || questions.length === 0) return;

    stopListening();
    finalTranscriptRef.current = "";
    setAnswer("");
    setTimer(160);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          stopListening();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopListening();
    };
  }, [currentIndex, interviewStarted]);

  /* ---------------- SUBMIT (ONLY WAY TO NEXT QUESTION) ---------------- */

  function submitAnswer() {
    stopListening();
    if (timerRef.current) clearInterval(timerRef.current);

    setAnswers((prev) => [...prev, answer || "(No answer)"]);
    finalTranscriptRef.current = "";
    setAnswer("");

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setInterviewCompleted(true);
    }
  }

  /* ---------------- REPORT ---------------- */

  async function generateReport() {
    setLoading(true);

    const res = await fetch("/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, answers }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) setReport(data.report);
  }

  /* ---------------- UI ---------------- */

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex justify-center px-6 py-10">
      <div className="w-full max-w-4xl space-y-10">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold">Project-Based Interview</h1>
          <p className="text-zinc-400 text-sm">
            Timed, voice-based interview on your real projects
          </p>
        </div>

        {/* INTERVIEW */}
        {!interviewCompleted && interviewStarted && questions.length > 0 && (
          <div className="bg-zinc-900 rounded-xl p-8 space-y-6">

            <div className="flex justify-between">
              <span className="text-sm text-zinc-400">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-lg text-red-400 font-semibold">
                ⏱ {timer}s
              </span>
            </div>

            <div className="bg-zinc-800 rounded-lg p-6 text-lg">
              {questions[currentIndex]}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span
                className={`h-3 w-3 rounded-full ${
                  listening ? "bg-green-400 animate-pulse" : "bg-zinc-500"
                }`}
              />
              <span className="text-zinc-400">
                {listening ? "Recording…" : "Mic off"}
              </span>
            </div>

            <textarea
              value={answer}
              readOnly
              rows={5}
              className="w-full bg-zinc-800 rounded-lg p-4 text-sm"
              placeholder="Click Start Answer to begin"
            />

            <div className="flex gap-4">
              <button
                onClick={startListening}
                disabled={listening || timer === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-medium disabled:opacity-50"
              >
                Start Answer
              </button>

              <button
                onClick={submitAnswer}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-medium"
              >
                Submit Answer
              </button>
            </div>
          </div>
        )}

        {/* REPORT */}
        {interviewCompleted && !report && (
          <div className="bg-zinc-900 rounded-xl p-10 text-center space-y-4">
            <h2 className="text-2xl font-semibold">
              Interview Completed 🎉
            </h2>
            <button
              onClick={generateReport}
              className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-lg font-medium"
            >
              {loading ? "Generating Report…" : "Generate Report"}
            </button>
          </div>
        )}

        {report && (
          <div className="bg-zinc-900 rounded-xl p-8">
            <pre className="whitespace-pre-wrap text-sm bg-zinc-800 p-6 rounded-lg">
              {report}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
