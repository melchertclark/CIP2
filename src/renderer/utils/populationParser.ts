export interface PopulationEntry {
  category: string;
  count: number;
}

/**
 * Parses a pasted population table (tab- or space-separated) into entries.
 * Skips header line starting with FIELD_INTEREST and ignores rows with insufficient columns.
 */
export function parsePopulationTable(text: string): PopulationEntry[] {
  const SEP_REGEX = /\t+|\s{2,}/;
  const entries: PopulationEntry[] = [];
  const lines = text.trim().split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^FIELD_INTEREST\b/.test(trimmed)) continue;
    const cols = trimmed.split(SEP_REGEX);
    if (cols.length < 3) continue;
    const category = cols[0].trim();
    const count = parseInt(cols[1].replace(/,/g, ''), 10);
    if (isNaN(count)) continue;
    entries.push({ category, count });
  }
  return entries;
}