import { Octokit } from "@octokit/rest";
import type { Verdict } from "@nvb/schema";

/**
 * GitHub integration for NVB.
 *
 * Status: STUB — scaffolded but not wired into promote workflow yet.
 *
 * To implement:
 * 1. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in .env
 * 2. Call createGitHubIssue from promote workflow when create_github_artifact=true
 * 3. Add "files" artifact type: createGitHubDoc creates a file via the contents API
 *
 * Required GitHub token scopes:
 * - issues:write (for issues)
 * - contents:write (for file creation)
 *
 * Use fine-grained PATs scoped to specific repos for production.
 */

function getOctokit(): Octokit {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set. " +
        "Create a fine-grained PAT at https://github.com/settings/tokens."
    );
  }
  return new Octokit({ auth: token });
}

export interface GitHubIssueResult {
  url: string;
  number: number;
}

/**
 * Creates a GitHub issue from a verdict.
 * The issue body includes the unified_answer and citations.
 */
export async function createGitHubIssue(
  verdict: Verdict,
  title: string
): Promise<GitHubIssueResult> {
  const owner = process.env["GITHUB_OWNER"];
  const repo = process.env["GITHUB_REPO"];

  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO must be set in .env.");
  }

  const octokit = getOctokit();

  const body = buildIssueBody(verdict);

  const response = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
    labels: ["nvb-artifact", verdict.exit_status],
  });

  return {
    url: response.data.html_url,
    number: response.data.number,
  };
}

function buildIssueBody(verdict: Verdict): string {
  const lines: string[] = [
    `## Verdict`,
    ``,
    verdict.unified_answer,
    ``,
    `---`,
    ``,
    `**Confidence:** ${(verdict.confidence * 100).toFixed(0)}%`,
    `**Exit status:** ${verdict.exit_status}`,
    `**Generated at:** ${verdict.generated_at}`,
    ``,
  ];

  if (verdict.citations.length > 0) {
    lines.push(`## Citations`, ``);
    for (const c of verdict.citations) {
      lines.push(c.url ? `- [${c.label}](${c.url})` : `- ${c.label}`);
    }
    lines.push(``);
  }

  if (verdict.notes) {
    lines.push(`## Notes`, ``, verdict.notes, ``);
  }

  lines.push(
    `---`,
    `*Created by [Notion Verdict Board](https://github.com/your-org/notion-verdict-board)*`
  );

  return lines.join("\n");
}

// TODO: createGitHubDoc — creates a markdown file via contents API
// Signature: createGitHubDoc(verdict: Verdict, path: string): Promise<{ url: string }>
