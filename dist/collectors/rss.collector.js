"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRssItems = fetchRssItems;
const rss_parser_1 = __importDefault(require("rss-parser"));
const parser = new rss_parser_1.default({
    timeout: 10000,
    headers: {
        'User-Agent': 'IntelHub/1.0 RSS Reader',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    },
});
/**
 * 获取单个 RSS/Atom 源的条目
 */
async function fetchSingleRss(url) {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map((item) => ({
        title: item.title || '(无标题)',
        link: item.link || item.guid || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        content: item.contentSnippet ||
            item.content ||
            item.summary ||
            item['content:encodedSnippet'] ||
            '',
        source: feed.title || url,
    }));
}
/**
 * 批量获取多个 RSS/Atom 源的条目
 * 部分失败不影响其他源，失败的源返回空数组并记录日志
 *
 * @param urls RSS/Atom 订阅地址数组
 * @returns 所有成功源的条目合并列表
 */
async function fetchRssItems(urls) {
    if (!urls || urls.length === 0)
        return [];
    const results = await Promise.allSettled(urls.map((url) => fetchSingleRss(url)));
    const items = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            items.push(...result.value);
        }
        else {
            console.warn(`[rss.collector] 采集失败 — URL: ${urls[index]}`, result.reason?.message);
        }
    });
    return items;
}
//# sourceMappingURL=rss.collector.js.map