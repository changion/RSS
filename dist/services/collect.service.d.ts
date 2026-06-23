import { RawItem } from '../types';
/**
 * 持久化新增条目到指定频道的当日 DailyReport
 * 若当日已有记录则 upsert（合并追加）
 *
 * @param channelId 频道 ID
 * @param items 新增条目（已去重）
 * @param date 报告日期
 */
export declare function persistItems(channelId: string, items: RawItem[], date: Date): Promise<void>;
/**
 * 执行单个频道的完整采集流程：
 * 获取采集规则 → 执行采集 → 去重 → 持久化
 *
 * @param channelId 频道 ID
 * @param date 采集日期（默认今日）
 * @returns 新增条目数量和耗时
 */
export declare function runChannelCollect(channelId: string, date?: Date): Promise<{
    newItemCount: number;
    duration: number;
    error?: string;
}>;
//# sourceMappingURL=collect.service.d.ts.map