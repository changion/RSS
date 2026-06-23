import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { RawItem } from '../types';

/**
 * 生成条目的 SHA-256 去重 Hash
 * 基于 link + title + pubDate 的组合
 */
export function generateItemHash(item: Pick<RawItem, 'link' | 'title' | 'pubDate'>): string {
  const raw = `${item.link}|${item.title}|${item.pubDate}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * 过滤掉已存在的条目，返回新增条目列表
 *
 * 查询策略：当日 + 近 7 天的 DailyReport 中已存在的 hash
 * 适合日报场景，避免重复推送同一条情报
 *
 * @param items 待去重的条目列表
 * @returns 新增条目（附带 hash 字段）
 */
export async function filterNewItems(items: RawItem[]): Promise<RawItem[]> {
  if (items.length === 0) return [];

  // 生成所有条目的 hash
  const itemsWithHash = items.map((item) => ({
    ...item,
    hash: generateItemHash(item),
  }));

  // 查询近 7 天已存在的 hash
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const existingReports = await prisma.dailyReport.findMany({
    where: {
      reportDate: { gte: sevenDaysAgo },
    },
    select: { rawItems: true, contentHash: true },
  });

  // 从已有记录中提取所有 item hash
  const existingHashes = new Set<string>();

  for (const report of existingReports) {
    if (report.contentHash) {
      existingHashes.add(report.contentHash);
    }
    try {
      const rawItems: RawItem[] = JSON.parse(report.rawItems);
      for (const item of rawItems) {
        if (item.hash) {
          existingHashes.add(item.hash);
        } else {
          // 兼容没有 hash 的旧数据
          existingHashes.add(generateItemHash(item));
        }
      }
    } catch {
      // 忽略 JSON 解析失败
    }
  }

  const newItems = itemsWithHash.filter((item) => !existingHashes.has(item.hash));

  console.log(
    `[dedup.service] 去重结果 — 原始: ${items.length}，新增: ${newItems.length}，重复: ${items.length - newItems.length}`,
  );

  return newItems;
}
