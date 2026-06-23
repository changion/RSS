/**
 * 对比站点近24h实际条数 vs 采集入库条数
 * 用法：DATABASE_URL="file:../prisma/data/intel-hub.db" npx tsx scripts/verify-collect.ts
 */
import { PrismaClient } from '@prisma/client';
import { scrapeTargets } from '../src/collectors/scrape.collector';
import { CHUHAI_TARGETS } from './test-scrape';
import { filterNewItems } from '../src/services/dedup.service';

const CHANNEL_ID = '85ae11c5-a5c7-46fe-9d95-e8a60d538f64';
const prisma = new PrismaClient();

async function main() {
  console.log('=== 修复后 scrape 抓取（近24h过滤）===');
  const scraped = await scrapeTargets(CHUHAI_TARGETS);
  const bySource = new Map<string, number>();
  for (const item of scraped) {
    bySource.set(item.source, (bySource.get(item.source) || 0) + 1);
  }
  for (const [s, c] of bySource) console.log(`  ${s}: ${c}`);
  console.log(`  合计: ${scraped.length}`);

  console.log('\n=== dedup 后新增条数 ===');
  const newItems = await filterNewItems(scraped);
  const newBySource = new Map<string, number>();
  for (const item of newItems) {
    newBySource.set(item.source, (newBySource.get(item.source) || 0) + 1);
  }
  for (const [s, c] of newBySource) console.log(`  ${s}: ${c}`);
  console.log(`  合计: ${newItems.length}（重复 ${scraped.length - newItems.length}）`);

  const channel = await prisma.channel.findUnique({ where: { id: CHANNEL_ID } });
  console.log('\n=== DB 频道配置 ===');
  console.log('  名称:', channel?.name);
  console.log('  collectRule targets:', JSON.parse(channel?.collectRule || '{}').targets?.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
