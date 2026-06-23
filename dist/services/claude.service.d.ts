/** AI API 调用返回结果 */
export interface ClaudeResult {
    content: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}
/**
 * 调用 DeepSeek API 进行文本处理
 * 支持失败重试（最多 3 次，指数退避：1s, 2s, 4s）
 *
 * @param prompt 系统/用户 Prompt
 * @param context 上下文内容（将作为用户消息附加）
 * @param maxRetries 最大重试次数（默认 3）
 * @returns AI 的处理结果
 */
export declare function callAI(prompt: string, context: string, maxRetries?: number): Promise<ClaudeResult>;
/** 向后兼容别名 */
export declare const callClaude: typeof callAI;
//# sourceMappingURL=claude.service.d.ts.map