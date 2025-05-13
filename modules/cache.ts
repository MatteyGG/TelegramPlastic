import { LRUCache } from "lru-cache";

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
  };
}