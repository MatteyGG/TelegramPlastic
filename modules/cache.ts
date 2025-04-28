import { LRUCache } from "lru-cache";

type CacheEntry = {
  answer: string;
  timestamp: number;
};

const options = {
  // 508 байт * 100 ≈ 50.8 КБ
  max: 100,
  ttl: 3600 * 1000, // 1 час
  updateAgeOnGet: true,
};

export const cache = new LRUCache<string, CacheEntry>(options);

export function getCacheResponse(question: string): string | null {
  const entry = cache.get(question.toLowerCase());
  return entry?.answer || null;
}

export function getAllCache(): Map<string, CacheEntry> {
  const cacheMap = new Map<string, CacheEntry>();
  cache.forEach((value, key) => {
    cacheMap.set(key, value);
  });
  return cacheMap;
}

export function setCacheResponse(question: string, answer: string): void {
  cache.set(question.toLowerCase(), {
    answer,
    timestamp: Date.now(),
  });
}

