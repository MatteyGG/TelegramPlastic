import lunr from "lunr";
import { getFAQ, loadConfig } from "./getConfig";
import { caches } from "./cache";

type FAQItem = {
  keywords: string[];
  answer: string;
};

let searchIndex: lunr.Index;
let faqData: FAQItem[] = [];

export async function initSearch() {
  // Загружаем конфигурацию перед созданием индекса
  if (!faqData.length) {
    await loadConfig();
    faqData = getFAQ();
  }

  searchIndex = lunr(function () {
    this.ref("id");
    this.field("keywords", { boost: 10 });
    this.field("answer");

    faqData.forEach((item, id) => {
      this.add({
        id: id.toString(),
        keywords: item.keywords.join(" "),
        answer: item.answer
      });
    });
  });
}

export async function searchFAQ(query: string): Promise<string | null> {
  const lowerQ = query.toLowerCase();
  
  // Проверяем кэш поиска
  const cached = caches.search.get(lowerQ);
  if (cached) return cached.answer;

  
  const results = searchIndex.query(q => {
    q.term(query.toLowerCase(), {
      fields: ["keywords"],
      editDistance: 2,
      wildcard: lunr.Query.wildcard.TRAILING
    });
  });

  if (results.length > 0) {
    const answer = faqData[parseInt(results[0].ref)].answer;
    // Сохраняем в кэш поиска
    caches.search.set(lowerQ, {
      answer,
      timestamp: Date.now()
    });
    return answer;
  }
  
  return null;
}