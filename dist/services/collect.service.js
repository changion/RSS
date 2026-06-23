"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistItems = persistItems;
exports.runChannelCollect = runChannelCollect;
const prisma_1 = require("../lib/prisma");
const rss_collector_1 = require("../collectors/rss.collector");
const apk_collector_1 = require("../collectors/apk.collector");
const dedup_service_1 = require("./dedup.service");
/**
 * 解析频道的 collectRule JSON
 */
function parseCollectRule(ruleJson) {
    try {
        return JSON.parse(ruleJson);
    }
    catch {
        return {};
    }
}
/**
 * 根据频道类型执行采集
 */
async function collectByRule(rule) {
    const items = [];
    if (rule.rssUrls && rule.rssUrls.length > 0) {
        const rssItems = await (0, rss_collector_1.fetchRssItems)(rule.rssUrls);
        items.push(...rssItems);
    }
    if (rule.packageNames && rule.packageNames.length > 0) {
        const apkItems = await (0, apk_collector_1.collectApkChanges)(rule.packageNames);
        items.push(...apkItems);
    }
    // 兼容旧版 apk 格式
    if (rule.type === 'apk') {
        const apkRule = (0, apk_collector_1.parseApkRule)(JSON.stringify(rule));
        if (apkRule.packageNames.length > 0) {
            const apkItems = await (0, apk_collector_1.collectApkChanges)(apkRule.packageNames);
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
async function persistItems(channelId, items, date) {
    // 规范化日期，只保留日期部分（UTC 00:00:00）
    const reportDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // 查询全局报告（userId=null），这是 Phase 1 采集写入的主报告
    const existing = await prisma_1.prisma.dailyReport.findFirst({
        where: { channelId, reportDate, userId: null },
    });
    if (existing) {
        // 合并追加
        const existingItems = JSON.parse(existing.rawItems);
        const merged = [...existingItems, ...items];
        await prisma_1.prisma.dailyReport.update({
            where: { id: existing.id },
            data: {
                rawItems: JSON.stringify(merged),
                itemCount: merged.length,
            },
        });
        console.log(`[collect.service] upsert 更新 — channelId: ${channelId}, 追加 ${items.length} 条, 总计 ${merged.length} 条`);
    }
    else {
        await prisma_1.prisma.dailyReport.create({
            data: {
                channelId,
                reportDate,
                rawItems: JSON.stringify(items),
                itemCount: items.length,
            },
        });
        console.log(`[collect.service] 新建记录 — channelId: ${channelId}, ${items.length} 条`);
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
async function runChannelCollect(channelId, date) {
    const start = Date.now();
    const targetDate = date || new Date();
    try {
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel)
            throw new Error(`频道不存在: ${channelId}`);
        if (channel.status !== 'ACTIVE') {
            return { newItemCount: 0, duration: Date.now() - start };
        }
        const rule = parseCollectRule(channel.collectRule);
        const rawItems = await collectByRule(rule);
        const newItems = await (0, dedup_service_1.filterNewItems)(rawItems);
        if (newItems.length > 0) {
            await persistItems(channelId, newItems, targetDate);
        }
        return { newItemCount: newItems.length, duration: Date.now() - start };
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[collect.service] 频道采集失败 — channelId: ${channelId}`, error);
        return { newItemCount: 0, duration: Date.now() - start, error };
    }
}
//# sourceMappingURL=collect.service.js.map