/**
 * 通用类型定义
 */

/** 原始采集条目 */
export interface RawItem {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  source: string;
  hash?: string;
}

/** 采集结果 */
export interface CollectResult {
  channelId: string;
  items: RawItem[];
  newItemCount: number;
  duration: number;
  error?: string;
}

/** 推送结果 */
export interface PushResult {
  shouldPush: boolean;
  reason?: string;
}

/** 日报数据 */
export interface DailyReportData {
  date: Date;
  channelReports: ChannelReportData[];
  totalItemCount: number;
}

/** 频道报告数据 */
export interface ChannelReportData {
  channelId: string;
  channelName: string;
  processedContent: string;
  itemCount: number;
}

/** 手动触发结果 */
export interface TriggerResult {
  success: boolean;
  itemCount: number;
  duration: number;
  error?: string;
}

/** Claude API 调用选项 */
export interface ClaudeCallOptions {
  maxRetries?: number;
  timeoutMs?: number;
}
