import assert from "node:assert/strict";
import test from "node:test";
import { categorize, filterFeed, parseAcademicFeed, parseBlogFeed } from "./erica-feed-service";

test("academic Atom feed keeps ERICA posts and their published date", () => {
  const xml = `<feed><entry><title>[ERICA] 2026-2학기 학생예비군 안내</title><link rel="alternate" href="https://ehaksa.hanyang.ac.kr/notice?messageId=123&amp;view=1"/><published>2026-08-25T00:13:00Z</published><updated>2026-11-02T23:15:18Z</updated><summary type="html"><![CDATA[훈련 일정 <b>확인</b>]]></summary></entry><entry><title>[서울] 공지</title><link rel="alternate" href="https://ehaksa.hanyang.ac.kr/notice?messageId=456"/></entry></feed>`;
  const items = parseAcademicFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, "2026-08-25T00:13:00.000Z");
  assert.equal(items[0].category, "학사");
  assert.equal(items[0].summary, "훈련 일정 확인");
  assert.match(items[0].url, /messageId=123&view=1/);
});

test("blog RSS retains only the official blog and supports text search", () => {
  const xml = `<rss><channel><item><title>생활비 지원 장학 안내</title><link>https://blog.naver.com/hyerica4473/123</link><description><![CDATA[신청 <b>마감</b> 확인]]></description><pubDate>Tue, 03 Nov 2026 06:04:50 GMT</pubDate></item><item><title>다른 블로그</title><link>https://blog.naver.com/other/999</link></item></channel></rss>`;
  const items = parseBlogFeed(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].category, "장학");
  assert.equal(items[0].summary, "신청 마감 확인");
  assert.equal(filterFeed(items, "생활비 장학", "blog", "장학").length, 1);
  assert.equal(filterFeed(items, "생활비 장학", "academic", "").length, 0);
  assert.equal(categorize("명절연휴 셔틀버스"), "캠퍼스");
});
