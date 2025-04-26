import lunr from "lunr";
import { FAQ } from "../lib/text_faq";

let searchIndex: lunr.Index;

export function initSearch() {
  searchIndex = lunr(function () {
    this.ref("id");
    this.field("question");
    this.field("answer");

    FAQ.forEach((item, id) => {
      this.add({
        id: id.toString(),
        question: item.keywords.join(" "),
        answer: item.answer,
      });
    });
  });
}

export function searchFAQ(query: string): string | null {
  const results = searchIndex.search(`*${query}*`);
  return results.length > 0 ? FAQ[parseInt(results[0].ref)].answer : null;
}
