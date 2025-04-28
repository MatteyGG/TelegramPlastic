import lunr from "lunr";
import { FAQ } from "./faq";


let searchIndex: lunr.Index;

export function initSearch() {
  searchIndex = lunr(function () {
    this.ref("id");
    this.field("question");

    if (FAQ) {
      FAQ.forEach((item, id) => {
        this.add({
          id: id.toString(),
          question: item.keywords.join(" "),
          answer: item.answer,
        });
      });
    }
  });
}

export function searchFAQ(query: string): string | null {
  // Ищем ТОЛЬКО в поле question (ключевые слова)
  const results = searchIndex.search(`question:*${query}*`);
  return results.length > 0 ? FAQ[parseInt(results[0].ref)].answer : null;
}
