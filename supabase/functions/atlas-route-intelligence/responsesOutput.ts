/** Extracts structured text from the raw Responses REST payload (the SDK-only output_text shortcut is optional). */
export function extractResponsesOutputText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (response.status !== undefined && response.status !== "completed") return null;
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  if (!Array.isArray(response.output)) return null;
  const fragments = response.output.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object" || Array.isArray(part)) return [];
      const row = part as Record<string, unknown>;
      return row.type === "output_text" && typeof row.text === "string" && row.text.trim() ? [row.text.trim()] : [];
    });
  });
  return fragments.length ? fragments.join("\n") : null;
}
