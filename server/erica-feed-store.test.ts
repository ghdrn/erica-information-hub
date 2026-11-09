import assert from "node:assert/strict";
import test from "node:test";
import { mergeFeedSnapshots } from "./erica-feed-store";
import type { FeedItem } from "./erica-feed-service";

const oldItem: FeedItem = {
  id: "blog:old", source: "blog", sourceName: "ERICA 공식 블로그", title: "지난 공지",
  url: "https://blog.naver.com/hyerica4473/1", summary: "", category: "기타",
  publishedAt: "2026-09-01T00:00:00.000Z",
};

test("new collection retains older posts no longer present in RSS", () => {
  const currentItem: FeedItem = { ...oldItem, id: "blog:new", title: "새 공지", url: "https://blog.naver.com/hyerica4473/2", publishedAt: "2026-11-01T00:00:00.000Z" };
  const result = mergeFeedSnapshots(
    { items: [oldItem], fetchedAt: "2026-09-01T00:00:00.000Z", unavailableSources: [] },
    { items: [currentItem], collectedAt: "2026-11-02T00:00:00.000Z", successfulSources: ["blog"], unavailableSources: ["academic"] },
  );
  assert.deepEqual(result.items.map((item) => item.id), ["blog:new", "blog:old"]);
  assert.deepEqual(result.unavailableSources, ["academic"]);
});

test("repeated collection updates a post without duplicating it", () => {
  const result = mergeFeedSnapshots(
    { items: [oldItem], fetchedAt: "2026-09-01T00:00:00.000Z", unavailableSources: [] },
    { items: [{ ...oldItem, title: "수정된 공지" }], collectedAt: "2026-11-02T00:00:00.000Z", successfulSources: ["blog"], unavailableSources: [] },
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "수정된 공지");
});
