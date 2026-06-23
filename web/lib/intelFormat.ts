/**
 * 将「原文：https://...」转为 Markdown 可点击链接
 */
export function makeSourceLinksClickable(content: string): string {
  return content.replace(
    /^原文：(?!\[)(https?:\/\/\S+)/gm,
    '原文：[$1]($1)',
  );
}

export interface IntelItem {
  title: string;
  summary?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  time?: string;
}

function parseIntelBlock(block: string): IntelItem | null {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let title = '';
  let summary = '';
  let sourceLabel = '';
  let sourceUrl = '';
  let time = '';

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      title = h3[1].trim();
      continue;
    }
    const sum = line.match(/^摘要[：:]\s*(.+)/);
    if (sum) {
      summary = sum[1].trim();
      continue;
    }
    const src = line.match(/^原文[：:]\s*(.+)/);
    if (src) {
      sourceLabel = src[1].trim();
      const urlMatch = sourceLabel.match(/https?:\/\/\S+/);
      if (urlMatch) sourceUrl = urlMatch[0].replace(/[)\],.]+$/, '');
      continue;
    }
    const t = line.match(/^时间[：:]\s*(.+)/);
    if (t) {
      time = t[1].trim();
      continue;
    }
  }

  if (!title && !summary) return null;
  return {
    title: title || '情报条目',
    summary: summary || undefined,
    sourceLabel: sourceLabel || undefined,
    sourceUrl: sourceUrl || undefined,
    time: time || undefined,
  };
}

/** 将 processedContent 解析为独立情报卡片条目 */
export function parseIntelItems(content: string): IntelItem[] {
  const normalized = content.trim();
  if (!normalized) return [];

  const byDivider = normalized
    .split(/\n---+\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const blocks =
    byDivider.length > 1
      ? byDivider
      : normalized
          .split(/(?=^###\s)/m)
          .map((b) => b.trim())
          .filter(Boolean);

  const items = blocks
    .map(parseIntelBlock)
    .filter((item): item is IntelItem => item !== null);

  return items;
}
