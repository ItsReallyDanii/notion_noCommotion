/**
 * Type-safe property name constants for all NVB Notion databases.
 *
 * These string literals must exactly match the property names
 * you create in Notion. If you rename a property in Notion,
 * update it here too.
 *
 * NOTE: Notion property names ARE case-sensitive.
 */

// ─── NVB Inbox ────────────────────────────────────────────────────────────────

export const INBOX_PROPS = {
  TITLE: "Title",
  REQUEST_ID: "Request ID",
  REQUEST_TYPE: "Request Type",
  RAW_REQUEST: "Raw Request",
  STATUS: "Status",
  PRIORITY: "Priority",
  WORKFLOW: "Workflow",
  HUMAN_DECISION: "Human Decision",
  CONFIDENCE: "Confidence",
  LATEST_RUN: "Latest Run",
  FINAL_ARTIFACT: "Final Artifact",
  SOURCE_LINKS: "Source Links",
  NOTES: "Notes",
  CREATED_AT: "Created At",
} as const;

export type InboxProp = (typeof INBOX_PROPS)[keyof typeof INBOX_PROPS];

// ─── Status values for NVB Inbox ─────────────────────────────────────────────

export const INBOX_STATUS = {
  QUEUED: "Queued",
  RUNNING: "Running",
  AWAITING_REVIEW: "Awaiting Review",
  APPROVED: "Approved",
  REVISED: "Revised",
  REJECTED: "Rejected",
  PROMOTED: "Promoted",
  ARCHIVED: "Archived",
} as const;

export type InboxStatus = (typeof INBOX_STATUS)[keyof typeof INBOX_STATUS];

// ─── Human Decision values for NVB Inbox ─────────────────────────────────────

export const HUMAN_DECISION_VALUES = {
  PENDING: "Pending",
  APPROVE: "Approve",
  REVISE: "Revise",
  REJECT: "Reject",
  NEEDS_EVIDENCE: "Needs Evidence",
} as const;

// ─── NVB Evidence ─────────────────────────────────────────────────────────────

export const EVIDENCE_PROPS = {
  TITLE: "Title",
  INBOX_ITEM: "Inbox Item",
  EVIDENCE_TYPE: "Evidence Type",
  SOURCE_URL: "Source URL",
  SOURCE_REF: "Source Ref",
  EXCERPT: "Excerpt",
  RELEVANCE: "Relevance",
  CONFIDENCE: "Confidence",
  RETRIEVED_BY: "Retrieved By",
  NOTES: "Notes",
} as const;

export type EvidenceProp = (typeof EVIDENCE_PROPS)[keyof typeof EVIDENCE_PROPS];

// ─── Evidence type values ─────────────────────────────────────────────────────

export const EVIDENCE_TYPE_VALUES = {
  WEB: "Web",
  DOC: "Doc",
  CODE: "Code",
  CLAIM: "Claim",
  COUNTER: "Counter",
  USER_PROVIDED: "User Provided",
} as const;

// ─── NVB Runs ─────────────────────────────────────────────────────────────────

export const RUNS_PROPS = {
  TITLE: "Title",
  INBOX_ITEM: "Inbox Item",
  RUN_TYPE: "Run Type",
  MODEL: "Model",
  PROMPT_VERSION: "Prompt Version",
  STARTED_AT: "Started At",
  FINISHED_AT: "Finished At",
  EXIT_STATUS: "Exit Status",
  CONFIDENCE: "Confidence",
  ERROR_SUMMARY: "Error Summary",
  RAW_JSON: "Raw JSON",
  NOTES: "Notes",
} as const;

export type RunsProp = (typeof RUNS_PROPS)[keyof typeof RUNS_PROPS];

// ─── Run exit status values ───────────────────────────────────────────────────

export const RUN_EXIT_STATUS = {
  APPROVE: "approve",
  REVISE: "revise",
  REJECT: "reject",
  NEEDS_EVIDENCE: "needs_evidence",
  ERROR: "error",
} as const;

// ─── NVB Artifacts ────────────────────────────────────────────────────────────

export const ARTIFACTS_PROPS = {
  TITLE: "Title",
  SOURCE_INBOX_ITEM: "Source Inbox Item",
  ARTIFACT_TYPE: "Artifact Type",
  STATUS: "Status",
  SUMMARY: "Summary",
  NOTION_URL: "Notion URL",
  GITHUB_URL: "GitHub URL",
  PUBLISHED_AT: "Published At",
  NOTES: "Notes",
} as const;

export type ArtifactsProp =
  (typeof ARTIFACTS_PROPS)[keyof typeof ARTIFACTS_PROPS];

// ─── Artifact status values ───────────────────────────────────────────────────

export const ARTIFACT_STATUS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
} as const;
