import { queryAwaitingReview } from "@nvb/notion";

// Server component — reads directly from Notion, no client-side fetching needed.
// Revalidate every 30 seconds so the board refreshes on page load.
export const revalidate = 30;

export default async function BoardPage() {
  let items: Array<{
    id: string;
    title: string;
    confidence: number | null;
    created: string;
  }> = [];
  let fetchError: string | null = null;

  try {
    items = await queryAwaitingReview();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load board";
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Verdict Board</h2>
          <p className="text-gray-400 text-sm">
            Items awaiting human review. Open each in Notion to set Human
            Decision.
          </p>
        </div>
        <form method="GET">
          <button
            type="submit"
            className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </form>
      </div>

      {fetchError ? (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded p-4">
          {fetchError}
          <p className="mt-2 text-gray-500">
            Check that NOTION_TOKEN and NOTION_DB_INBOX are set correctly.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-lg font-medium text-gray-400">No items awaiting review</p>
          <p className="text-sm mt-2">
            Submit a request to get started, or check Notion for any items you
            may have already reviewed.
          </p>
          <a
            href="/"
            className="inline-block mt-4 text-sm px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 transition-colors text-white"
          >
            Submit a request
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <BoardItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardItem({
  item,
}: {
  item: { id: string; title: string; confidence: number | null; created: string };
}) {
  const conf = item.confidence;
  const confPct = conf !== null ? Math.round(conf * 100) : null;
  const confColor =
    conf === null
      ? "text-gray-500"
      : conf >= 0.75
      ? "text-green-400"
      : conf >= 0.5
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{item.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {new Date(item.created).toLocaleString()}
        </p>
      </div>
      <div className="ml-4 flex items-center gap-4 shrink-0">
        {confPct !== null && (
          <span className={`text-sm font-mono ${confColor}`}>
            {confPct}% conf
          </span>
        )}
        <PromoteButton inboxPageId={item.id} />
      </div>
    </div>
  );
}

// Client promote button — inline because the board is mostly server-rendered
function PromoteButton({ inboxPageId }: { inboxPageId: string }) {
  // This is a server component, so we use a form + server action
  // to trigger promotion after human sets Approve in Notion.
  // The API route /api/promote handles the actual work.
  return (
    <form action="/api/promote" method="POST" className="inline">
      <input type="hidden" name="inbox_page_id" value={inboxPageId} />
      <input type="hidden" name="create_github_artifact" value="false" />
      <button
        type="submit"
        className="text-xs px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 transition-colors"
      >
        Promote →
      </button>
    </form>
  );
}
