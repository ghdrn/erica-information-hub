import { XMLParser } from "fast-xml-parser";
import { loadFeedIndex, saveFeedCollection, type FeedCollection } from "./erica-feed-store";

export type FeedSource = "academic" | "blog";
export type FeedCategory = "학사" | "장학" | "캠퍼스" | "기타";

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: FeedSource;
  sourceName: string;
  category: FeedCategory;
  publishedAt: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  fetchedAt: string;
  unavailableSources: FeedSource[];
  storageWarning?: boolean;
}

const ACADEMIC_RSS = "https://ehaksa.hanyang.ac.kr/notice?p_p_id=kr_ac_hanyang_bbs_web_portlet_BbsPortlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_kr_ac_hanyang_bbs_web_portlet_BbsPortlet_cmd=rss";
const BLOG_RSS = "https://rss.blog.naver.com/hyerica4473.xml";
const CACHE_MS = 10 * 60 * 1000;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
let cache: FeedResponse | null = null;
let cacheExpiresAt = 0;
let pending: Promise<FeedResponse> | null = null;

function asArray(value: unknown): any[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function plainText(value: unknown): string {
  const text = typeof value === "string" ? value : value && typeof value === "object" ? String((value as any)["#text"] ?? "") : "";
  return text.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
}

function isoDate(value: unknown): string | null {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function categorize(title: string): FeedCategory {
  if (/장학|학자금|생활비 지원/.test(title)) return "장학";
  if (/수강|등록|휴학|복학|졸업|학점|학사|시험|성적|예비군|e러닝|계절학기/.test(title)) return "학사";
  if (/셔틀|버스|건물|주차|축제|행사|도서관|캠퍼스|시설/.test(title)) return "캠퍼스";
  return "기타";
}

export function parseAcademicFeed(xml: string): FeedItem[] {
  const feed = parser.parse(xml).feed;
  if (!feed) throw new Error("Invalid academic Atom feed");
  return asArray(feed.entry).flatMap((entry) => {
    const title = plainText(entry.title);
    if (!/\bERICA\b|에리카/i.test(title)) return [];
    const link = asArray(entry.link).find((item) => item?.["@_rel"] === "alternate") ?? asArray(entry.link)[0];
    const url = String(link?.["@_href"] ?? "");
    if (!url.startsWith("https://ehaksa.hanyang.ac.kr/notice")) return [];
    return [{
      id: `academic:${url}`,
      title,
      url,
      summary: plainText(entry.summary).slice(0, 240),
      source: "academic" as const,
      sourceName: "ERICA 학사 공지",
      category: categorize(title),
      publishedAt: isoDate(entry.published),
    }];
  });
}

export function parseBlogFeed(xml: string): FeedItem[] {
  const channel = parser.parse(xml).rss?.channel;
  if (!channel) throw new Error("Invalid blog RSS feed");
  return asArray(channel.item).flatMap((entry) => {
    const title = plainText(entry.title);
    const url = String(entry.link ?? "");
    if (!/^https?:\/\/blog\.naver\.com\/hyerica4473\//.test(url)) return [];
    return [{
      id: `blog:${url}`,
      title,
      url,
      summary: plainText(entry.description).slice(0, 240),
      source: "blog" as const,
      sourceName: "ERICA 공식 블로그",
      category: categorize(title),
      publishedAt: isoDate(entry.pubDate),
    }];
  });
}

async function fetchXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "ERICA-information-hub/1.0" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
  return response.text();
}

export async function collectEricaFeed(fetcher: (url: string) => Promise<string> = fetchXml): Promise<FeedCollection> {
  const sources = await Promise.allSettled([
    fetcher(ACADEMIC_RSS).then(parseAcademicFeed),
    fetcher(BLOG_RSS).then(parseBlogFeed),
  ]);
  const unavailableSources: FeedSource[] = [];
  const successfulSources: FeedSource[] = [];
  const items: FeedItem[] = [];
  for (let index = 0; index < sources.length; index++) {
    const result = sources[index];
    const source: FeedSource = index === 0 ? "academic" : "blog";
    if (result.status === "fulfilled" && (source !== "blog" || result.value.length > 0)) {
      items.push(...result.value);
      successfulSources.push(source);
    } else {
      unavailableSources.push(source);
      console.warn(`ERICA feed ${source} unavailable:`, result.status === "rejected" ? result.reason : "empty RSS");
    }
  }
  return { items, collectedAt: new Date().toISOString(), successfulSources, unavailableSources };
}

export async function syncEricaFeed(requireDatabase = false): Promise<FeedResponse> {
  if (requireDatabase && !process.env.FEED_DATABASE_URL) {
    throw new Error("FEED_DATABASE_URL is required for scheduled sync");
  }
  const collected = await collectEricaFeed();
  if (!collected.successfulSources.length) throw new Error("Both ERICA feed sources failed");
  const saved = await saveFeedCollection(collected, requireDatabase);
  cache = saved;
  cacheExpiresAt = Date.now() + CACHE_MS;
  if (requireDatabase && collected.unavailableSources.length) {
    throw new Error(`Feed sources failed: ${collected.unavailableSources.join(", ")}`);
  }
  return saved;
}

export async function getEricaFeed(): Promise<FeedResponse> {
  if (cache && Date.now() < cacheExpiresAt) return cache;
  pending ??= (async () => {
    const saved = await loadFeedIndex();
    if (saved && Date.now() - new Date(saved.fetchedAt).getTime() < CACHE_MS) {
      cache = saved;
      cacheExpiresAt = Date.now() + CACHE_MS;
      return saved;
    }
    try {
      return await syncEricaFeed();
    } catch (error) {
      if (!saved) throw error;
      console.warn("ERICA feed refresh failed; showing saved items:", error);
      cache = { ...saved, unavailableSources: ["academic", "blog"] };
      cacheExpiresAt = Date.now() + 60_000;
      return cache;
    }
  })().finally(() => { pending = null; });
  return pending;
}

export function filterFeed(items: FeedItem[], query: string, source: string, category: string): FeedItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (source && item.source !== source) return false;
    if (category && item.category !== category) return false;
    const searchable = `${item.title} ${item.summary}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
