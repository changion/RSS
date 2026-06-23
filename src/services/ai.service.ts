import { prisma } from '../lib/prisma';
import { callAI } from './claude.service';
import { enqueueAITask } from './aiQueue.service';
import { RawItem } from '../types';

const SYSTEM_PROMPT_PREFIX = `你是一个出海App行业情报助手。请对以下内容进行结构化处理，输出格式严格遵守：

每条情报独立成块，块与块之间用 --- 分隔。单条格式如下（标签前缀必须保留）：

### [标题]

摘要：[2-3句话，概括核心观点或关键信息，突出对出海App从业者的价值]

原文：[必须使用对应条目「链接」字段的完整 URL，禁止编造或修改]

时间：[YYYY-MM-DD，优先使用条目「时间」字段，缺失则用采集日期]

---

示例（仅示意格式，内容须来自实际条目）：
### Google Play 政策更新：数据安全表单强制填写

摘要：Google 要求所有应用在下月前完成数据安全表单更新，未完成将面临下架风险。出海开发者需核对第三方 SDK 的数据收集声明。

原文：https://example.com/article/123

时间：2025-04-22

---

处理要求：
- 只保留有实质信息价值的条目，过滤掉广告、招聘、无实质内容的文章
- 不要复述标题，摘要要说"这意味着什么"或"关键数据/政策是什么"
- 原文链接必须逐字复制待处理内容中该条目的「链接」字段，不得替换为示例域名
- 时间格式固定为 YYYY-MM-DD，不得输出「发布时间」等占位文字
- 如果所有条目都没有价值，输出：「本期无重要情报」
- 不要添加任何介绍性语言或频道标题，直接输出条目列表`;

/**
 * 将 RawItem 列表格式化为 AI 处理的上下文字符串
 * 每条包含标题、链接、发布时间、内容（前 500 字）
 */
function formatItemsAsContext(items: RawItem[]): string {
  if (items.length === 0) return '（无新增条目）';

  return items
    .map(
      (item, index) =>
        `### ${index + 1}. ${item.title}\n` +
        `- 链接（原文必须使用该 URL）：${item.link}\n` +
        `- 时间（输出格式 YYYY-MM-DD）：${item.pubDate}\n` +
        `- 正文：${item.content.slice(0, 500)}${item.content.length > 500 ? '...' : ''}`,
    )
    .join('\n\n');
}

/**
 * 构建发送给 AI 的系统 Prompt
 * 系统前缀固定，频道 defaultPrompt 作为「关注重点补充」追加
 * context（待处理内容）由 callAI 负责拼接
 */
function buildSystemPrompt(channelDefaultPrompt: string | null): string {
  if (channelDefaultPrompt) {
    return `${SYSTEM_PROMPT_PREFIX}

[频道关注重点]
${channelDefaultPrompt}`;
  }
  return SYSTEM_PROMPT_PREFIX;
}

/**
 * 处理单个频道的日报 AI 分析
 * 从数据库读取频道配置和原始条目，调用 Claude 处理，写回结果
 *
 * @param channelId 频道 ID
 * @param reportDate 报告日期
 */
export async function processChannelReport(
  channelId: string,
  reportDate: Date,
): Promise<void> {
  const startMs = Date.now();

  // 规范化日期
  const targetDate = new Date(
    Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate()),
  );

  const [channel, report] = await Promise.all([
    prisma.channel.findUnique({ where: { id: channelId } }),
    prisma.dailyReport.findFirst({
      where: { channelId, reportDate: targetDate, userId: null },
    }),
  ]);

  if (!channel) throw new Error(`频道不存在: ${channelId}`);
  if (!report) {
    console.warn(`[ai.service] 无当日报告 — channelId: ${channelId}, date: ${targetDate.toISOString()}`);
    return;
  }

  if (report.itemCount === 0) {
    console.log(`[ai.service] 无新条目，跳过 AI 处理 — channelId: ${channelId}`);
    return;
  }

  // P2-J02：优先查找用户的已审批自定义 Prompt（仅作为「关注重点」覆盖频道默认值）
  // report.userId 为空时走全局逻辑
  let channelFocusPrompt: string | null = channel.defaultPrompt;
  if (report.userId) {
    const customSub = await prisma.subscription.findFirst({
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
      channelFocusPrompt = customSub.customPrompt;
      console.log(`[ai.service] 使用用户自定义 Prompt — userId: ${report.userId}, channelId: ${channelId}`);
    }
  }

  // 系统级前缀固定，频道关注重点追加，形成完整 prompt
  const prompt = buildSystemPrompt(channelFocusPrompt);

  const rawItems: RawItem[] = JSON.parse(report.rawItems);
  const context = `[待处理内容]\n${formatItemsAsContext(rawItems)}`;

  console.log(
    `[ai.service] 开始 AI 处理 — channelId: ${channelId}, 条目数: ${rawItems.length}`,
  );

  // 通过队列控制并发
  const result = await enqueueAITask(() => callAI(prompt, context));

  const processingMs = Date.now() - startMs;

  await prisma.dailyReport.update({
    where: { id: report.id },
    data: {
      processedContent: result.content,
      promptUsed: prompt,
      aiModel: result.model,
      processingMs,
    },
  });

  console.log(
    `[ai.service] AI 处理完成 — channelId: ${channelId}, 耗时: ${processingMs}ms, 模型: ${result.model}`,
  );
}

/**
 * 批量处理多个频道的 AI 分析（通过队列控制并发）
 *
 * @param channelIds 频道 ID 列表
 * @param reportDate 报告日期
 */
export async function processAllChannelReports(
  channelIds: string[],
  reportDate: Date,
): Promise<void> {
  const tasks = channelIds.map((channelId) =>
    processChannelReport(channelId, reportDate).catch((err) => {
      console.error(`[ai.service] 频道处理失败 — channelId: ${channelId}`, err);
    }),
  );

  await Promise.all(tasks);
}
