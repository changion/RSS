"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callClaude = void 0;
exports.callAI = callAI;
const openai_1 = __importDefault(require("openai"));
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 3;
let client = null;
/**
 * 获取 DeepSeek（OpenAI 兼容）客户端单例
 */
function getClient() {
    if (!client) {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('DEEPSEEK_API_KEY 环境变量未配置');
        }
        client = new openai_1.default({
            apiKey,
            baseURL: 'https://api.deepseek.com',
            timeout: DEFAULT_TIMEOUT_MS,
        });
    }
    return client;
}
/**
 * 指数退避等待
 */
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
async function callAI(prompt, context, maxRetries = DEFAULT_MAX_RETRIES) {
    const ai = getClient();
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const startTime = Date.now();
            const response = await ai.chat.completions.create({
                model: DEFAULT_MODEL,
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: `${prompt}\n\n---\n\n${context}`,
                    },
                ],
            });
            const duration = Date.now() - startTime;
            const content = response.choices[0]?.message?.content ?? '';
            const inputTokens = response.usage?.prompt_tokens ?? 0;
            const outputTokens = response.usage?.completion_tokens ?? 0;
            const model = response.model ?? DEFAULT_MODEL;
            console.log(`[claude.service] 调用成功 — 模型: ${model}, ` +
                `输入: ${inputTokens} tokens, 输出: ${outputTokens} tokens, 耗时: ${duration}ms`);
            return {
                content,
                model,
                inputTokens,
                outputTokens,
            };
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            if (attempt < maxRetries) {
                console.warn(`[claude.service] 调用失败（第 ${attempt}/${maxRetries} 次），${backoffMs}ms 后重试:`, lastError.message);
                await sleep(backoffMs);
            }
        }
    }
    throw new Error(`AI API 调用失败（已重试 ${maxRetries} 次）: ${lastError?.message}`);
}
/** 向后兼容别名 */
exports.callClaude = callAI;
//# sourceMappingURL=claude.service.js.map