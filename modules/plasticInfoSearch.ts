import { Product, SearchProduct } from '../types';
import { normalizeString } from '../lib/normalizeString';
import { mainLogger } from './logger';

// Критически важные материалы с их синонимами
const CRITICAL_MATERIALS: Record<string, string[]> = {
  'pla': ['pla', 'plа', 'pIa', 'пла'],
  'abs': ['abs', 'аbs', 'abѕ', 'абс'],
  'petg': ['petg', 'pet-g', 'pеtg', 'петг'],
  'rpetg': ['rpetg', 'rpet-g', 'rpеtg', 'рпетг'],
  'tpu': ['tpu', 'tрu', 'тпу'],
  'hips': ['hips', 'hips', 'hiрs', 'хипс'],
  'asa': ['asa', 'аsa', 'asa', 'аса'],
  'pc': ['pc', 'pс', 'пк', 'поликарбонат'],
  'pa': ['pa', 'pа', 'па', 'полиамид'],
  'pp': ['pp', 'рр', 'пп', 'полипропилен'],
  'nylon': ['nylon', 'nуlon', 'нейлон'],
  'pmma': ['pmma', 'pmmа', 'пмма'],
};

/**
 * Поиск пластиков с улучшенным учетом критических материалов
 */
export const searchProducts = (
  query: string,
  products: SearchProduct[],
  threshold: number = 0.5
): SearchProduct[] => {
  const normalizedQuery = normalizeString(query);
  const queryWords = normalizedQuery.split(' ');
  
  mainLogger.debug(`searchProducts: queryWords=${queryWords}`);
  
  // Сначала ищем точные совпадения критических материалов
  const criticalMatches = findCriticalMaterialMatches(queryWords);
  
  return products.filter(product => {
    const matchScore = calculateMatchScore(queryWords, product.searchKeywords, criticalMatches);
    return matchScore >= calculateRequiredScore(queryWords, criticalMatches);
  });
};

/**
 * Поиск критических материалов в запросе
 */
function findCriticalMaterialMatches(queryWords: string[]): Set<string> {
  const matches = new Set<string>();
  
  for (const word of queryWords) {
    for (const [canonical, variants] of Object.entries(CRITICAL_MATERIALS)) {
      if (variants.includes(word)) {
        matches.add(canonical);
        break;
      }
    }
  }
  
  return matches;
}

/**
 * Расчет скоринга совпадений
 */
function calculateMatchScore(
  queryWords: string[], 
  keywords: string[], 
  criticalMatches: Set<string>
): number {
  let score = 0;
  
  for (const qWord of queryWords) {
    // Проверяем, является ли слово критическим материалом
    let isCritical = false;
    for (const [canonical, variants] of Object.entries(CRITICAL_MATERIALS)) {
      if (variants.includes(qWord)) {
        isCritical = true;
        // Критическое слово должно точно совпадать
        if (keywords.includes(canonical)) {
          score += 2; // Больший вес для критических совпадений
        }
        break;
      }
    }
    
    if (!isCritical) {
      // Не критическое слово - используем адаптивный порог
      const dynamicThreshold = qWord.length < 4 ? 0.3 : 0.5;
      const distanceLimit = Math.floor(qWord.length * dynamicThreshold);
      
      const hasMatch = keywords.some(keyword => {
        const distance = levenshteinDistance(qWord, keyword);
        return distance <= distanceLimit;
      });
      
      if (hasMatch) score += 1;
    }
  }
  
  // Дополнительные баллы за совпадение критических материалов
  for (const criticalMatch of criticalMatches) {
    if (keywords.includes(criticalMatch)) {
      score += 1;
    }
  }
  
  return score;
}

/**
 * Расчет требуемого скоринга на основе запроса
 */
function calculateRequiredScore(queryWords: string[], criticalMatches: Set<string>): number {
  const baseRequired = queryWords.length * 0.6;
  
  // Увеличиваем требования при наличии критических материалов
  if (criticalMatches.size > 0) {
    return baseRequired + criticalMatches.size * 0.5;
  }
  
  return baseRequired;
}

// Алгоритм Левенштейна (без изменений)
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