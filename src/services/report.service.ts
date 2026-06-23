import { prisma } from '../lib/prisma';
import { PushResult } from '../types';

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 生成全局每日情报日报（兼容 Phase 1，汇总所有 ACTIVE 频道）
 *
 * @param date 报告日期
 */
export async function generateDailyReport(date: Date): Promise<{
  content: string;
  result: PushResult;
}> {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const activeChannels = await prisma.channel.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  if (activeChannels.length === 0) {
    return {
      content: '',
      result: { shouldPush: false, reason: 'no active channels' },
    };
  }

  // 查询全局报告（userId 为 null）
  const reports = await prisma.dailyReport.findMany({
    where: {
      channelId: { in: activeChannels.map((c) => c.id) },
      reportDate: targetDate,
      userId: null,
    },
  });

  const totalItemCount = reports.reduce((sum, r) => sum + r.itemCount, 0);

  if (totalItemCount === 0) {
    await prisma.pushLog.create({
      data: {
        reportDate: targetDate,
        channel: 'FEISHU',
        status: 'SKIPPED',
        errorMsg: 'no new items today',
      },
    });

    console.log(`[report.service] 今日无新增条目，跳过推送 — date: ${formatDate(targetDate)}`);

    return {
      content: '',
      result: { shouldPush: false, reason: 'no new items today' },
    };
  }

  const content = buildReportContent(targetDate, activeChannels, reports);

  console.log(
    `[report.service] 全局日报生成完成 — date: ${formatDate(targetDate)}, 频道数: ${reports.length}, 总条目: ${totalItemCount}`,
  );

  return { content, result: { shouldPush: true } };
}

/**
 * 生成指定用户的个人日报
 * 只聚合该用户 ACTIVE 订阅的频道内容
 *
 * @param userId 用户 ID
 * @param date 报告日期
 */
export async function generateUserDailyReport(
  userId: string,
  date: Date,
): Promise<{ content: string; result: PushResult }> {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  // 查询用户的 ACTIVE 订阅
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { channel: { select: { id: true, name: true, status: true } } },
  });

  const activeChannels = activeSubscriptions
    .filter((s) => s.channel.status === 'ACTIVE')
    .map((s) => ({ id: s.channel.id, name: s.channel.name }));

  if (activeChannels.length === 0) {
    return {
      content: '',
      result: { shouldPush: false, reason: 'no active subscriptions' },
    };
  }

  // 优先查询用户专属报告，回退到全局报告
  const reports = await prisma.dailyReport.findMany({
    where: {
      channelId: { in: activeChannels.map((c) => c.id) },
      reportDate: targetDate,
      OR: [{ userId }, { userId: null }],
    },
    orderBy: [{ userId: 'desc' }], // userId 非 null 的优先
  });

  // 每个 channelId 取用户专属报告（userId 非 null）优先
  const reportMap = new Map<string, (typeof reports)[0]>();
  for (const r of reports) {
    const existing = reportMap.get(r.channelId);
    if (!existing || r.userId !== null) {
      reportMap.set(r.channelId, r);
    }
  }

  const dedupedReports = Array.from(reportMap.values());
  const totalItemCount = dedupedReports.reduce((sum, r) => sum + r.itemCount, 0);

  if (totalItemCount === 0) {
    return {
      content: '',
      result: { shouldPush: false, reason: 'no new items today' },
    };
  }

  const content = buildReportContent(targetDate, activeChannels, dedupedReports);

  console.log(
    `[report.service] 用户日报生成完成 — userId: ${userId}, date: ${formatDate(targetDate)}, 频道数: ${dedupedReports.length}`,
  );

  return { content, result: { shouldPush: true } };
}

/**
 * 遍历所有有 ACTIVE 订阅的用户，分别生成日报
 * 返回 { userId, content, result }[]
 */
export async function generateAllUserReports(
  date: Date,
): Promise<{ userId: string; content: string; result: PushResult }[]> {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  // 查询有 ACTIVE 订阅的用户
  const activeUserIds = await prisma.subscription
    .findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
      distinct: ['userId'],
    })
    .then((rows) => rows.map((r) => r.userId));

  if (activeUserIds.length === 0) {
    console.log(`[report.service] 无有效订阅用户 — date: ${formatDate(targetDate)}`);
    return [];
  }

  const results = await Promise.all(
    activeUserIds.map(async (userId) => {
      const { content, result } = await generateUserDailyReport(userId, date);
      return { userId, content, result };
    }),
  );

  return results;
}

/**
 * 构建报告 Markdown 内容
 */
function buildReportContent(
  date: Date,
  channels: { id: string; name: string }[],
  reports: { channelId: string; processedContent: string | null; itemCount: number }[],
): string {
  const dateStr = formatDate(date);
  const sections: string[] = [`# 情报日报 ${dateStr}`, ''];
  const channelMap = new Map(channels.map((c) => [c.id, c.name]));

  for (const report of reports) {
    if (!report.processedContent || report.itemCount === 0) continue;
    const channelName = channelMap.get(report.channelId) || report.channelId;
    sections.push(`## ${channelName}`, '', report.processedContent, '', '---', '');
  }

  return sections.join('\n');
}
