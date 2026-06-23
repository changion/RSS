import { prisma } from '../lib/prisma';
import { RawItem } from '../types';
import { fetchRssItems } from '../collectors/rss.collector';
import { collectApkChanges, parseApkRule } from '../collectors/apk.collector';
import { scrapeTargets, ScrapeTarget } from '../collectors/scrape.collector';
import { filterNewItems } from './dedup.service';

/** 频道采集规则结构 */
interface CollectRule {
  type?: 'rss' | 'apk' | 'scrape' | 'mixed';
  /** 新格式：当 type 存在时使用 */
  urls?: string[];
  /** 旧格式：无 type 字段时使用 */
  rssUrls?: string[];
  packageNames?: string[];
  /** scrape 类型：网页抓取目标列表 */
  targets?: ScrapeTarget[];
}

/**
 * 解析频道的 collectRule JSON
 */
function parseCollectRule(ruleJson: string): CollectRule {
  try {
    return JSON.parse(ruleJson) as CollectRule;
  } catch {
    return {};
  }
}

/**
 * 根据频道类型执行采集
 */
async function collectByRule(rule: CollectRule): Promise<RawItem[]> {
  const items: RawItem[] = [];

  // 兼容两种 RSS 格式：
  //   新格式 {"type":"rss","urls":[...]}
  //   旧格式 {"rssUrls":[...]}
  const rssUrls = rule.urls?.length ? rule.urls : (rule.rssUrls ?? []);
  if (rssUrls.length > 0) {
    const rssItems = await fetchRssItems(rssUrls);
    items.push(...rssItems);
  }

  // 网页抓取格式 {"type":"scrape","targets":[...]}
  if (rule.targets && rule.targets.length > 0) {
    const scrapedItems = await scrapeTargets(rule.targets);
    items.push(...scrapedItems);
  }

  if (rule.packageNames && rule.packageNames.length > 0) {
    const apkItems = await collectApkChanges(rule.packageNames);
    items.push(...apkItems);
  }

  // 兼容旧版 apk 格式（type=apk 但无 packageNames 顶层字段）
  if (rule.type === 'apk') {
    const apkRule = parseApkRule(JSON.stringify(rule));
    if (apkRule.packageNames.length > 0) {
      const apkItems = await collectApkChanges(apkRule.packageNames);
      items.push(...apkItems);
    }
  }

  return items;
}

/**
 * 持久化新增条目到指定频道的当日 DailyReport
 * 若当日已有记录则 upsert（合并追加）
 *
 * @param channelId 频道 ID
 * @param items 新增条目（已去重）
 * @param date 报告日期
 */
export async function persistItems(
  channelId: string,
  items: RawItem[],
  date: Date,
): Promise<void> {
  // 规范化日期，只保留日期部分（UTC 00:00:00）
  const reportDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  // 查询全局报告（userId=null），这是 Phase 1 采集写入的主报告
  const existing = await prisma.dailyReport.findFirst({
    where: { channelId, reportDate, userId: null },
  });

  if (existing) {
    // 合并追加
    const existingItems: RawItem[] = JSON.parse(existing.rawItems);
    const merged = [...existingItems, ...items];

    await prisma.dailyReport.update({
      where: { id: existing.id },
      data: {
        rawItems: JSON.stringify(merged),
        itemCount: merged.length,
      },
    });
    console.log(
      `[collect.service] upsert 更新 — channelId: ${channelId}, 追加 ${items.length} 条, 总计 ${merged.length} 条`,
    );
  } else {
    await prisma.dailyReport.create({
      data: {
        channelId,
        reportDate,
        rawItems: JSON.stringify(items),
        itemCount: items.length,
      },
    });
    console.log(
      `[collect.service] 新建记录 — channelId: ${channelId}, ${items.length} 条`,
    );
  }
}

/**
 * 执行单个频道的完整采集流程：
 * 获取采集规则 → 执行采集 → 去重 → 持久化
 *
 * @param channelId 频道 ID
 * @param date 采集日期（默认今日）
 * @returns 新增条目数量和耗时
 */
export async function runChannelCollect(
  channelId: string,
  date?: Date,
): Promise<{ newItemCount: number; duration: number; error?: string }> {
  const start = Date.now();
  const targetDate = date || new Date();

  try {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error(`频道不存在: ${channelId}`);
    if (channel.status !== 'ACTIVE') {
      return { newItemCount: 0, duration: Date.now() - start };
    }

    const rule = parseCollectRule(channel.collectRule);
    const rawItems = await collectByRule(rule);
    const newItems = await filterNewItems(rawItems);

    if (newItems.length > 0) {
      await persistItems(channelId, newItems, targetDate);
    }

    return { newItemCount: newItems.length, duration: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[collect.service] 频道采集失败 — channelId: ${channelId}`, error);
    return { newItemCount: 0, duration: Date.now() - start, error };
  }
}
