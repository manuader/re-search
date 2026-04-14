interface RawDataRow {
  id: string;
  source: string;
  content: Record<string, unknown>;
  ai_fields: Record<string, unknown> | null;
  created_at: string;
}

interface FlattenedResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function flattenRawData(data: RawDataRow[]): FlattenedResult {
  if (data.length === 0) return { columns: [], rows: [] };

  const contentKeys = new Set<string>();
  const aiKeys = new Set<string>();

  for (const row of data) {
    if (row.content && typeof row.content === "object") {
      Object.keys(row.content).forEach((k) => contentKeys.add(k));
    }
    if (row.ai_fields && typeof row.ai_fields === "object") {
      Object.keys(row.ai_fields).forEach((k) => aiKeys.add(k));
    }
  }

  const columns = [
    "source",
    ...Array.from(contentKeys).sort(),
    ...Array.from(aiKeys).sort().map((k) => k.startsWith("ai_") ? k : `ai_${k}`),
  ];

  const rows = data.map((row) => {
    const flat: Record<string, unknown> = { source: row.source };

    for (const key of contentKeys) {
      const val = row.content?.[key];
      flat[key] = typeof val === "object" && val !== null ? JSON.stringify(val) : val;
    }

    for (const key of aiKeys) {
      const colName = key.startsWith("ai_") ? key : `ai_${key}`;
      const val = row.ai_fields?.[key];
      flat[colName] = typeof val === "object" && val !== null ? JSON.stringify(val) : val;
    }

    return flat;
  });

  return { columns, rows };
}
