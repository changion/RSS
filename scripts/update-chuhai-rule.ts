/**
 * 更新「出海」频道 collectRule（channel id: 85ae11c5-a5c7-46fe-9d95-e8a60d538f64）
 * 用法：DATABASE_URL="file:/绝对路径/prisma/data/intel-hub.db" npx tsx scripts/update-chuhai-rule.ts
 */
import { PrismaClient } from '@prisma/client';

const CHANNEL_ID = '85ae11c5-a5c7-46fe-9d95-e8a60d538f64';

const COLLECT_RULE = {
  type: 'scrape',
  targets: [
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
  ],
};

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.channel.update({
    where: { id: CHANNEL_ID },
    data: {
      name: '出海',
      collectRule: JSON.stringify(COLLECT_RULE),
    },
  });
  console.log('已更新频道:', updated.id, updated.name);
  console.log(updated.collectRule);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
