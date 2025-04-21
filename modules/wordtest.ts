import { keywords } from "../lib/text";
import { PorterStemmerRu } from "natural";

/**
 * Determines if the given text is related to 3D printing by checking
 * for the presence of stemmed keywords related to 3D printing.
 *
 * @param text - The input text to check for 3D printing relevance.
 * @returns A boolean indicating whether the text is related to 3D printing.
 */

export function is3DPrintingRelated(text: string | null | undefined): boolean {
  if (typeof text !== "string") {
    throw new Error(
      "is3DPrintingRelated() expects a string argument, but got " +
        JSON.stringify(text)
    );
  }

  const stemmedKeywords = keywords.map((w) =>
    PorterStemmerRu.stem(w.toLowerCase())
  );

  try {
    return text
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/g) // Разрешаем цифры в словах
      .some((word) => stemmedKeywords.includes(PorterStemmerRu.stem(word)));
  } catch (e) {
    console.error(
      "is3DPrintingRelated() encountered an error: ",
      e instanceof Error ? e.message : e
    );
    throw e;
  }
}