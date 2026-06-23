import * as cheerio from 'cheerio';
import { RawItem } from '../types';

/**
 * 网页抓取目标配置
 *
 * 两种模式：
 * - html（默认）：用 CSS 选择器从服务端渲染的 HTML 列表页提取条目
 * - json：部分站点列表为前端渲染（HTML 中无数据），直接请求其数据接口，
 *         用字段路径从 JSON 响应中提取条目
 */
export interface ScrapeTarget {
  url: string;
  /** 来源名称，默认取 url 的 hostname */
  source?: string;
  /** 抓取模式，默认 html */
  mode?: 'html' | 'json';

  // ── html 模式 ──
  /** 列表条目选择器（每个匹配元素视为一条） */
  listSelector?: string;
  /** 条目内标题选择器，缺省取条目自身文本 */
  titleSelector?: string;
  /** 条目内链接选择器，缺省时若条目本身是 <a> 取其 href，否则取条目内第一个 <a> */
  linkSelector?: string;
  /** 条目内日期选择器（可选；注意相对日期如"昨天"会导致去重 hash 不稳定） */
  dateSelector?: string;
  /** 条目内摘要选择器（可选） */
  contentSelector?: string;

  // ── json 模式 ──
  /** 请求方法，默认 GET */
  method?: 'GET' | 'POST';
  /** POST 表单体，如 "page=1" */
  body?: string;
  /** 条目数组在响应中的路径，如 "data.article_list" */
  listPath?: string;
  /** 条目内字段路径 */
  titleField?: string;
  linkField?: string;
  /** 链接前缀，与 linkField 取值拼接成完整 URL（如 linkField 是数字 id 时） */
  linkPrefix?: string;
  dateField?: string;
  contentField?: string;

  // ── 分页与日期过滤 ──
  /** 抓取页数，默认 1；html 模式自动追加 ?page=N，json 模式自动替换 body 中 pn=N */
  maxPages?: number;
  /** html 分页 URL 模板，{page} 替换页码，如 "https://example.com/article/?page={page}" */
  pageUrlTemplate?: string;
  /** json 分页 body 模板，{page} 替换页码，如 "pn={page}" */
  pageBodyTemplate?: string;
  /** 只保留最近 N 小时内的条目；无法解析日期时保留（避免误杀） */
  maxAgeHours?: number;
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 15000;

/**
 * 按点分路径取值，如 getByPath(obj, "data.article_list")
 */
function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * 带浏览器 UA 和超时的 fetch
 */
async function fetchWithUA(target: ScrapeTarget): Promise<Response> {
  // 注意：html 模式的 Accept 不能带 application/json，
  // 部分站点（如扬帆出海）会因此把整页 HTML 包成 JSON 字符串返回
  const accept =
    target.mode === 'json'
      ? 'application/json,text/plain,*/*'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

  const res = await fetch(target.url, {
    method: target.method || 'GET',
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: accept,
      ...(target.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: target.body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/**
 * 将发布时间文本解析为距今小时数；无法解析返回 null
 * 支持：N分钟前/小时前/天前、今天/昨天 HH:mm、MM-DD、YYYY-MM-DD
 */
function parsePubDateAgeHours(pubDate: string): number | null {
  const s = pubDate.trim();
  if (!s) return null;

  const now = new Date();

  if (/刚刚/.test(s)) return 0;
  const minMatch = s.match(/(\d+)\s*分钟前/);
  if (minMatch) return Number(minMatch[1]) / 60;
  const hourMatch = s.match(/(\d+)\s*小时前/);
  if (hourMatch) return Number(hourMatch[1]);
  // 「N 天前」按整天计，加 1h 避免「1 天前」卡在 24h 边界被误放行
  const dayMatch = s.match(/(\d+)\s*天前/);
  if (dayMatch) return Number(dayMatch[1]) * 24 + 1;

  if (/前天/.test(s)) {
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - 2);
      dt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      return (now.getTime() - dt.getTime()) / 3600000;
    }
    return 48;
  }

  if (/昨天/.test(s)) {
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - 1);
      dt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      return (now.getTime() - dt.getTime()) / 3600000;
    }
    return 24;
  }

  if (/今天/.test(s)) {
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const dt = new Date(now);
      dt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      return (now.getTime() - dt.getTime()) / 3600000;
    }
    return 0;
  }

  const ymdMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const dt = new Date(
      Number(ymdMatch[1]),
      Number(ymdMatch[2]) - 1,
      Number(ymdMatch[3]),
    );
    return (now.getTime() - dt.getTime()) / 3600000;
  }

  const mdMatch = s.match(/(\d{2})-(\d{2})/);
  if (mdMatch) {
    let dt = new Date(now.getFullYear(), Number(mdMatch[1]) - 1, Number(mdMatch[2]));
    if (dt.getTime() > now.getTime()) {
      dt = new Date(now.getFullYear() - 1, Number(mdMatch[1]) - 1, Number(mdMatch[2]));
    }
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      dt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    }
    return (now.getTime() - dt.getTime()) / 3600000;
  }

  // 白鲸等接口的标准时间戳字符串
  const stdMatch = s.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (stdMatch) {
    const dt = new Date(stdMatch[1].replace(' ', 'T'));
    if (!Number.isNaN(dt.getTime())) {
      return (now.getTime() - dt.getTime()) / 3600000;
    }
  }

  return null;
}

/** 按 maxAgeHours 过滤；无法解析日期的条目保留 */
function filterByMaxAge(items: RawItem[], maxAgeHours?: number): RawItem[] {
  if (!maxAgeHours || maxAgeHours <= 0) return items;

  return items.filter((item) => {
    const age = parsePubDateAgeHours(item.pubDate);
    if (age === null) return true;
    return age <= maxAgeHours;
  });
}

/** 生成第 N 页的目标配置 */
function expandTargetForPage(target: ScrapeTarget, page: number): ScrapeTarget {
  if (page === 1) return target;

  const expanded: ScrapeTarget = { ...target };

  if (target.pageUrlTemplate) {
    expanded.url = target.pageUrlTemplate.replace('{page}', String(page));
  } else if (target.mode !== 'json') {
    const u = new URL(target.url);
    u.searchParams.set('page', String(page));
    expanded.url = u.toString();
  }

  if (target.pageBodyTemplate) {
    expanded.body = target.pageBodyTemplate.replace('{page}', String(page));
  } else if (target.body && /pn=\d+/.test(target.body)) {
    expanded.body = target.body.replace(/pn=\d+/, `pn=${page}`);
  }

  return expanded;
}

/**
 * 相对链接拼成绝对 URL，非法链接返回空串
 */
function resolveLink(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

/**
 * html 模式：cheerio 解析列表页
 */
async function scrapeHtmlTarget(target: ScrapeTarget): Promise<RawItem[]> {
  if (!target.listSelector) {
    throw new Error('html 模式缺少 listSelector');
  }

  const res = await fetchWithUA(target);
  const html = await res.text();
  const $ = cheerio.load(html);
  const source = target.source || new URL(target.url).hostname;

  const items: RawItem[] = [];

  $(target.listSelector).each((_, el) => {
    const $el = $(el);

    const title = (
      target.titleSelector ? $el.find(target.titleSelector).first().text() : $el.text()
    )
      .replace(/\s+/g, ' ')
      .trim();

    let href: string | undefined;
    if (target.linkSelector) {
      href = $el.find(target.linkSelector).first().attr('href');
    } else if ($el.is('a')) {
      href = $el.attr('href');
    } else {
      href = $el.find('a').first().attr('href');
    }

    if (!title || !href) return;
    const link = resolveLink(href, target.url);
    if (!link) return;

    const pubDate = target.dateSelector
      ? $el.find(target.dateSelector).first().text().trim()
      : '';
    const content = target.contentSelector
      ? $el.find(target.contentSelector).first().text().replace(/\s+/g, ' ').trim()
      : '';

    items.push({ title, link, pubDate, content, source });
  });

  return items;
}

/**
 * json 模式：请求数据接口并按字段路径提取
 */
async function scrapeJsonTarget(target: ScrapeTarget): Promise<RawItem[]> {
  if (!target.listPath || !target.titleField || !target.linkField) {
    throw new Error('json 模式缺少 listPath/titleField/linkField');
  }

  const res = await fetchWithUA(target);
  const data: unknown = await res.json();
  const list = getByPath(data, target.listPath);
  if (!Array.isArray(list)) {
    throw new Error(`listPath "${target.listPath}" 未命中数组`);
  }

  const source = target.source || new URL(target.url).hostname;
  const items: RawItem[] = [];

  for (const entry of list) {
    const title = String(getByPath(entry, target.titleField) ?? '').trim();
    const linkVal = getByPath(entry, target.linkField);
    if (!title || linkVal === undefined || linkVal === null || linkVal === '') continue;

    const link = resolveLink(`${target.linkPrefix ?? ''}${linkVal}`, target.url);
    if (!link) continue;

    const pubDate = target.dateField
      ? String(getByPath(entry, target.dateField) ?? '').trim()
      : '';
    const content = target.contentField
      ? String(getByPath(entry, target.contentField) ?? '').trim()
      : '';

    items.push({ title, link, pubDate, content, source });
  }

  return items;
}

/**
 * 抓取单个目标（支持多页），按 link 去重，可选按发布时间过滤
 */
async function scrapeSingleTarget(target: ScrapeTarget): Promise<RawItem[]> {
  const maxPages = Math.max(1, target.maxPages ?? 1);
  const seen = new Set<string>();
  const allItems: RawItem[] = [];
  let rawTotal = 0;

  for (let page = 1; page <= maxPages; page++) {
    const pageTarget = expandTargetForPage(target, page);
    const pageItems =
      pageTarget.mode === 'json'
        ? await scrapeJsonTarget(pageTarget)
        : await scrapeHtmlTarget(pageTarget);

    rawTotal += pageItems.length;

    for (const item of pageItems) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      allItems.push(item);
    }

    // 开启日期过滤且整页均超出时间窗口时，提前停止翻页
    if (target.maxAgeHours && pageItems.length > 0) {
      const hasRecent = pageItems.some((item) => {
        const age = parsePubDateAgeHours(item.pubDate);
        return age === null || age <= target.maxAgeHours!;
      });
      if (!hasRecent) break;
    }
  }

  const filtered = filterByMaxAge(allItems, target.maxAgeHours);

  console.log(
    `[scrape.collector] ${target.source || target.url} 抓取到 ${filtered.length} 条` +
      (maxPages > 1 || target.maxAgeHours ? `（原始 ${rawTotal}，去重后 ${allItems.length}）` : ''),
  );
  return filtered;
}

/**
 * 批量抓取多个网页目标
 * 单个目标失败不影响其他目标，失败的记录日志并跳过
 *
 * @param targets 抓取目标配置数组
 * @returns 所有成功目标的条目合并列表
 */
export async function scrapeTargets(targets: ScrapeTarget[]): Promise<RawItem[]> {
  if (!targets || targets.length === 0) return [];

  const results = await Promise.allSettled(targets.map((t) => scrapeSingleTarget(t)));

  const items: RawItem[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      console.warn(
        `[scrape.collector] 抓取失败 — URL: ${targets[index].url}`,
        result.reason?.message ?? result.reason,
      );
    }
  });

  return items;
}
