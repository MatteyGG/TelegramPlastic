import { writeFileSync } from "fs";

type Metrics = {
  totalRequests: number;
  cacheHits: number;
  faqHits: number;
  popularQuestions: Record<string, number>;
};

const metrics: Metrics = {
  totalRequests: 0,
  cacheHits: 0,
  faqHits: 0,
  popularQuestions: {},
};

export function logRequest(question: string, source: "cache" | "faq" | "ai") {
  metrics.totalRequests++;

  if (source === "cache") metrics.cacheHits++;
  if (source === "faq") metrics.faqHits++;

  metrics.popularQuestions[question] =
    (metrics.popularQuestions[question] || 0) + 1;

  // Автосохранение каждые 5 минут
  if (metrics.totalRequests % 10 === 0) {
    writeFileSync("metrics.json", JSON.stringify(metrics, null, 2));
  }
}
