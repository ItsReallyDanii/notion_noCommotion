"use client";

import { useState } from "react";
import type { IntakePayload } from "@nvb/schema";

type RequestType = IntakePayload["request_type"];
type Priority = IntakePayload["priority"];

interface SubmitResult {
  inboxPageId: string;
  requestId: string;
}

const REQUEST_TYPES: RequestType[] = [
  "idea",
  "claim",
  "task",
  "question",
  "repo_task",
  "other",
];

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [rawRequest, setRawRequest] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("question");
  const [priority, setPriority] = useState<Priority>("medium");
  const [sourceLinks, setSourceLinks] = useState("");
  const [notes, setNotes] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      // Step 1: Intake
      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          raw_request: rawRequest,
          request_type: requestType,
          priority,
          source_links: sourceLinks
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          notes: notes || undefined,
        }),
      });

      if (!intakeRes.ok) {
        const err = await intakeRes.json();
        throw new Error(err.error ?? "Intake failed");
      }

      const intake = (await intakeRes.json()) as SubmitResult;
      setResult(intake);
      setStatus("running");

      // Step 2: Kick off verdict pipeline (non-blocking for demo — streams back when done)
      const runRes = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inbox_page_id: intake.inboxPageId,
          raw_request: rawRequest,
          request_type: requestType,
          source_links: sourceLinks
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });

      if (!runRes.ok) {
        const err = await runRes.json();
        throw new Error(err.error ?? "Verdict run failed");
      }

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Submit a Request</h2>
        <p className="text-gray-400 text-sm">
          Vague idea, claim to verify, task to plan, or question to answer. The
          pipeline will generate a verdict and queue it for your review in
          Notion.
        </p>
      </div>

      {status === "done" && result ? (
        <div className="rounded-lg border border-green-700 bg-green-950/50 p-6">
          <p className="text-green-400 font-semibold mb-1">
            Pipeline complete — verdict queued for review
          </p>
          <p className="text-sm text-gray-400">
            Request ID:{" "}
            <code className="text-gray-200">{result.requestId}</code>
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Open Notion → NVB Inbox and set{" "}
            <strong className="text-white">Human Decision</strong> to{" "}
            <strong className="text-white">Approve</strong>,{" "}
            <strong className="text-white">Revise</strong>, or{" "}
            <strong className="text-white">Reject</strong>.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                setStatus("idle");
                setResult(null);
                setTitle("");
                setRawRequest("");
                setSourceLinks("");
                setNotes("");
              }}
              className="text-sm px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              Submit another
            </button>
            <a
              href="/board"
              className="text-sm px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 transition-colors"
            >
              View board →
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title for this request"
              className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Raw Request
            </label>
            <textarea
              required
              rows={6}
              value={rawRequest}
              onChange={(e) => setRawRequest(e.target.value)}
              placeholder="Paste your full request here — the messier the better. The pipeline will structure it."
              className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Request Type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as RequestType)}
                className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {["low", "medium", "high", "critical"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Source Links{" "}
              <span className="text-gray-500 font-normal">(one per line)</span>
            </label>
            <textarea
              rows={3}
              value={sourceLinks}
              onChange={(e) => setSourceLinks(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context for reviewers"
              className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {status === "running" && (
            <div className="text-sm text-indigo-400 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              Running verdict pipeline… this takes 15–45 seconds.
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting" || status === "running"}
            className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            {status === "submitting"
              ? "Submitting…"
              : status === "running"
              ? "Running pipeline…"
              : "Submit to Verdict Board"}
          </button>
        </form>
      )}
    </div>
  );
}
