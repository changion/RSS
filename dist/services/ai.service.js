"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processChannelReport = processChannelReport;
exports.processAllChannelReports = processAllChannelReports;
const prisma_1 = require("../lib/prisma");
const claude_service_1 = require("./claude.service");
const aiQueue_service_1 = require("./aiQueue.service");
const DEFAULT_PROMPT = `你是一个情报分析助手。请对以下采集到的情报条目进行整理和分析，输出结构清晰的中文摘要报告。

要求：
1. 提取关键信息点，去除冗余
2. 按重要性排序
3. 用简洁的 Markdown 格式输出
4. 突出关键变化和趋势
5. 不要编造信息，只基于提供的内容进行分析`;
/**
 * 将 RawItem 列表格式化为 AI 处理的上下文字符串
 */
function formatItemsAsContext(items) {
    if (items.length === 0)
        return '（无新增条目）';
    return items
        .map((item, index) => `### ${index + 1}. ${item.title}\n` +
        `- 来源：${item.source}\n` +
        `- 链接：${item.link}\n` +
        `- 时间：${item.pubDate}\n` +
        `- 内容摘要：${item.content.slice(0, 300)}${item.content.length > 300 ? '...' : ''}`)
        .join('\n\n');
}
/**
 * 处理单个频道的日报 AI 分析
 * 从数据库读取频道配置和原始条目，调用 Claude 处理，写回结果
 *
 * @param channelId 频道 ID
 * @param reportDate 报告日期
 */
async function processChannelReport(channelId, reportDate) {
    const startMs = Date.now();
    // 规范化日期
    const targetDate = new Date(Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate()));
    const [channel, report] = await Promise.all([
        prisma_1.prisma.channel.findUnique({ where: { id: channelId } }),
        prisma_1.prisma.dailyReport.findFirst({
            where: { channelId, reportDate: targetDate, userId: null },
        }),
    ]);
    if (!channel)
        throw new Error(`频道不存在: ${channelId}`);
    if (!report) {
        console.warn(`[ai.service] 无当日报告 — channelId: ${channelId}, date: ${targetDate.toISOString()}`);
        return;
    }
    if (report.itemCount === 0) {
        console.log(`[ai.service] 无新条目，跳过 AI 处理 — channelId: ${channelId}`);
        return;
    }
    // P2-J02：优先查找用户的已审批自定义 Prompt
    // report.userId 为空时走全局逻辑
    let prompt = channel.defaultPrompt || DEFAULT_PROMPT;
    if (report.userId) {
        const customSub = await prisma_1.prisma.subscription.findFirst({
            where: {
                userId: report.userId,
                channelId,
                status: 'ACTIVE',
                promptStatus: 'APPROVED',
                customPrompt: { not: null },
            },
            select: { customPrompt: true },
        });
        if (customSub?.customPrompt) {
            prompt = customSub.customPrompt;
            console.log(`[ai.service] 使用用户自定义 Prompt — userId: ${report.userId}, channelId: ${channelId}`);
        }
    }
    const rawItems = JSON.parse(report.rawItems);
    const context = formatItemsAsContext(rawItems);
    console.log(`[ai.service] 开始 AI 处理 — channelId: ${channelId}, 条目数: ${rawItems.length}`);
    // 通过队列控制并发
    const result = await (0, aiQueue_service_1.enqueueAITask)(() => (0, claude_service_1.callAI)(prompt, context));
    const processingMs = Date.now() - startMs;
    await prisma_1.prisma.dailyReport.update({
        where: { id: report.id },
        data: {
            processedContent: result.content,
            promptUsed: prompt,
            aiModel: result.model,
            processingMs,
        },
    });
    console.log(`[ai.service] AI 处理完成 — channelId: ${channelId}, 耗时: ${processingMs}ms, 模型: ${result.model}`);
}
/**
 * 批量处理多个频道的 AI 分析（通过队列控制并发）
 *
 * @param channelIds 频道 ID 列表
 * @param reportDate 报告日期
 */
async function processAllChannelReports(channelIds, reportDate) {
    const tasks = channelIds.map((channelId) => processChannelReport(channelId, reportDate).catch((err) => {
        console.error(`[ai.service] 频道处理失败 — channelId: ${channelId}`, err);
    }));
    await Promise.all(tasks);
}
//# sourceMappingURL=ai.service.js.map