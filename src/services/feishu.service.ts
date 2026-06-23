import axios from 'axios';
import PQueue from 'p-queue';
import { prisma } from '../lib/prisma';
import { makeSourceLinksClickable } from '../utils/intelFormat';

// AI 输出的每条情报含摘要+原文链接+时间，设置足够大避免截断链接
const MAX_SECTION_LENGTH = 2000;

/** 飞书 Webhook 频率限制：约 5 次/秒，保守使用 1.5 秒间隔 */
const FEISHU_MIN_INTERVAL_MS = 1500;
const FEISHU_MAX_RETRIES = 3;

const feishuQueue = new PQueue({
  concurrency: 1,
  interval: FEISHU_MIN_INTERVAL_MS,
  intervalCap: 1,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFeishuRateLimitError(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const code = (data as { code?: number }).code;
  return code === 11232;
}

/**
 * 串行发送飞书 Webhook，带间隔与限频重试
 */
async function postFeishuWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<void> {
  await feishuQueue.add(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= FEISHU_MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          timeout: timeoutMs,
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.data?.code !== 0 && response.data?.StatusCode !== 0) {
          if (isFeishuRateLimitError(response.data) && attempt < FEISHU_MAX_RETRIES) {
            const backoffMs = FEISHU_MIN_INTERVAL_MS * (attempt + 2);
            console.warn(
              `[feishu.service] 触发限频，${backoffMs}ms 后重试 (${attempt + 1}/${FEISHU_MAX_RETRIES})`,
            );
            await sleep(backoffMs);
            continue;
          }
          throw new Error(`飞书 Webhook 返回错误: ${JSON.stringify(response.data)}`);
        }

        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < FEISHU_MAX_RETRIES) {
          await sleep(FEISHU_MIN_INTERVAL_MS * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('飞书 Webhook 发送失败');
  });
}

/** 飞书卡片内容块 */
interface FeishuCardElement {
  tag: string;
  content?: string;
  text?: { tag: string; content: string };
}

/**
 * 截断字符串到指定长度，在段落边界截断避免切断链接
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // 尝试在 `---` 分割线处截断，保证每条情报完整
  const cutPoint = text.lastIndexOf('\n---\n', maxLen);
  const safePoint = cutPoint > 0 ? cutPoint : maxLen;
  return text.slice(0, safePoint) + '\n\n（更多内容请查看系统后台）';
}

/**
 * 将 Markdown 日报转换为飞书 interactive card（lark_md 富文本）
 * 按 ## 频道分段；条目内「原文：URL」转为 [URL](URL) 以保证可点击
 */
function buildFeishuCard(
  report: string,
  date: Date,
): Record<string, unknown> {
  const dateStr = date.toISOString().slice(0, 10);

  // 按二级标题（频道名）分段，不与条目 ### 标题冲突
  const sections = report.split(/^## /m).filter(Boolean);
  const elements: FeishuCardElement[] = [];

  for (const section of sections) {
    const firstLine = section.split('\n')[0].trim();
    // 跳过日报总标题（# 情报日报 ...）
    if (firstLine.startsWith('# ')) continue;

    const content = section.replace(/^[^\n]+\n/, '').trim();
    if (!content) continue;

    elements.push({
      tag: 'markdown',
      content: `**${firstLine}**`,
    });

    elements.push({
      tag: 'markdown',
      content: truncate(makeSourceLinksClickable(content), MAX_SECTION_LENGTH),
    });

    elements.push({ tag: 'hr' });
  }

  return {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      header: {
        title: {
          tag: 'plain_text',
          content: `情报日报 ${dateStr}`,
        },
        template: 'blue',
      },
      body: {
        elements: elements.length > 0 ? elements : [
          {
            tag: 'markdown',
            content: '今日暂无新增情报内容',
          },
        ],
      },
    },
  };
}

/**
 * 发送情报日报到飞书 Webhook
 *
 * @param webhookUrl 飞书机器人 Webhook URL
 * @param report Markdown 格式日报内容
 * @param date 报告日期
 */
export async function sendFeishuReport(
  webhookUrl: string,
  report: string,
  date: Date,
): Promise<void> {
  const payload = buildFeishuCard(report, date);
  await postFeishuWebhook(webhookUrl, payload);
  console.log(`[feishu.service] 推送成功 — date: ${date.toISOString().slice(0, 10)}`);
}

/**
 * 通用推送日志记录函数（供 E01 飞书推送和后续 K02 邮件推送复用）
 *
 * @param reportDate 报告日期
 * @param channel 推送渠道
 * @param status 推送状态
 * @param errorMsg 错误信息（失败时）
 */
export async function recordPushLog(
  reportDate: Date,
  channel: 'FEISHU' | 'EMAIL' | 'WEB',
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED',
  errorMsg?: string,
  userId?: string,
): Promise<void> {
  await prisma.pushLog.create({
    data: {
      reportDate,
      channel,
      status,
      userId: userId || null,
      sentAt: status === 'SENT' ? new Date() : undefined,
      errorMsg: errorMsg || undefined,
    },
  });
}

/**
 * 执行飞书推送并自动记录日志（全局模式，兼容 Phase 1）
 *
 * @param webhookUrl 飞书机器人 Webhook URL
 * @param report Markdown 格式日报
 * @param date 报告日期
 * @param userId 关联用户 ID（可选）
 */
export async function pushAndLog(
  webhookUrl: string,
  report: string,
  date: Date,
  userId?: string,
): Promise<void> {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  try {
    await sendFeishuReport(webhookUrl, report, date);
    await recordPushLog(targetDate, 'FEISHU', 'SENT', undefined, userId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[feishu.service] 推送失败:', errorMsg);
    await recordPushLog(targetDate, 'FEISHU', 'FAILED', errorMsg, userId);
    throw err;
  }
}

/**
 * 向用户按其 feishuWebhook 推送日报，未绑定时记录 SKIPPED
 *
 * @param userId 用户 ID
 * @param feishuWebhook 用户绑定的 Webhook（可能为 null）
 * @param report Markdown 格式日报
 * @param date 报告日期
 */
export async function pushUserFeishuReport(
  userId: string,
  feishuWebhook: string | null,
  report: string,
  date: Date,
): Promise<void> {
  const targetDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  if (!feishuWebhook) {
    await recordPushLog(targetDate, 'FEISHU', 'SKIPPED', 'user has no feishuWebhook', userId);
    console.log(`[feishu.service] 用户未绑定飞书，跳过 — userId: ${userId}`);
    return;
  }

  try {
    await sendFeishuReport(feishuWebhook, report, date);
    await recordPushLog(targetDate, 'FEISHU', 'SENT', undefined, userId);
    console.log(`[feishu.service] 用户飞书推送成功 — userId: ${userId}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[feishu.service] 用户飞书推送失败 — userId: ${userId}:`, errorMsg);
    await recordPushLog(targetDate, 'FEISHU', 'FAILED', errorMsg, userId);
  }
}

/**
 * 发送飞书文本通知（用于申请通知等）
 *
 * @param webhookUrl 飞书机器人 Webhook URL
 * @param options 通知内容
 */
export async function sendFeishuNotification(
  webhookUrl: string,
  options: { title: string; content: string },
): Promise<void> {
  const payload = {
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: options.title },
        template: 'green',
      },
      body: {
        elements: [{ tag: 'markdown', content: options.content }],
      },
    },
  };

  await postFeishuWebhook(webhookUrl, payload, 10000);
}
