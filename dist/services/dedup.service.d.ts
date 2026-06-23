import { RawItem } from '../types';
/**
 * 生成条目的 SHA-256 去重 Hash
 * 基于 link + title + pubDate 的组合
 */
export declare function generateItemHash(item: Pick<RawItem, 'link' | 'title' | 'pubDate'>): string;
/**
 * 过滤掉已存在的条目，返回新增条目列表
 *
 * 查询策略：当日 + 近 7 天的 DailyReport 中已存在的 hash
 * 适合日报场景，避免重复推送同一条情报
 *
 * @param items 待去重的条目列表
 * @returns 新增条目（附带 hash 字段）
 */
export declare function filterNewItems(items: RawItem[]): Promise<RawItem[]>;
//# sourceMappingURL=dedup.service.d.ts.map