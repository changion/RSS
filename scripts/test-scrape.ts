import { scrapeTargets, ScrapeTarget } from '../src/collectors/scrape.collector';

/** 「出海」频道采集配置（与 DB collectRule 保持一致） */
export const CHUHAI_TARGETS: ScrapeTarget[] = [
  {
    url: 'https://www.yfchuhai.com/article/',
    source: '扬帆出海',
    listSelector: 'a.news-list__item',
    titleSelector: 'h2.title',
    contentSelector: 'p.desc',
    dateSelector: '.icon.time + .text',
    maxPages: 2,
    maxAgeHours: 24,
  },
  {
    url: 'https://www.baijing.cn/index/ajax/get_article/',
    source: '白鲸出海',
    mode: 'json',
    method: 'POST',
    body: 'pn=1',
    listPath: 'data.article_list',
    titleField: 'title',
    linkField: 'id',
    linkPrefix: 'https://www.baijing.cn/article/',
    dateField: 'add_time',
    contentField: 'synopsis',
    maxPages: 3,
    maxAgeHours: 24,
  },
];

async function main() {
  const items = await scrapeTargets(CHUHAI_TARGETS);
  const bySource = new Map<string, number>();
  for (const item of items) {
    bySource.set(item.source, (bySource.get(item.source) || 0) + 1);
  }
  console.log('--- 各来源条数（近24h过滤后）---');
  for (const [source, count] of bySource) console.log(`${source}: ${count}`);
  console.log(`合计: ${items.length}`);
  console.log('--- 样例 ---');
  for (const item of items.slice(0, 3)) {
    console.log(`[${item.source}] ${item.pubDate} | ${item.title}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
