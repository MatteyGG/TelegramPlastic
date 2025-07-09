import { Product, SearchProduct } from '../types';
import { normalizeString } from '../lib/normalizeString';
import { mainLogger } from './logger';
/**
 * Поиск пластиков с учетом нечеткого соответствия
 * @param {string} query Поисковый запрос
 * @param {SearchProduct[]} products Продукты для поиска
 * @param {number} threshold Порог сходства (по умолчанию 0.5)
 * @returns {SearchProduct[]} Продукты, соответствующие запросу
 */
export const searchProducts = (
  query: string,
  products: SearchProduct[],
  threshold: number = 0.5
): SearchProduct[] => {
  // Нормализация запроса
  const normalizedQuery = normalizeString(query);
  const queryWords = normalizedQuery.split(' ');
  
  mainLogger.debug(`searchProducts: queryWords=${queryWords}`);
  
  // Фильтрация продуктов, которые соответствуют запросу
  return products.filter(product => {
    const matchScore = queryWords.reduce((score: number, qWord: string) => {
      const dynamicThreshold = qWord.length < 4 ? 0.3 : 0.5;
      const distanceLimit = Math.floor(qWord.length * dynamicThreshold);
      const wordMatch = product.searchKeywords.some((keyword: string) => {
        const distance = levenshteinDistance(qWord, keyword);
        return distance <= distanceLimit;
      });
      return score + (wordMatch ? 1 : 0);
    }, 0);
    mainLogger.debug(`searchProducts: matchScore=${matchScore}`);
    return matchScore >= queryWords.length * 0.7;
  });
};

// Алгоритм Левенштейна
const levenshteinDistance = (a: string, b: string): number => {

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i-1) === a.charAt(j-1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

