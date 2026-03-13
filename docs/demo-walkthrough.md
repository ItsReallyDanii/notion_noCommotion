# NVB Demo Walkthrough

The single happiest demo path for a challenge submission.
Use this as your script for a screen recording or DEV.to post.

---

## Setup required before demo

1. All 4 Notion databases created with correct schema
2. `.env` configured with `NOTION_TOKEN` + 4 database IDs + `OPENAI_API_KEY`
3. `pnpm validate-env` passes
4. `pnpm dev` running at http://localhost:3000

---

## The story

> A developer has a half-formed idea: *"I want to add a real-time leaderboard to my hackathon project but I'm not sure if that's scope creep or a core feature."*
>
> Instead of acting on the raw idea, they send it through the Verdict Board. The system drafts a structured plan, challenges its own assumptions, and produces a verdict the developer can approve or push back on — all tracked in Notion.

---

## Step-by-step demo path

### Step 1 — Submit the request (30 sec)

Open http://localhost:3000

Fill out the form:
- **Title:** `Should I add a real-time leaderboard to my hackathon project?`
- **Raw Request:**
  > I'm building a hackathon project in 48 hours. I had the idea to add a real-time leaderboard using WebSockets so attendees can see live scores. But now I'm wondering if this is scope creep or actually a differentiating feature. I have ~6 hours left. What should I do?
- **Request Type:** `idea`
- **Priority:** `high`
- **Source Links:** _(leave blank)_

Click **Submit to Verdict Board**.

**What to show:** The form clears, and the "Running pipeline…" indicator appears.

---

### Step 2 — Pipeline runs (20–40 sec wait)

The pipeline runs 3 LLM calls sequentially:
1. Generator produces a concrete recommendation
2. Auditor flags assumptions and scope risks
3. Clerk synthesizes a structured verdict

**What to show:** The loading indicator. Explain what's happening in voiceover.

---

### Step 3 — "Pipeline complete" confirmation

The UI shows:
> Pipeline complete — verdict queued for review
> Request ID: NVB-XXXXXXXX
> Open Notion → NVB Inbox and set Human Decision to Approve, Revise, or Reject.

**What to show:** This confirmation screen.

---

### Step 4 — Review in Notion (the money shot)

Open Notion → NVB Inbox.

Show the inbox item:
- Status = `Awaiting Review`
- Confidence score (e.g. 0.78 → 78%)
- The `Latest Run` relation linking to the Run page

Open the linked Run page in NVB Runs:
- Show the Raw JSON property with the verdict structure
- Show: `exit_status: "approve"`, `recommended_artifact: "doc"`, `unified_answer`

**What to show:** The Notion page as a structured verdict board. This is the core product moment — the human sees a structured, audited recommendation with confidence scores, disagreements, and citations.

---

### Step 5 — Human makes a decision

In the NVB Inbox page, click the **Human Decision** property.

Show the dropdown options: `Pending`, `Approve`, `Revise`, `Reject`, `Needs Evidence`.

Select **Approve**.

**What to show:** The dropdown interaction. This is the human-in-the-loop gate.

---

### Step 6 — Promote to artifact

Option A (from /board):
- Open http://localhost:3000/board
- Find the item, click **Promote →**

Option B (curl for technical audiences):
```bash
curl -X POST http://localhost:3000/api/promote \
  -H "Content-Type: application/json" \
  -d '{"inbox_page_id":"YOUR_PAGE_ID","create_github_artifact":false}'
```

---

### Step 7 — Show the artifact (the final payoff)

Open Notion → NVB Artifacts.

The new artifact page contains:
- Heading: **Verdict**
- Full `unified_answer` as readable paragraphs
- Confidence callout block
- Citations section
- Notes for the reviewer

The NVB Inbox item now shows:
- Status = `Promoted`
- Final Artifact relation → links to the new artifact page

**What to show:** The artifact page with formatted content. This is a real Notion page you can share.

---

## Screenshot list (for DEV.to or challenge post)

1. **Submit form** — filled out with the hackathon request
2. **Pipeline complete** — success state with Request ID
3. **NVB Inbox in Notion** — Awaiting Review, confidence score visible
4. **NVB Runs page** — showing verdict JSON and exit_status
5. **Human Decision dropdown** — the "Approve" moment
6. **NVB Artifacts** — the promoted artifact page with content blocks
7. **Full board view** — showing the empty state after promotion

---

## What to say in the demo

> "Most AI tools give you outputs and forget about them. NVB treats every AI output as a hypothesis that needs to survive human review. The generator drafts an answer. The auditor finds its weak spots. The clerk normalizes it into a structured verdict. You — the human — decide what actually happens. And Notion is the control plane for all of it."

---

## 90-second video script

| Time | Action | Audio |
|---|---|---|
| 0:00–0:10 | Show the submit form | "This is the inbox. A messy idea enters here." |
| 0:10–0:20 | Submit and show "running" state | "Three LLM passes: generator, auditor, clerk." |
| 0:20–0:40 | Open Notion — NVB Inbox | "Notion is the verdict board. Every item is a structured decision surface." |
| 0:40–0:55 | Open the Run page, scroll through verdict JSON | "The auditor challenged two claims. Confidence: 78%." |
| 0:55–1:05 | Click Human Decision → Approve | "The human decides. Not the model." |
| 1:05–1:20 | Click Promote, open NVB Artifacts | "One click promotes this to a real artifact with citations, caveats, and a full audit trail." |
| 1:20–1:30 | Show the artifact page in Notion | "This is the output. A clean, reviewable document — not a raw LLM dump." |
