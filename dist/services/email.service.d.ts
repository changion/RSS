/**
 * 发送邮件日报
 *
 * @param to 收件人邮箱
 * @param report Markdown 格式日报
 * @param date 报告日期
 */
export declare function sendEmailReport(to: string, report: string, date: Date): Promise<void>;
/**
 * P2-K02：遍历用户推送邮件日报
 * emailNotify=true 且有 emailAddress 的用户触发邮件推送
 */
export declare function pushAllUserEmailReports(date: Date, userReports: {
    userId: string;
    content: string;
}[]): Promise<void>;
//# sourceMappingURL=email.service.d.ts.map