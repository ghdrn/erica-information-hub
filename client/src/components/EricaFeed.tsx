import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";

type FeedItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: "academic" | "blog";
  sourceName: string;
  category: "학사" | "장학" | "캠퍼스" | "기타";
  publishedAt: string | null;
};

type FeedResponse = {
  items: FeedItem[];
  fetchedAt: string;
  unavailableSources: Array<"academic" | "blog">;
  storageWarning?: boolean;
};

const sourceLinks = [
  { name: "ERICA 학사", detail: "수강·등록·졸업 공지", url: "https://ehaksa.hanyang.ac.kr/notice", color: "bg-emerald-500" },
  { name: "ERICA 블로그", detail: "캠퍼스 생활·소식", url: "https://blog.naver.com/hyerica4473", color: "bg-rose-500" },
  { name: "총학생회", detail: "행사·혜택·사업", url: "https://www.instagram.com/hanyang_erica_stu/", color: "bg-amber-500" },
  { name: "HY-in", detail: "개인 학사 업무", url: "https://portal.hanyang.ac.kr/", color: "bg-sky-500" },
];

function formatDate(value: string | null): string {
  if (!value) return "게시일 미확인";
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function EricaFeed() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  async function loadFeed() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/erica-feed");
      if (!response.ok) throw new Error("공지 목록을 불러오지 못했습니다.");
      setFeed(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "공지 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFeed(); }, []);
  useEffect(() => { setVisibleCount(20); }, [query, source, category]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return (feed?.items ?? []).filter((item) => {
      if (source && item.source !== source) return false;
      if (category && item.category !== category) return false;
      const text = `${item.title} ${item.summary}`.toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }, [feed, query, source, category]);

  return (
    <section className="space-y-5" aria-label="통합 정보 피드">
      <div className="grid border-y border-border bg-card sm:grid-cols-4">
        {sourceLinks.map((link) => (
          <a key={link.name} href={link.url} target="_blank" rel="noreferrer" className="group flex min-w-0 items-center gap-3 border-b border-border px-3 py-3.5 transition hover:bg-muted/60 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <span className={`h-8 w-1 shrink-0 ${link.color}`} aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{link.name}</span><span className="block truncate text-xs text-muted-foreground">{link.detail}</span></span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">공지 검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="목록의 제목·요약 검색" className="h-11 w-full rounded-md border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1 sm:w-32 sm:flex-none"><span className="sr-only">출처 필터</span><select value={source} onChange={(event) => setSource(event.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-2 text-sm"><option value="">모든 출처</option><option value="academic">학사 공지</option><option value="blog">블로그</option></select></label>
          <label className="min-w-0 flex-1 sm:w-28 sm:flex-none"><span className="sr-only">주제 필터</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-2 text-sm"><option value="">모든 주제</option><option value="학사">학사</option><option value="장학">장학</option><option value="캠퍼스">캠퍼스</option><option value="기타">기타</option></select></label>
        </div>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 border-b border-border pb-3 text-xs text-muted-foreground">
        <span>{loading ? "목록 불러오는 중" : `공개 글 ${filtered.length}건 · 최신 게시일순`}</span>
        <button type="button" onClick={() => void loadFeed()} disabled={loading} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground disabled:opacity-50" title="목록 새로 확인"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />새로고침</button>
      </div>

      {feed?.unavailableSources.length ? <p role="status" className="border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs text-foreground">일부 출처를 현재 확인할 수 없습니다. 해당 출처의 글은 이전 목록이거나 누락되었을 수 있으니 원문에서 확인해 주세요.</p> : null}
      {feed?.storageWarning && <p role="status" className="border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-xs text-foreground">공유 DB에 연결되지 않아 이 서버의 로컬 저장본을 표시하고 있습니다. 다른 기기와 목록이 다를 수 있습니다.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && !feed && <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />공개 공지를 불러오는 중입니다.</div>}
      {!loading && !error && filtered.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">일치하는 공개 글이 없습니다. 다른 검색어를 입력하거나 원문 채널을 확인해 주세요.</p>}

      <div className="divide-y divide-border">
        {filtered.slice(0, visibleCount).map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="group flex gap-3 py-4 transition hover:bg-muted/40 sm:px-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span className={`font-semibold ${item.source === "academic" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{item.sourceName}</span><span aria-hidden="true">·</span><span>{item.category}</span><span aria-hidden="true">·</span><time dateTime={item.publishedAt ?? undefined}>{formatDate(item.publishedAt)}</time></div>
              <h3 className="break-keep text-sm font-semibold leading-6 text-foreground group-hover:underline">{item.title}</h3>
              {item.summary && <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</p>}
            </div>
            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
          </a>
        ))}
      </div>
      {filtered.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + 20)} className="w-full rounded-md border border-border py-2.5 text-sm font-medium hover:bg-muted">더 보기</button>}
      {feed && <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">수집된 공개 RSS 글 기준 · 마지막 수집 {new Date(feed.fetchedAt).toLocaleString("ko-KR")} · 포털과 인스타그램은 원문 채널에서 확인</p>}
    </section>
  );
}
