import { useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, GraduationCap, House, Loader2, MessageCircle, Moon, Plus, Send, Sun, User } from "lucide-react";
import { useChat, type Message } from "@/hooks/use-chat";
import { EricaFeed } from "@/components/EricaFeed";

const STORAGE_KEY = "erica_blog_chat_history";
const PROFILE_STORAGE_KEY = "erica_student_profile";
const PROFILE_SELECTED_KEY = "erica_student_profile_selected";

type StudentProfile = {
  campus: "ERICA";
  college: string;
  department: string;
};

const collegeDepartments = {
  "공학대학": [
    "건축학부",
    "건설환경공학과",
    "교통물류공학과",
    "전자공학부",
    "배터리소재화학공학과",
    "기계공학과",
    "산업경영공학과",
    "로봇공학과",
    "에너지바이오학과",
    "해양융합공학과",
    "융합시스템공학과",
    "스마트융합공학부",
  ],
  "소프트웨어융합대학": ["컴퓨터학부", "ICT융합학부", "인공지능학과", "수리데이터사이언스학과"],
  "첨단융합대학": ["차세대반도체융합공학부", "바이오신약융합학부", "국방지능정보융합공학부"],
  "약학대학": ["약학과"],
  "글로벌문화통상대학": ["글로벌문화통상학부"],
  "커뮤니케이션&컬처대학": ["광고홍보학과", "문화콘텐츠학과", "미디어학과", "문화인류학과"],
  "경상대학": ["경제학부", "회계세무학과", "경영학부", "보험계리학과"],
  "디자인대학": ["주얼리패션디자인학과", "커뮤니케이션디자인학과", "영상디자인학과", "산업디자인학과"],
  "예체능대학": ["스포츠과학부", "무용예술학과", "실용음악학과"],
  "LIONS칼리지": ["LIONS자율전공학부"],
} as const;

const emptyProfile = (): StudentProfile => ({ campus: "ERICA", college: "", department: "" });

function makeWelcomeMessage(): Message {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "안녕하세요. 한양대학교 ERICA 공식 블로그, 학교 홈페이지, 총학생회 채널을 참고해 캠퍼스 정보를 찾아주는 챗봇입니다. 학과 소개, 학교 소식, 캠퍼스 행사처럼 궁금한 내용을 편하게 물어보세요.",
    timestamp: new Date(),
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [makeWelcomeMessage()];

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [makeWelcomeMessage()];

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) return [makeWelcomeMessage()];
      return parsed.map((message: Message) => ({
        ...message,
        timestamp: new Date(message.timestamp),
      }));
    } catch {
      return [makeWelcomeMessage()];
    }
  });
  const [showHome, setShowHome] = useState(true);
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<StudentProfile>(() => {
    if (typeof window === "undefined") {
      return emptyProfile();
    }

    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) {
      return emptyProfile();
    }

    try {
      const parsed = JSON.parse(stored);
      const departments = collegeDepartments[parsed.college as keyof typeof collegeDepartments];
      if (!departments || (parsed.department && !Array.from(departments).includes(parsed.department))) {
        return emptyProfile();
      }
      if (parsed.college === "소프트웨어융합대학" && parsed.department === "컴퓨터학부" &&
        localStorage.getItem(PROFILE_SELECTED_KEY) !== "true") return emptyProfile();
      return { campus: "ERICA", college: parsed.college, department: parsed.department };
    } catch {
      return emptyProfile();
    }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("theme") === "dark";
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatMutation = useChat();
  const hasStartedChat = messages.some((message) => message.role === "user");
  const visibleMessages = hasStartedChat ? messages.filter((message) => message.id !== "welcome") : [];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (!showHome) bottomRef.current?.scrollIntoView();
  }, [showHome]);

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setShowHome(false);
    setInput("");

    chatMutation.mutate(
      { message: trimmed, userProfile: profile },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.answer,
              sources: data.sources,
              timestamp: new Date(),
            },
          ]);
        },
        onError: (error) => {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "질문을 처리하는 중 문제가 발생했습니다. Ollama가 실행 중인지 확인한 뒤 다시 시도해 주세요.",
              error: error.message,
              timestamp: new Date(),
            },
          ]);
        },
      },
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  function resetChat() {
    const welcome = makeWelcomeMessage();
    setMessages([welcome]);
    setShowHome(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([welcome]));
  }

  function updateCollege(college: string) {
    localStorage.setItem(PROFILE_SELECTED_KEY, "true");
    setProfile({
      campus: "ERICA",
      college,
      department: "",
    });
  }

  function renderQuestionForm() {
    return (
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage(input);
            }
          }}
          rows={1}
          disabled={chatMutation.isPending}
          placeholder="ERICA 캠퍼스 정보에 대해 질문해 보세요..."
          className="max-h-32 min-h-12 flex-1 resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="보내기"
        >
          {chatMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold sm:text-xl">Convergence Service Design</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">한양대학교 ERICA 통합 정보</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setShowHome(true)} className={`flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted ${showHome ? "font-semibold text-foreground" : "text-muted-foreground"}`} aria-label="정보 피드" title="정보 피드"><House className="h-4 w-4" /><span className="hidden sm:inline">정보</span></button>
            <button type="button" onClick={() => setShowHome(false)} className={`flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted ${!showHome ? "font-semibold text-foreground" : "text-muted-foreground"}`} aria-label="AI 질문" title="AI 질문"><MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">AI 질문</span></button>
            {!showHome && <button type="button" onClick={resetChat} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="새 대화" title="새 대화"><Plus className="h-4 w-4" /></button>}
            <button
              type="button"
              onClick={() => setIsDarkMode((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="테마 변경"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col px-4">
        {showHome ? (
          <div className="flex-1 space-y-7 py-6 sm:py-8">
            <div className="space-y-1"><h2 className="text-xl font-bold sm:text-2xl">ERICA 정보 모아보기</h2><p className="text-sm text-muted-foreground">학교 공지와 블로그 공개 글을 한곳에서 찾아보세요.</p></div>
            <EricaFeed />
            <details className="border-t border-border pt-5">
              <summary className="cursor-pointer text-sm font-medium">내 학과 설정 <span className="ml-2 font-normal text-muted-foreground">{profile.department || "선택 안 함"}</span></summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">단과대학</span>
                  <select
                    value={profile.college}
                    onChange={(event) => updateCollege(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">선택 안 함</option>
                    {Object.keys(collegeDepartments).map((college) => (
                      <option key={college} value={college}>
                        {college}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">학과/학부</span>
                  <select
                    value={profile.department}
                    onChange={(event) => {
                      localStorage.setItem(PROFILE_SELECTED_KEY, "true");
                      setProfile((current) => ({ ...current, department: event.target.value }));
                    }}
                    disabled={!profile.college}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">{profile.college ? "학과 선택 안 함" : "단과대학을 먼저 선택"}</option>
                    {(collegeDepartments[profile.college as keyof typeof collegeDepartments] || []).map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <section className="space-y-3 border-t border-border pt-5"><h2 className="text-base font-semibold">AI에게 질문</h2>{renderQuestionForm()}</section>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 py-6 pb-36">
              {visibleMessages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}

                  <div className={`max-w-[86%] space-y-3 ${message.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-6 shadow-sm ${
                        message.role === "user"
                          ? "border-primary/20 bg-primary text-primary-foreground"
                          : "border-border bg-card text-card-foreground"
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.error && (
                      <p className="px-1 text-xs text-destructive">{message.error}</p>
                    )}

                    {message.sources && message.sources.length > 0 && (
                      <div className="space-y-2">
                        {message.sources.slice(0, 3).map((source, index) => (
                          <a
                            key={`${source.url || source.documentName}-${index}`}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          >
                            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="line-clamp-1">{source.documentName}</span>
                            </div>
                            {source.publishedAt && (
                              <p className="mb-1 text-[11px]">게시일 {new Date(source.publishedAt).toLocaleDateString("ko-KR")}</p>
                            )}
                            <p className="line-clamp-3 leading-5">{source.content}</p>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    ERICA 공식 자료를 확인하고 답변을 정리하는 중...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-4 backdrop-blur">
              <div className="mx-auto max-w-5xl">
                {renderQuestionForm()}
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  답변은 ERICA 공식 블로그, 한양대학교 공식 홈페이지, 총학생회 채널 자료를 바탕으로 생성됩니다.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
