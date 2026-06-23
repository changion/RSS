"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const adminIPWhitelist_1 = require("../middleware/adminIPWhitelist");
const collect_service_1 = require("../services/collect.service");
const ai_service_1 = require("../services/ai.service");
const report_service_1 = require("../services/report.service");
const feishu_service_1 = require("../services/feishu.service");
const router = (0, express_1.Router)();
// 所有 Admin 路由均需通过 IP 白名单验证
router.use(adminIPWhitelist_1.adminIPWhitelist);
// ─── 频道 CRUD ─────────────────────────────────────────────────────────────────
/**
 * GET /admin/api/channels
 * 获取频道列表
 */
router.get('/api/channels', async (_req, res) => {
    try {
        const channels = await prisma_1.prisma.channel.findMany({
            orderBy: { createdAt: 'desc' },
        });
        // 解析 collectRule JSON 用于前端展示
        const result = channels.map((ch) => ({
            ...ch,
            collectRuleParsed: safeParseJson(ch.collectRule),
        }));
        res.json({ data: result });
    }
    catch (err) {
        res.status(500).json({ error: '获取频道列表失败', detail: String(err) });
    }
});
/**
 * POST /admin/api/channels
 * 创建频道
 */
router.post('/api/channels', async (req, res) => {
    try {
        const { name, description, type, collectRule, collectFrequency, defaultPrompt, status } = req.body;
        if (!name) {
            res.status(400).json({ error: '频道名称不能为空' });
            return;
        }
        // 校验 collectRule 格式
        const ruleStr = validateCollectRule(collectRule);
        if (ruleStr === null) {
            res.status(400).json({ error: 'collectRule 必须是合法的 JSON 格式' });
            return;
        }
        const channel = await prisma_1.prisma.channel.create({
            data: {
                name,
                description: description || '',
                type: validateChannelType(type),
                collectRule: ruleStr,
                collectFrequency: collectFrequency || '0 2 * * *',
                defaultPrompt: defaultPrompt || null,
                status: validateChannelStatus(status),
            },
        });
        res.status(201).json({ data: channel });
    }
    catch (err) {
        res.status(500).json({ error: '创建频道失败', detail: String(err) });
    }
});
/**
 * PUT /admin/api/channels/:id
 * 更新频道
 */
router.put('/api/channels/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, type, collectRule, collectFrequency, defaultPrompt, status } = req.body;
        const existing = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: '频道不存在' });
            return;
        }
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (description !== undefined)
            updates.description = description;
        if (type !== undefined)
            updates.type = validateChannelType(type);
        if (collectFrequency !== undefined)
            updates.collectFrequency = collectFrequency;
        if (defaultPrompt !== undefined)
            updates.defaultPrompt = defaultPrompt;
        if (status !== undefined)
            updates.status = validateChannelStatus(status);
        if (collectRule !== undefined) {
            const ruleStr = validateCollectRule(collectRule);
            if (ruleStr === null) {
                res.status(400).json({ error: 'collectRule 必须是合法的 JSON 格式' });
                return;
            }
            updates.collectRule = ruleStr;
        }
        const updated = await prisma_1.prisma.channel.update({
            where: { id },
            data: updates,
        });
        res.json({ data: updated });
    }
    catch (err) {
        res.status(500).json({ error: '更新频道失败', detail: String(err) });
    }
});
/**
 * DELETE /admin/api/channels/:id
 * 删除频道（同时级联删除关联的 DailyReport）
 */
router.delete('/api/channels/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: '频道不存在' });
            return;
        }
        await prisma_1.prisma.channel.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: '删除频道失败', detail: String(err) });
    }
});
/**
 * PATCH /admin/api/channels/:id/status
 * 切换频道状态（ACTIVE ↔ PAUSED）
 */
router.patch('/api/channels/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['ACTIVE', 'PAUSED', 'DRAFT'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: `status 必须是 ${validStatuses.join('/')} 之一` });
            return;
        }
        const updated = await prisma_1.prisma.channel.update({
            where: { id },
            data: { status },
        });
        res.json({ data: updated });
    }
    catch (err) {
        res.status(500).json({ error: '更新频道状态失败', detail: String(err) });
    }
});
// ─── 手动触发采集 ─────────────────────────────────────────────────────────────
/**
 * POST /admin/api/channels/:id/trigger
 * 手动触发单个频道的采集任务
 */
router.post('/api/channels/:id/trigger', async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!channel) {
            res.status(404).json({ error: '频道不存在' });
            return;
        }
        const result = await (0, collect_service_1.runChannelCollect)(id);
        res.json({
            success: !result.error,
            itemCount: result.newItemCount,
            duration: result.duration,
            error: result.error,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, itemCount: 0, duration: 0, error: String(err) });
    }
});
// ─── 手动触发完整链路 ─────────────────────────────────────────────────────────
/**
 * POST /admin/api/pipeline/run
 * 手动触发完整处理链路：AI分析 → 日报生成 → 飞书推送
 * Body: { channelId?: string }
 */
router.post('/api/pipeline/run', async (req, res) => {
    const startMs = Date.now();
    try {
        const { channelId } = req.body;
        const webhookUrl = process.env.FEISHU_WEBHOOK_URL || '';
        // 当日日期（UTC 零点）
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        // 确定需要处理的频道
        let targetChannels;
        if (channelId) {
            const ch = await prisma_1.prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
            if (!ch) {
                res.status(404).json({ success: false, error: `频道不存在: ${channelId}` });
                return;
            }
            targetChannels = [ch];
        }
        else {
            targetChannels = await prisma_1.prisma.channel.findMany({
                where: { status: 'ACTIVE' },
                select: { id: true },
            });
        }
        // 检查当日 rawItems 是否为空（只处理有数据的频道）
        const reportsWithItems = await prisma_1.prisma.dailyReport.findMany({
            where: {
                channelId: { in: targetChannels.map((c) => c.id) },
                reportDate: today,
                itemCount: { gt: 0 },
            },
            select: { channelId: true },
        });
        if (reportsWithItems.length === 0) {
            res.json({
                success: true,
                channelsProcessed: 0,
                reportLength: 0,
                pushStatus: 'skipped',
                duration: Date.now() - startMs,
                error: null,
            });
            return;
        }
        // AI 处理（并发，单个失败不影响其他）
        const channelIdsToProcess = reportsWithItems.map((r) => r.channelId);
        await Promise.all(channelIdsToProcess.map((cId) => (0, ai_service_1.processChannelReport)(cId, today).catch((err) => {
            console.error(`[pipeline] AI处理失败 channelId=${cId}`, err);
        })));
        // 生成日报
        const { content, result } = await (0, report_service_1.generateDailyReport)(today);
        // 飞书推送
        let pushStatus = 'skipped';
        if (result.shouldPush && content && webhookUrl) {
            try {
                await (0, feishu_service_1.pushAndLog)(webhookUrl, content, today);
                pushStatus = 'sent';
            }
            catch (err) {
                pushStatus = 'failed';
                console.error('[pipeline] 飞书推送失败', err);
            }
        }
        res.json({
            success: true,
            channelsProcessed: channelIdsToProcess.length,
            reportLength: content.length,
            pushStatus,
            duration: Date.now() - startMs,
            error: null,
        });
    }
    catch (err) {
        console.error('[pipeline] 完整链路执行失败', err);
        res.json({
            success: false,
            channelsProcessed: 0,
            reportLength: 0,
            pushStatus: 'failed',
            duration: Date.now() - startMs,
            error: String(err),
        });
    }
});
// ─── 推送日志 ─────────────────────────────────────────────────────────────────
/**
 * GET /admin/api/push-logs
 * 查询推送日志，支持按日期和状态过滤
 * Query: date=YYYY-MM-DD&status=SENT|FAILED|PENDING|SKIPPED
 */
router.get('/api/push-logs', async (req, res) => {
    try {
        const { date, status } = req.query;
        const where = {};
        if (date && typeof date === 'string') {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                const end = new Date(start.getTime() + 86400000);
                where.reportDate = { gte: start, lt: end };
            }
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        const logs = await prisma_1.prisma.pushLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        res.json({ data: logs });
    }
    catch (err) {
        res.status(500).json({ error: '查询推送日志失败', detail: String(err) });
    }
});
// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function safeParseJson(str) {
    try {
        return JSON.parse(str);
    }
    catch {
        return {};
    }
}
function validateCollectRule(rule) {
    if (typeof rule === 'string') {
        try {
            JSON.parse(rule);
            return rule;
        }
        catch {
            return null;
        }
    }
    if (typeof rule === 'object' && rule !== null) {
        return JSON.stringify(rule);
    }
    return '{}';
}
function validateChannelType(type) {
    return type === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
}
function validateChannelStatus(status) {
    const valid = ['ACTIVE', 'PAUSED', 'DRAFT'];
    return valid.includes(String(status)) ? String(status) : 'DRAFT';
}
exports.default = router;
//# sourceMappingURL=admin.routes.js.map