// faq.ts

import { FAQ } from "../lib/text_faq";

export const CACHE = new Map<string, string>();

export function findFAQAnswer(question: string): string | null {
  const lowerQ = question.toLowerCase();

  // Прямое совпадение в кэше
  if (CACHE.has(lowerQ)) return CACHE.get(lowerQ)!;

  // Поиск по ключевым словам
  for (const item of FAQ) {
    if (item.keywords.some((kw) => lowerQ.includes(kw))) {
      CACHE.set(lowerQ, item.answer);
      return item.answer;
    }
  }
  return null;
}
