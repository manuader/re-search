const APIFY_BASE_URL = "https://api.apify.com/v2";

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not set");
  return token;
}

export interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
  stats?: {
    inputBodyLen?: number;
    restartCount?: number;
  };
  usage?: {
    USD?: number;
  };
}

export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyRunResult> {
  // Apify uses ~ as separator in URLs (e.g., apidojo~tweet-scraper)
  const encodedActorId = actorId.replace("/", "~");
  const res = await fetch(
    `${APIFY_BASE_URL}/acts/${encodedActorId}/runs?token=${getToken()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify start failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.data;
}

export async function getRunStatus(runId: string): Promise<ApifyRunResult> {
  const res = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}?token=${getToken()}`
  );

  if (!res.ok) {
    throw new Error(`Apify status check failed (${res.status})`);
  }

  const data = await res.json();
  return data.data;
}

export async function getDatasetItems(
  datasetId: string,
  limit?: number
): Promise<unknown[]> {
  const params = new URLSearchParams({ token: getToken() });
  if (limit) params.set("limit", String(limit));

  const res = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?${params}`
  );

  if (!res.ok) {
    throw new Error(`Apify dataset download failed (${res.status})`);
  }

  return res.json();
}

export function isRunFinished(status: string): boolean {
  return ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status);
}

export function isRunSucceeded(status: string): boolean {
  return status === "SUCCEEDED";
}
