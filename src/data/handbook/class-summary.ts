/** Разбор legacy summary «Кость хитов d8. Спасброски: Ловкость, Харизма». */

export function parseClassSummary(summary: string): {
  text: string;
  savingThrows: string[];
} {
  const raw = summary.trim();
  if (!raw) return { text: '', savingThrows: [] };

  const savesMatch = raw.match(/Спасброски:\s*:?\s*(.+)$/i);
  const savingThrows = savesMatch
    ? savesMatch[1]
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

  const text = raw
    .replace(/Кость хитов\s+[^.。]+[。.]\s*/gi, '')
    .replace(/Спасброски:\s*:?\s*.+$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim();

  return { text, savingThrows };
}
