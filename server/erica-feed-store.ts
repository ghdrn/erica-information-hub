import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { FeedItem, FeedResponse, FeedSource } from "./erica-feed-service";

export type FeedCollection = {
  items: FeedItem[];
  collectedAt: string;
  successfulSources: FeedSource[];
  unavailableSources: FeedSource[];
};

const INDEX_PATH = path.resolve(process.env.FEED_INDEX_PATH || "data/erica-feed-index.json");
let pool: pg.Pool | null = null;

function databasePool(): pg.Pool | null {
  if (!process.env.FEED_DATABASE_URL) return null;
  pool ??= new pg.Pool({ connectionString: process.env.FEED_DATABASE_URL, connectionTimeoutMillis: 4000 });
  return pool;
}

async function ensureTables(client: pg.PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS erica_feed_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_name TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS erica_feed_sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    fetched_at TIMESTAMPTZ NOT NULL,
    unavailable_sources TEXT[] NOT NULL DEFAULT '{}'
  )`);
}

function sortItems(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export function mergeFeedSnapshots(previous: FeedResponse | null, collected: FeedCollection): FeedResponse {
  const items = new Map((previous?.items ?? []).map((item) => [item.id, item]));
  for (const item of collected.items) items.set(item.id, item);
  return {
    items: sortItems(Array.from(items.values())),
    fetchedAt: collected.collectedAt,
    unavailableSources: collected.unavailableSources,
    storageWarning: previous?.storageWarning,
  };
}

async function readFileIndex(): Promise<FeedResponse | null> {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, "utf8")) as FeedResponse;
    if (!Array.isArray(parsed.items) || typeof parsed.fetchedAt !== "string") throw new Error("Invalid feed index");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeFileIndex(feed: FeedResponse): Promise<void> {
  await mkdir(path.dirname(INDEX_PATH), { recursive: true });
  const temporary = `${INDEX_PATH}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(feed), "utf8");
  await rename(temporary, INDEX_PATH);
}

async function readDatabaseIndex(client: pg.PoolClient): Promise<FeedResponse | null> {
  const state = await client.query<{ fetched_at: Date; unavailable_sources: FeedSource[] }>(
    "SELECT fetched_at, unavailable_sources FROM erica_feed_sync_state WHERE id = 1",
  );
  if (!state.rows.length) return null;
  const rows = await client.query<{
    id: string; source: FeedSource; source_name: string; title: string; url: string;
    summary: string; category: FeedItem["category"]; published_at: Date | null;
  }>("SELECT id, source, source_name, title, url, summary, category, published_at FROM erica_feed_items ORDER BY published_at DESC NULLS LAST");
  return {
    items: rows.rows.map((row) => ({
      id: row.id, source: row.source, sourceName: row.source_name, title: row.title,
      url: row.url, summary: row.summary, category: row.category,
      publishedAt: row.published_at?.toISOString() ?? null,
    })),
    fetchedAt: state.rows[0].fetched_at.toISOString(),
    unavailableSources: state.rows[0].unavailable_sources,
  };
}

export async function loadFeedIndex(): Promise<FeedResponse | null> {
  const db = databasePool();
  if (!db) return readFileIndex();
  let client: pg.PoolClient | undefined;
  try {
    client = await db.connect();
    await ensureTables(client);
    return await readDatabaseIndex(client);
  } catch (error) {
    console.warn("Feed database unavailable; using local index:", error);
    const local = await readFileIndex();
    return local ? { ...local, storageWarning: true } : null;
  } finally {
    client?.release();
  }
}

export async function saveFeedCollection(collected: FeedCollection, requireDatabase = false): Promise<FeedResponse> {
  const db = databasePool();
  if (requireDatabase && !db) throw new Error("FEED_DATABASE_URL is required for scheduled sync");
  if (db) {
    let client: pg.PoolClient | undefined;
    try {
      client = await db.connect();
      await ensureTables(client);
      await client.query("BEGIN");
      for (const item of collected.items) {
        await client.query(`INSERT INTO erica_feed_items
          (id, source, source_name, title, url, summary, category, published_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET source_name = EXCLUDED.source_name,
            title = EXCLUDED.title, url = EXCLUDED.url, summary = EXCLUDED.summary,
            category = EXCLUDED.category, published_at = EXCLUDED.published_at,
            last_seen_at = NOW()`,
          [item.id, item.source, item.sourceName, item.title, item.url, item.summary, item.category, item.publishedAt]);
      }
      await client.query(`INSERT INTO erica_feed_sync_state (id, fetched_at, unavailable_sources)
        VALUES (1, $1, $2) ON CONFLICT (id) DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at, unavailable_sources = EXCLUDED.unavailable_sources`,
        [collected.collectedAt, collected.unavailableSources]);
      await client.query("COMMIT");
      return (await readDatabaseIndex(client))!;
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      if (requireDatabase) throw error;
      console.warn("Feed database unavailable; saving local index:", error);
    } finally {
      client?.release();
    }
  }
  const merged = mergeFeedSnapshots(await readFileIndex(), collected);
  merged.storageWarning = Boolean(db);
  await writeFileIndex(merged);
  return merged;
}

export async function closeFeedStore(): Promise<void> {
  await pool?.end();
  pool = null;
}
