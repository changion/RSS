"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiQueue = void 0;
exports.enqueueAITask = enqueueAITask;
exports.getQueueStats = getQueueStats;
const p_queue_1 = __importDefault(require("p-queue"));
/**
 * AI 调用全局并发队列
 * concurrency: 2 — 最多同时进行 2 个 Claude API 调用
 * 队列满时新任务等待，不丢弃
 */
exports.aiQueue = new p_queue_1.default({ concurrency: 2 });
/**
 * 将任务加入 AI 处理队列
 * 队列满时会等待，保证所有任务都被执行
 *
 * @param task 异步任务函数
 * @returns 任务执行结果
 */
async function enqueueAITask(task) {
    return exports.aiQueue.add(task);
}
/** 获取当前队列状态 */
function getQueueStats() {
    return {
        pending: exports.aiQueue.pending,
        size: exports.aiQueue.size,
        isPaused: exports.aiQueue.isPaused,
    };
}
//# sourceMappingURL=aiQueue.service.js.map