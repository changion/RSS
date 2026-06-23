import { RawItem } from '../types';
/**
 * 批量获取多个 RSS/Atom 源的条目
 * 部分失败不影响其他源，失败的源返回空数组并记录日志
 *
 * @param urls RSS/Atom 订阅地址数组
 * @returns 所有成功源的条目合并列表
 */
export declare function fetchRssItems(urls: string[]): Promise<RawItem[]>;
//# sourceMappingURL=rss.collector.d.ts.map