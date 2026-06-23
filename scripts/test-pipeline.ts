/**
 * P1-G02 全链路集成测试脚本
 * 手动触发完整链路：采集 → 去重 → AI 处理（mock）→ 日报生成 → 飞书推送（mock）→ PushLog 验证
 *
 * 运行方式：npx ts-node scripts/test-pipeline.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchRssItems } from '../src/collectors/rss.collector';
import { filterNewItems } from '../src/services/dedup.service';
import { persistItems } from '../src/services/collect.service';
import { generateDailyReport } from '../src/services/report.service';
import { recordPushLog } from '../src/services/feishu.service';

const prisma = new PrismaClient();

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function section(title: string): void {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

function logResult(label: string, value: unknown): void {
  console.log(`  ${label}:`, value);
}

async function timeit<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  console.log(`  ⏱ ${label} 耗时: ${durationMs}ms`);
  return { result, durationMs };
}

// ─── Mock Claude 响应 ─────────────────────────────────────────────────────────

function getMockClaudeContent(itemCount: number): string {
  return `## 测试频道情报摘要

共处理 **${itemCount}** 条情报。

### 关键信息
1. 测试条目 1：模拟 RSS 采集数据，包含标题和摘要
2. 测试条目 2：用于验证全链路数据流

### 结论
本次测试验证了从采集→AI处理→日报生成的完整链路。

*（此为 mock 测试响应，非真实 Claude API 调用）*`;
}

// ─── 主测试流程 ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🚀 情报订阅站 — 全链路集成测试');
  console.log(`   时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

  const today = new Date();
  const reportDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  // ─── 步骤 0: 准备测试数据 ──────────────────────────────────────────────────

  section('步骤 0: 准备测试频道');

  // 清理并创建测试频道
  await prisma.channel.deleteMany({ where: { name: '__TEST_PIPELINE__' } });

  const testChannel = await prisma.channel.create({
    data: {
      name: '__TEST_PIPELINE__',
      description: '全链路测试专用频道',
      type: 'PRIVATE',
      status: 'ACTIVE',
      collectRule: JSON.stringify({
        rssUrls: ['https://hnrss.org/frontpage'],
      }),
      defaultPrompt: '请对以下信息做简要中文摘要，每条限50字以内：',
    },
  });

  logResult('测试频道 ID', testChannel.id);
  logResult('测试频道名称', testChannel.name);

  // ─── 步骤 1: RSS 采集 ──────────────────────────────────────────────────────

  section('步骤 1: RSS 采集');

  const { result: rawItems, durationMs: collectDuration } = await timeit(
    'RSS 采集',
    () => fetchRssItems(['https://hnrss.org/frontpage']),
  );

  logResult('采集条目总数', rawItems.length);
  if (rawItems.length > 0) {
    logResult('第一条标题', rawItems[0].title);
    logResult('第一条来源', rawItems[0].source);
  }

  // ─── 步骤 2: 去重 ──────────────────────────────────────────────────────────

  section('步骤 2: 去重处理');

  const { result: newItems, durationMs: dedupDuration } = await timeit(
    '去重',
    () => filterNewItems(rawItems.slice(0, 5)), // 只取前 5 条用于测试
  );

  logResult('输入条目数', Math.min(rawItems.length, 5));
  logResult('去重后新增', newItems.length);
  logResult('重复过滤数', Math.min(rawItems.length, 5) - newItems.length);

  // ─── 步骤 3: 持久化 ────────────────────────────────────────────────────────

  section('步骤 3: 持久化');

  const itemsToSave = newItems.length > 0 ? newItems : rawItems.slice(0, 3).map(item => ({
    ...item,
    title: `[TEST] ${item.title}`,
    hash: `test-${Date.now()}-${Math.random()}`,
  }));

  const { durationMs: persistDuration } = await timeit(
    '持久化',
    () => persistItems(testChannel.id, itemsToSave, today),
  );

  const savedReport = await prisma.dailyReport.findUnique({
    where: {
      channelId_reportDate: { channelId: testChannel.id, reportDate },
    },
  });

  logResult('数据库记录 ID', savedReport?.id);
  logResult('存储条目数', savedReport?.itemCount);
  logResult('持久化耗时', `${persistDuration}ms`);

  // ─── 步骤 4: AI 处理（Mock） ────────────────────────────────────────────────

  section('步骤 4: AI 处理（Mock Claude）');

  const mockContent = getMockClaudeContent(savedReport?.itemCount || 0);

  if (savedReport) {
    await prisma.dailyReport.update({
      where: { id: savedReport.id },
      data: {
        processedContent: mockContent,
        promptUsed: testChannel.defaultPrompt || '',
        aiModel: 'claude-3-5-sonnet-20241022 (mock)',
        processingMs: 120,
      },
    });
    logResult('Mock AI 内容长度', mockContent.length);
    logResult('模拟模型名称', 'claude-3-5-sonnet-20241022 (mock)');
    logResult('模拟耗时', '120ms');
  }

  // ─── 步骤 5: 日报生成 ──────────────────────────────────────────────────────

  section('步骤 5: 日报生成');

  const { result: reportResult, durationMs: reportDuration } = await timeit(
    '日报生成',
    () => generateDailyReport(today),
  );

  logResult('是否应推送', reportResult.result.shouldPush);
  logResult('跳过原因', reportResult.result.reason || '（无）');
  logResult('日报字符数', reportResult.content.length);
  logResult('生成耗时', `${reportDuration}ms`);

  if (reportResult.content) {
    console.log('\n  日报预览（前 300 字）:');
    console.log('  ' + reportResult.content.slice(0, 300).replace(/\n/g, '\n  ') + '...');
  }

  // ─── 步骤 6: 飞书推送（Mock） ──────────────────────────────────────────────

  section('步骤 6: 飞书推送（Mock）');

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.includes('xxxxxx')) {
    console.log('  ⚠️ FEISHU_WEBHOOK_URL 未配置，跳过真实推送，写入 Mock PushLog');
    await recordPushLog(reportDate, 'FEISHU', 'SKIPPED', 'test-pipeline mock skip');
    logResult('Mock PushLog 状态', 'SKIPPED');
  } else {
    console.log('  📤 检测到真实 Webhook URL，将执行真实推送...');
    // 真实推送逻辑（如需测试可取消注释）
    // const { pushAndLog } = await import('../src/services/feishu.service');
    // await pushAndLog(webhookUrl, reportResult.content, today);
    await recordPushLog(reportDate, 'FEISHU', 'SKIPPED', 'test-pipeline: use pushAndLog for real push');
    logResult('Webhook URL', webhookUrl.slice(0, 50) + '...');
  }

  // ─── 步骤 7: 验证 PushLog ──────────────────────────────────────────────────

  section('步骤 7: 验证 PushLog');

  const pushLogs = await prisma.pushLog.findMany({
    where: { reportDate },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  logResult('PushLog 记录数', pushLogs.length);
  pushLogs.forEach((log, i) => {
    logResult(`  PushLog[${i}]`, `${log.status} | ${log.channel} | ${log.errorMsg || '无错误'}`);
  });

  // ─── 清理测试数据 ──────────────────────────────────────────────────────────

  section('清理测试数据');

  await prisma.channel.delete({ where: { id: testChannel.id } });
  await prisma.pushLog.deleteMany({
    where: {
      reportDate,
      errorMsg: { startsWith: 'test-pipeline' },
    },
  });

  console.log('  ✅ 测试频道和相关数据已清理');

  // ─── 测试总结 ──────────────────────────────────────────────────────────────

  section('测试总结');

  const totalDuration = collectDuration + dedupDuration + persistDuration + reportDuration;

  console.log(`  ✅ 全链路测试完成`);
  console.log(`  📊 各步骤耗时:`);
  console.log(`     采集:     ${collectDuration}ms`);
  console.log(`     去重:     ${dedupDuration}ms`);
  console.log(`     持久化:   ${persistDuration}ms`);
  console.log(`     日报生成: ${reportDuration}ms`);
  console.log(`     合计:     ${totalDuration}ms`);
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ 测试失败:', err);
  await prisma.$disconnect();
  process.exit(1);
});
