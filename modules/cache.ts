import { LRUCache } from "lru-cache";

type CacheEntry = {
  answer: string;
  timestamp: number;
};

const options = {
  max: 100,
  ttl: 3600 * 1000, // 1 час
  updateAgeOnGet: true,
};

export const cache = new LRUCache<string, CacheEntry>(options);

export function getCacheResponse(question: string): string | null {
  const entry = cache.get(question.toLowerCase());
  return entry?.answer || null;
}

export function setCacheResponse(question: string, answer: string): void {
  cache.set(question.toLowerCase(), {
    answer,
    timestamp: Date.now(),
  });
}

