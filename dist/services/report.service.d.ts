import { PushResult } from '../types';
/**
 * 生成全局每日情报日报（兼容 Phase 1，汇总所有 ACTIVE 频道）
 *
 * @param date 报告日期
 */
export declare function generateDailyReport(date: Date): Promise<{
    content: string;
    result: PushResult;
}>;
/**
 * 生成指定用户的个人日报
 * 只聚合该用户 ACTIVE 订阅的频道内容
 *
 * @param userId 用户 ID
 * @param date 报告日期
 */
export declare function generateUserDailyReport(userId: string, date: Date): Promise<{
    content: string;
    result: PushResult;
}>;
/**
 * 遍历所有有 ACTIVE 订阅的用户，分别生成日报
 * 返回 { userId, content, result }[]
 */
export declare function generateAllUserReports(date: Date): Promise<{
    userId: string;
    content: string;
    result: PushResult;
}[]>;
//# sourceMappingURL=report.service.d.ts.map