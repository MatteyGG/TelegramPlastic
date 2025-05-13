import { getFAQ } from './getConfig';
import { caches } from './cache';

export function findFAQAnswer(question: string): string | null {
  const lowerQ = question.toLowerCase();
  
  // Проверяем кэш FAQ
  const cached = caches.faq.get(lowerQ);
  if (cached) return cached.answer;

  const faqData = getFAQ();
  
  for (const item of faqData) {
    if (item.keywords.some(kw => lowerQ.includes(kw.toLowerCase()))) {
      // Сохраняем в кэш FAQ
      caches.faq.set(lowerQ, {
        answer: item.answer,
        timestamp: Date.now()
      });
      return item.answer;
    }
  }
  return null;
}