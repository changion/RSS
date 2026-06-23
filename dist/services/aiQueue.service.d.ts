import PQueue from 'p-queue';
/**
 * AI 调用全局并发队列
 * concurrency: 2 — 最多同时进行 2 个 Claude API 调用
 * 队列满时新任务等待，不丢弃
 */
export declare const aiQueue: PQueue<import("p-queue/dist/priority-queue").default, import("p-queue").QueueAddOptions>;
/**
 * 将任务加入 AI 处理队列
 * 队列满时会等待，保证所有任务都被执行
 *
 * @param task 异步任务函数
 * @returns 任务执行结果
 */
export declare function enqueueAITask<T>(task: () => Promise<T>): Promise<T>;
/** 获取当前队列状态 */
export declare function getQueueStats(): {
    pending: number;
    size: number;
    isPaused: boolean;
};
//# sourceMappingURL=aiQueue.service.d.ts.map