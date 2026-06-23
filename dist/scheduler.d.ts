/**
 * Job 1: 每日 02:00（北京时间）
 * 触发所有 ACTIVE 频道的采集 + AI 处理
 */
declare function runCollectJob(): Promise<void>;
/**
 * Job 2: 每日 08:00（北京时间）
 * 日报生成 + 飞书推送
 */
declare function runReportJob(): Promise<void>;
/**
 * 初始化并启动 cron 调度任务
 */
export declare function initScheduler(): void;
export { runCollectJob, runReportJob };
//# sourceMappingURL=scheduler.d.ts.map