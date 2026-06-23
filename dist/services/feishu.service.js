"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFeishuReport = sendFeishuReport;
exports.recordPushLog = recordPushLog;
exports.pushAndLog = pushAndLog;
exports.pushUserFeishuReport = pushUserFeishuReport;
exports.sendFeishuNotification = sendFeishuNotification;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../lib/prisma");
const MAX_SECTION_LENGTH = 500;
/**
 * 截断字符串到指定长度，超出部分用省略号表示
 */
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen) + '...\n\n（完整内容请查看系统后台）';
}
/**
 * 将 Markdown 日报转换为飞书富文本卡片格式
 * 按频道分组，每频道内容最多 500 字
 */
function buildFeishuCard(report, date) {
    const dateStr = date.toISOString().slice(0, 10);
    // 解析 Markdown 按频道分段
    const sections = report.split(/^## /m).filter(Boolean);
    const elements = [];
    for (const section of sections) {
        const firstLine = section.split('\n')[0].trim();
        // 跳过顶级标题
        if (firstLine.startsWith('# '))
            continue;
        const content = section.replace(/^[^\n]+\n/, '').trim();
        if (!content)
            continue;
        // 频道标题
        elements.push({
            tag: 'markdown',
            content: `**${firstLine}**`,
        });
        // 内容（截断到 500 字）
        elements.push({
            tag: 'markdown',
            content: truncate(content, MAX_SECTION_LENGTH),
        });
        // 分割线
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
async function sendFeishuReport(webhookUrl, report, date) {
    const payload = buildFeishuCard(report, date);
    const response = await axios_1.default.post(webhookUrl, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
    });
    if (response.data?.code !== 0 && response.data?.StatusCode !== 0) {
        throw new Error(`飞书 Webhook 返回错误: ${JSON.stringify(response.data)}`);
    }
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
async function recordPushLog(reportDate, channel, status, errorMsg, userId) {
    await prisma_1.prisma.pushLog.create({
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
async function pushAndLog(webhookUrl, report, date, userId) {
    const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    try {
        await sendFeishuReport(webhookUrl, report, date);
        await recordPushLog(targetDate, 'FEISHU', 'SENT', undefined, userId);
    }
    catch (err) {
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
async function pushUserFeishuReport(userId, feishuWebhook, report, date) {
    const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    if (!feishuWebhook) {
        await recordPushLog(targetDate, 'FEISHU', 'SKIPPED', 'user has no feishuWebhook', userId);
        console.log(`[feishu.service] 用户未绑定飞书，跳过 — userId: ${userId}`);
        return;
    }
    try {
        await sendFeishuReport(feishuWebhook, report, date);
        await recordPushLog(targetDate, 'FEISHU', 'SENT', undefined, userId);
        console.log(`[feishu.service] 用户飞书推送成功 — userId: ${userId}`);
    }
    catch (err) {
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
async function sendFeishuNotification(webhookUrl, options) {
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
    const response = await axios_1.default.post(webhookUrl, payload, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
    });
    if (response.data?.code !== 0 && response.data?.StatusCode !== 0) {
        throw new Error(`飞书通知返回错误: ${JSON.stringify(response.data)}`);
    }
}
//# sourceMappingURL=feishu.service.js.map