"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initScheduler = initScheduler;
exports.runCollectJob = runCollectJob;
exports.runReportJob = runReportJob;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("./lib/prisma");
const collect_service_1 = require("./services/collect.service");
const ai_service_1 = require("./services/ai.service");
const report_service_1 = require("./services/report.service");
const feishu_service_1 = require("./services/feishu.service");
/** 记录 Job 执行状态到日志 */
function logJobStatus(jobName, status, detail) {
    const ts = new Date().toISOString();
    if (status === 'start') {
        console.log(`[scheduler] ▶ Job 开始 — ${jobName} @ ${ts}`);
    }
    else if (status === 'end') {
        console.log(`[scheduler] ✅ Job 完成 — ${jobName} @ ${ts}${detail ? ` | ${detail}` : ''}`);
    }
    else {
        console.error(`[scheduler] ❌ Job 失败 — ${jobName} @ ${ts}: ${detail}`);
    }
}
/**
 * Job 1: 每日 02:00（北京时间）
 * 触发所有 ACTIVE 频道的采集 + AI 处理
 */
async function runCollectJob() {
    logJobStatus('collect', 'start');
    const jobStart = Date.now();
    try {
        const activeChannels = await prisma_1.prisma.channel.findMany({
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
                const result = await (0, collect_service_1.runChannelCollect)(channel.id, today);
                totalNewItems += result.newItemCount;
                console.log(`[scheduler] 频道采集 — ${channel.name}: 新增 ${result.newItemCount} 条, 耗时 ${result.duration}ms`);
                // 如有新条目，执行 AI 处理
                if (result.newItemCount > 0) {
                    await (0, ai_service_1.processChannelReport)(channel.id, today);
                }
            }
            catch (err) {
                console.error(`[scheduler] 频道处理失败 — ${channel.name}:`, err);
            }
        }
        logJobStatus('collect', 'end', `总新增 ${totalNewItems} 条, 耗时 ${Date.now() - jobStart}ms`);
    }
    catch (err) {
        logJobStatus('collect', 'error', String(err));
    }
}
/**
 * Job 2: 每日 08:00（北京时间）
 * 日报生成 + 飞书推送
 */
async function runReportJob() {
    logJobStatus('report', 'start');
    const jobStart = Date.now();
    try {
        const today = new Date();
        const { content, result } = await (0, report_service_1.generateDailyReport)(today);
        if (!result.shouldPush) {
            logJobStatus('report', 'end', `跳过推送: ${result.reason}`);
            return;
        }
        const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
        if (!webhookUrl) {
            logJobStatus('report', 'error', 'FEISHU_WEBHOOK_URL 未配置');
            return;
        }
        await (0, feishu_service_1.pushAndLog)(webhookUrl, content, today);
        logJobStatus('report', 'end', `推送成功, 耗时 ${Date.now() - jobStart}ms`);
    }
    catch (err) {
        logJobStatus('report', 'error', String(err));
    }
}
/**
 * 初始化并启动 cron 调度任务
 */
function initScheduler() {
    // Job 1: 每日 02:00 北京时间采集
    node_cron_1.default.schedule('0 2 * * *', runCollectJob, {
        timezone: 'Asia/Shanghai',
        name: 'collect-job',
    });
    // Job 2: 每日 08:00 北京时间推送
    node_cron_1.default.schedule('0 8 * * *', runReportJob, {
        timezone: 'Asia/Shanghai',
        name: 'report-job',
    });
    console.log('[scheduler] 调度任务已启动 — 采集: 02:00, 推送: 08:00 (Asia/Shanghai)');
}
//# sourceMappingURL=scheduler.js.map