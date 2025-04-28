// faq.ts

import { MATERIALS } from "../lib/context";

type FAQItem = {
  keywords: string[];
  answer: string;
};

export const FAQ: FAQItem[] = [
  {
    keywords: ["начать", "новичок", "начинающим"],
    answer: `PLA - идеальный выбор для старта! Легко печатается, нетоксичен. Рекомендую параметры: 
Температура сопла: 200-220°C 🌡️
Платформы: 50-60°C
Скорость: 50-60 мм/с
${MATERIALS?.PLA?.links?.[0] || ""}`,
  },
  {
    keywords: ["прочный", "прочность", "нагрузки"],
    answer: `Для прочных деталей используйте ABS или PETG 🔧
ABS - ударопрочный, термостойкий (до 100°C)
PETG - химически стойкий, гибкий
${MATERIALS?.ABS?.links?.[0] || ""}
${MATERIALS?.PETG?.links?.[0] || ""}`,
  },
];

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
