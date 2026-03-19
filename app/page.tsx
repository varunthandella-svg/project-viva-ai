"use client";

import { useRef, useState } from "react";

type ReportType = {
  questionWiseScores: { questionNumber: number; score: number }[];
  totalScore: number;
  strengths: string[];
  improvementAreas: string[];
  finalVerdict: "Hire" | "Reject";
};

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [startScreen, setStartScreen] = useState(true);

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [liveText, setLiveText] = useState("");
  const [finalText, setFinalText] = useState("");

  const [answers, setAnswers] = useState<string[]>([]);
  const [report, setReport] = useState<ReportType | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);
  const [statusText, setStatusText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const accumulatedTranscriptRef = useRef("");
  const shouldKeepRecognitionRunningRef = useRef(false);
  const isStoppingRef = useRef(false);

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload-resume", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    setResumeText(data.resumeText || "");
    setResumeUploaded(true);
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  function resetTranscript() {
    accumulatedTranscriptRef.current = "";
    chunksRef.current = [];
    setLiveText("");
    setFinalText("");
    setStatusText("");
  }

  function startTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setTimeLeft(180);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          void handleAutoNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleAutoNext() {
    if (recording) {
      await stopRecording();
    }
    goToNextQuestion();
  }

  async function cleanupAudio() {
    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }

      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        } catch {}
        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    } catch {}
  }

  function startSpeechRecognition() {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalized = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript || "";

        if (event.results[i].isFinal) {
          finalized += text + " ";
        } else {
          interim += text;
        }
      }

      if (finalized.trim()) {
        accumulatedTranscriptRef.current = (
          accumulatedTranscriptRef.current +
          " " +
          finalized
        )
          .replace(/\s+/g, " ")
          .trim();
      }

      const combined = (
        accumulatedTranscriptRef.current +
        " " +
        interim
      )
        .replace(/\s+/g, " ")
        .trim();

      setLiveText(combined);
    };

    recognition.onend = () => {
      if (shouldKeepRecognitionRunningRef.current && !isStoppingRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {}
  }

  async function startRecording() {
    if (recording) return;

    await cleanupAudio();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    chunksRef.current = [];
    accumulatedTranscriptRef.current = "";
    setLiveText("");
    setFinalText("");

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start();

    shouldKeepRecognitionRunningRef.current = true;
    isStoppingRef.current = false;
    startSpeechRecognition();

    setRecording(true);
    setStatusText("Answer is recording...");
  }

  async function stopRecording() {
    if (!recording) return;

    return new Promise<void>((resolve) => {
      isStoppingRef.current = true;
      shouldKeepRecognitionRunningRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }

      const recorder = mediaRecorderRef.current;

      if (!recorder) {
        setRecording(false);
        setStatusText("Recording stopped.");
        void cleanupAudio();
        resolve();
        return;
      }

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "audio.webm", {
            type: "audio/webm",
          });

          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          const text = (data?.text || "").trim();

          setFinalText(text);
          setLiveText(text || accumulatedTranscriptRef.current);

          setAnswers((prev) => {
            const updated = [...prev];
            updated[currentIndex] = text || accumulatedTranscriptRef.current;
            return updated;
          });
        } finally {
          setRecording(false);
          setStatusText("Recording stopped.");
          mediaRecorderRef.current = null;
          await cleanupAudio();
          resolve();
        }
      };

      try {
        recorder.stop();
      } catch {
        setRecording(false);
        setStatusText("Recording stopped.");
        void cleanupAudio();
        resolve();
      }
    });
  }

  async function retakeAnswer() {
    if (recording) {
      await stopRecording();
    }

    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = "";
      return updated;
    });

    resetTranscript();
    setStatusText("Retake started...");
    await startRecording();
  }

  function goToNextQuestion() {
    stopTimer();

    if (currentIndex === questions.length - 1) return;

    const next = currentIndex + 1;
    setCurrentIndex(next);
    resetTranscript();
    setRecording(false);

    startTimer();
    speak(questions[next]);
  }

  async function handleSubmitAndNext() {
    if (recording) {
      await stopRecording();
    }

    if (currentIndex === questions.length - 1) {
      setLoadingReport(true);

      const normalizedAnswers = Array.from({ length: questions.length }, (_, i) => answers[i] || "");

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, answers: normalizedAnswers }),
      });

      const data = await res.json();

      setReport(data.report);
      setLoadingReport(false);
      return;
    }

    goToNextQuestion();
  }

  async function startInterview() {
    const res = await fetch("/api/get-project-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText }),
    });

    const data = await res.json();

    setQuestions(data.questions);
    setCurrentIndex(0);
    setAnswers(new Array(5).fill(""));
    resetTranscript();
    setStartScreen(false);

    startTimer();
    speak(data.questions[0]);
  }

  if (startScreen) {
    return (
      <main className="min-h-screen bg-[#0B1F4D] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316] text-xl font-bold">
              CN
            </div>
            <div>
              <div className="text-2xl font-bold">Coding Ninjas</div>
              <div className="text-sm text-blue-100">Soft Skill AI Mock</div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-3xl bg-white p-8 text-gray-900 shadow-2xl">
              <div className="mb-3 inline-flex rounded-full bg-orange-100 px-4 py-1 text-sm font-semibold text-[#F97316]">
                AI Interview Practice
              </div>

              <h1 className="mb-4 text-4xl font-bold leading-tight text-[#0B1F4D]">
                Coding Ninjas Soft Skill AI Mock
              </h1>

              <p className="mb-8 text-lg text-gray-600">
                Practice your communication, articulation, clarity, and professional responses
                in a structured AI-powered mock interview.
              </p>

              <div className="mb-8 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-[#0B1F4D]">
                    What this interview is about
                  </h2>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• 5 structured interview questions</li>
                    <li>• 180 seconds per question</li>
                    <li>• Voice-based response capture</li>
                    <li>• Answer-based scoring out of 50</li>
                    <li>• Final verdict: Hire / Reject</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                  <h2 className="mb-3 text-lg font-semibold text-[#0B1F4D]">
                    Evaluation focus
                  </h2>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Clarity</li>
                    <li>• Structure</li>
                    <li>• Confidence</li>
                    <li>• Relevance</li>
                    <li>• Professionalism & articulation</li>
                  </ul>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold text-green-700">Do&apos;s</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Speak clearly and naturally</li>
                    <li>• Keep your answers structured</li>
                    <li>• Stay relevant to the question</li>
                    <li>• Maintain a professional tone</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold text-red-700">Don&apos;ts</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Do not give one-word answers</li>
                    <li>• Do not go off topic</li>
                    <li>• Avoid unnecessary filler words</li>
                    <li>• Avoid very long pauses</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-8 text-gray-900 shadow-2xl">
              <h2 className="mb-2 text-2xl font-bold text-[#0B1F4D]">
                Start your interview
              </h2>
              <p className="mb-6 text-sm text-gray-600">
                Upload your resume to begin the AI mock interview.
              </p>

              <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center">
                <div className="mb-3 text-sm font-medium text-[#0B1F4D]">
                  Upload your resume here
                </div>

                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  className="mx-auto block text-sm"
                />

                <div className="mt-3 text-xs text-gray-500">
                  Supported format: PDF
                </div>

                {resumeUploaded ? (
                  <div className="mt-4 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700">
                    Resume uploaded successfully
                  </div>
                ) : null}
              </div>

              <button
                onClick={startInterview}
                disabled={!resumeUploaded}
                className="mt-6 w-full rounded-xl bg-[#F97316] px-6 py-3 text-lg font-semibold text-white disabled:opacity-50"
              >
                Start Interview
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loadingReport) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] p-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 text-center shadow-xl">
          <div className="mb-4 text-5xl">📄</div>
          <h1 className="text-2xl font-bold text-[#0B1F4D]">Generating Report...</h1>
          <p className="mt-2 text-gray-600">
            Please wait while your interview performance is being evaluated.
          </p>
        </div>
      </main>
    );
  }

  if (report) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-2xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">
                Coding Ninjas Soft Skill AI Mock
              </div>
              <h1 className="text-3xl font-bold text-[#0B1F4D]">Final Report</h1>
            </div>

            <div
              className={`rounded-2xl px-5 py-3 text-lg font-bold ${
                report.finalVerdict === "Hire"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {report.finalVerdict}
            </div>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-6">
              <div className="text-sm font-medium text-gray-600">Total Score</div>
              <div className="mt-2 text-4xl font-bold text-[#0B1F4D]">
                {report.totalScore}
                <span className="text-xl text-gray-500"> / 50</span>
              </div>
            </div>

            <div className="rounded-2xl bg-orange-50 p-6">
              <div className="text-sm font-medium text-gray-600">Questions Evaluated</div>
              <div className="mt-2 text-4xl font-bold text-[#0B1F4D]">5</div>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-gray-200 p-6">
            <h2 className="mb-4 text-xl font-bold text-[#0B1F4D]">Question-wise Scores</h2>
            <div className="space-y-3">
              {report.questionWiseScores.map((q) => (
                <div
                  key={q.questionNumber}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                >
                  <div className="font-medium text-gray-700">Question {q.questionNumber}</div>
                  <div className="font-bold text-[#0B1F4D]">{q.score} / 10</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <h2 className="mb-4 text-xl font-bold text-green-700">Strengths</h2>
              <ul className="space-y-2 text-gray-700">
                {report.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="mb-4 text-xl font-bold text-red-700">Improvement Areas</h2>
              <ul className="space-y-2 text-gray-700">
                {report.improvementAreas.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316] text-xl font-bold text-white">
              CN
            </div>
            <div>
              <div className="text-2xl font-bold text-[#0B1F4D]">Coding Ninjas</div>
              <div className="text-sm text-gray-500">Soft Skill AI Mock</div>
            </div>
          </div>

          <div className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
            Time Remaining: {timeLeft}s
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>Interview Progress</span>
            <span>
              Q{currentIndex + 1} / {questions.length}
            </span>
          </div>

          <div className="h-3 rounded-full bg-gray-200">
            <div
              className="h-3 rounded-full bg-[#1D4ED8] transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-blue-50 p-6">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#1D4ED8]">
            Current Question
          </div>
          <h2 className="text-xl font-semibold text-[#0B1F4D]">{questions[currentIndex]}</h2>
        </div>

        <div className="mb-4 min-h-[32px]">
          {recording ? (
            <div className="flex flex-wrap items-center gap-4 text-green-600">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎤</span>
                <span className="font-semibold">Answer is recording...</span>
              </div>

              <div className="flex h-8 items-end gap-1">
                {[10, 18, 12, 24, 14, 20, 11, 22].map((h, i) => (
                  <span
                    key={i}
                    className="w-1.5 animate-pulse rounded-full bg-green-500"
                    style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="font-medium text-gray-600">{statusText}</div>
          )}
        </div>

        <div className="mb-6 min-h-[180px] rounded-2xl border border-gray-200 bg-gray-50 p-5 text-gray-800 shadow-inner">
          {liveText || finalText || "Start speaking..."}
        </div>

        <div className="flex flex-wrap gap-4">
          {!recording ? (
            <button
              onClick={startRecording}
              className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white"
            >
              Start Answer
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white"
            >
              Stop Mic
            </button>
          )}

          <button
            onClick={retakeAnswer}
            className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-white"
          >
            Retake
          </button>

          <button
            onClick={handleSubmitAndNext}
            className="rounded-xl bg-[#1D4ED8] px-5 py-3 font-semibold text-white"
          >
            {currentIndex === questions.length - 1 ? "Finish Interview" : "Submit & Next"}
          </button>
        </div>
      </div>
    </main>
  );
}