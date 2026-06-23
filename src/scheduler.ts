import cron from 'node-cron';
import { prisma } from './lib/prisma';
import { runChannelCollect } from './services/collect.service';
import { processChannelReport } from './services/ai.service';
import { generateDailyReport } from './services/report.service';
import { pushAndLog } from './services/feishu.service';

/** 记录 Job 执行状态到日志 */
function logJobStatus(
  jobName: string,
  status: 'start' | 'end' | 'error',
  detail?: string,
): void {
  const ts = new Date().toISOString();
  if (status === 'start') {
    console.log(`[scheduler] ▶ Job 开始 — ${jobName} @ ${ts}`);
  } else if (status === 'end') {
    console.log(`[scheduler] ✅ Job 完成 — ${jobName} @ ${ts}${detail ? ` | ${detail}` : ''}`);
  } else {
    console.error(`[scheduler] ❌ Job 失败 — ${jobName} @ ${ts}: ${detail}`);
  }
}

/**
 * Job 1: 每日 02:00（北京时间）
 * 触发所有 ACTIVE 频道的采集 + AI 处理
 */
async function runCollectJob(): Promise<void> {
  logJobStatus('collect', 'start');
  const jobStart = Date.now();

  try {
    const activeChannels = await prisma.channel.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    if (activeChannels.length === 0) {
      logJobStatus('collect', 'end', '无 ACTIVE 频道');
      return;
    }

    const today = new Date();
    let totalNewItems = 0;

    for (const channel of activeChannels) {
      try {
        const result = await runChannelCollect(channel.id, today);
        totalNewItems += result.newItemCount;
        console.log(
          `[scheduler] 频道采集 — ${channel.name}: 新增 ${result.newItemCount} 条, 耗时 ${result.duration}ms`,
        );

        // 如有新条目，执行 AI 处理
        if (result.newItemCount > 0) {
          await processChannelReport(channel.id, today);
        }
      } catch (err) {
        console.error(`[scheduler] 频道处理失败 — ${channel.name}:`, err);
      }
    }

    logJobStatus('collect', 'end', `总新增 ${totalNewItems} 条, 耗时 ${Date.now() - jobStart}ms`);
  } catch (err) {
    logJobStatus('collect', 'error', String(err));
  }
}

/**
 * Job 2: 每日 08:00（北京时间）
 * 日报生成 + 飞书推送
 */
async function runReportJob(): Promise<void> {
  logJobStatus('report', 'start');
  const jobStart = Date.now();

  try {
    const today = new Date();
    const { content, result } = await generateDailyReport(today);

    if (!result.shouldPush) {
      logJobStatus('report', 'end', `跳过推送: ${result.reason}`);
      return;
    }

    const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
    if (!webhookUrl) {
      logJobStatus('report', 'error', 'FEISHU_WEBHOOK_URL 未配置');
      return;
    }

    await pushAndLog(webhookUrl, content, today);
    logJobStatus('report', 'end', `推送成功, 耗时 ${Date.now() - jobStart}ms`);
  } catch (err) {
    logJobStatus('report', 'error', String(err));
  }
}

/**
 * 初始化并启动 cron 调度任务
 */
export function initScheduler(): void {
  // Job 1: 每日 02:00 北京时间采集
  cron.schedule('0 2 * * *', runCollectJob, {
    timezone: 'Asia/Shanghai',
    name: 'collect-job',
  });

  // Job 2: 每日 08:00 北京时间推送
  cron.schedule('0 8 * * *', runReportJob, {
    timezone: 'Asia/Shanghai',
    name: 'report-job',
  });

  console.log('[scheduler] 调度任务已启动 — 采集: 02:00, 推送: 08:00 (Asia/Shanghai)');
}

// 导出供测试脚本使用
export { runCollectJob, runReportJob };
