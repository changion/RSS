/**
 * 发送情报日报到飞书 Webhook
 *
 * @param webhookUrl 飞书机器人 Webhook URL
 * @param report Markdown 格式日报内容
 * @param date 报告日期
 */
export declare function sendFeishuReport(webhookUrl: string, report: string, date: Date): Promise<void>;
/**
 * 通用推送日志记录函数（供 E01 飞书推送和后续 K02 邮件推送复用）
 *
 * @param reportDate 报告日期
 * @param channel 推送渠道
 * @param status 推送状态
 * @param errorMsg 错误信息（失败时）
 */
export declare function recordPushLog(reportDate: Date, channel: 'FEISHU' | 'EMAIL' | 'WEB', status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED', errorMsg?: string, userId?: string): Promise<void>;
/**
 * 执行飞书推送并自动记录日志（全局模式，兼容 Phase 1）
 *
 * @param webhookUrl 飞书机器人 Webhook URL
 * @param report Markdown 格式日报
 * @param date 报告日期
 * @param userId 关联用户 ID（可选）
 */
export declare function pushAndLog(webhookUrl: string, report: string, date: Date, userId?: string): Promise<void>;
/**
 * 向用户按其 feishuWebhook 推送日报，未绑定时记录 SKIPPED
 *
 * @param userId 用户 ID
 * @param feishuWebhook 用户绑定的 Webhook（可能为 null）
 * @param report Markdown 格式日报
 * @param date 报告日期
 */
export declare function pushUserFeishuReport(userId: string, feishuWebhook: string | null, report: string, date: Date): Promise<void>;
/**
 * 发送飞书文本通知（用于申请通知等）
 *
 * @param webhookUrl 飞书机器人 Webhook URL
 * @param options 通知内容
 */
export declare function sendFeishuNotification(webhookUrl: string, options: {
    title: string;
    content: string;
}): Promise<void>;
//# sourceMappingURL=feishu.service.d.ts.map