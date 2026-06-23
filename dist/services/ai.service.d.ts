/**
 * 处理单个频道的日报 AI 分析
 * 从数据库读取频道配置和原始条目，调用 Claude 处理，写回结果
 *
 * @param channelId 频道 ID
 * @param reportDate 报告日期
 */
export declare function processChannelReport(channelId: string, reportDate: Date): Promise<void>;
/**
 * 批量处理多个频道的 AI 分析（通过队列控制并发）
 *
 * @param channelIds 频道 ID 列表
 * @param reportDate 报告日期
 */
export declare function processAllChannelReports(channelIds: string[], reportDate: Date): Promise<void>;
//# sourceMappingURL=ai.service.d.ts.map