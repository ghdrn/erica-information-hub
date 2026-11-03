import { useMutation } from "@tanstack/react-query";
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: any[];
  sources?: {
    chunkId?: number;
    documentId?: number;
    documentName: string;
    content: string;
    pageNumber?: number;
    score: number;
    url?: string;
    publishedAt?: string;
  }[];
  error?: string;
  timestamp: Date;
};

interface ChatOptions {
  message: string;
  useRag?: boolean;
  userProfile?: {
    campus: "ERICA";
    college: string;
    department: string;
  } | null;
}

export function useChat() {
  return useMutation({
    mutationFn: async (options: ChatOptions) => {
      const { message, useRag, userProfile } = options;
      
      // Use RAG endpoint if enabled
      if (useRag) {
        const res = await fetch('/api/rag/query', {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: message }),
          credentials: "include",
        });
        
        if (!res.ok) {
          throw new Error("문서 검색에 실패했습니다");
        }
        
        const data = await res.json();
        return {
          answer: data.answer,
          sql: '',
          data: [],
          sources: data.sources,
        };
      }

      const res = await fetch('/api/erica-chat', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: message, userProfile }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "질문 처리에 실패했습니다" }));
        throw new Error(errorData.message || "질문 처리에 실패했습니다");
      }

      const data = await res.json();
      return {
        answer: data.answer,
        sql: '',
        data: [],
        sources: (data.sources || []).map((source: any, index: number) => ({
          chunkId: index,
          documentId: index,
          documentName: source.title,
          content: source.snippet || source.content,
          score: source.score ?? 0,
          url: source.url,
          publishedAt: source.publishedAt,
        })),
      };
    },
  });
}
