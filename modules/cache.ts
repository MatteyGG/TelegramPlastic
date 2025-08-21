import { LRUCache } from "lru-cache";
import { Product } from "../types";
 


const MAX_HISTORY_LENGTH = 6; // Сохраняем последние 3 пары вопрос-ответ

type CacheEntry = {
  answer: string;
  timestamp: number;
};

const CACHE_CONFIG = {
  FAQ: {
    max: 50, // 50 последних FAQ-ответов
    ttl: 3600 * 1000 * 2, // 2 часа
  },
  SEARCH: {
    max: 100, // 100 поисковых запросов
    ttl: 3600 * 1000, // 1 час
  },
  GENERAL: {
    max: 30, // 30 общих ответов
    ttl: 3600 * 1000 * 24, // 24 часа
  }
};

// Создаем отдельные кэши
export const caches = {
  faq: new LRUCache<string, CacheEntry>(CACHE_CONFIG.FAQ),
  search: new LRUCache<string, CacheEntry>(CACHE_CONFIG.SEARCH),
  general: new LRUCache<string, CacheEntry>(CACHE_CONFIG.GENERAL),
};

export function getCacheResponse(module: keyof typeof caches, question: string): string | null {
  return caches[module].get(question.toLowerCase())?.answer || null;
}

export function setCacheResponse(
  module: keyof typeof caches,
  question: string,
  answer: string
): void {
  caches[module].set(question.toLowerCase(), {
    answer,
    timestamp: Date.now(),
  });
}

// Для админ-панели (опционально)
export function getCacheStats() {
  return {
    faq: caches.faq.size,
    search: caches.search.size,
    general: caches.general.size,
    clientDialogCache: chatCache.size,
    total: caches.faq.size + caches.search.size + caches.general.size
  };
}


export type ChatContext = {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  isRelevant: boolean;
  waitingForProductSelection?: boolean;
  candidateProducts?: Product[];
  pendingMessage?: string;
  selectedProducts?: Product[];
  
};

export class ChatCache {
  private cache: LRUCache<string, ChatContext>;
  
  constructor() {
    this.cache = new LRUCache<string, ChatContext>({
      max: 1000,
      ttl: 3600 * 1000,
    });
  }

  getOrCreate(chatId: string): ChatContext {
    if (!this.cache.has(chatId)) {
      this.cache.set(chatId, {
        history: [],
        isRelevant: false,
      });
    }
    return this.cache.get(chatId)!;
  }

  update(chatId: string, context: ChatContext) {
    this.cache.set(chatId, context);
  }

  updateHistory(chatId: string, message: { role: "user" | "assistant"; content: string }): ChatContext {
    const context = this.getOrCreate(chatId);
    context.history.push(message);
    
    if (context.history.length > MAX_HISTORY_LENGTH * 2) {
      context.history = context.history.slice(-MAX_HISTORY_LENGTH * 2);
    }
    
    this.cache.set(chatId, context);
    return context;
  }

  get size(): number {
    return this.cache.size;
  }
}

export const chatCache = new ChatCache();