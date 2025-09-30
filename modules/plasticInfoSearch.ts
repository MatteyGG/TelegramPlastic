// src/modules/plasticInfoSearch.ts

import { Product, SearchProduct } from '../types';
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

// src/modules/plasticInfoSearch.ts

/**
 * Поиск пластиков на основе рекомендаций AI
 */
/**
 * Улучшенный поиск продуктов по рекомендациям AI
 * Теперь ищет только продукты, материал которых ТОЧНО совпадает с одним из рекомендованных
 */
export function searchProductsByAIMaterials(aiRecommendation: string, products: any[]) {
  const recommendedMaterials = parseMaterialsFromAIResponse(aiRecommendation);
  
  return products.filter((product: { material: string; }) => {
    const productMaterial = product.material.toUpperCase();
    
    // Только точное совпадение с основными материалами
    return recommendedMaterials.some(material => 
      productMaterial === material || 
      productMaterial === material + '-G' // Для PET-G
    );
  });
}
// Вспомогательная функция для нормализации строк
function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Парсит список материалов из ответа AI в формате [MATERIAL1, MATERIAL2, MATERIAL3]
 */
function parseMaterialsFromAIResponse(aiResponse: string): string[] {
  try {
    const match = aiResponse.match(/\[([^\]]+)\]/);
    if (match) {
      const materialsString = match[1];
      return materialsString
        .split(',')
        .map(material => material.trim().toUpperCase())
        .filter(material => material.length > 0);
    }
    
    return aiResponse
      .split(',')
      .map(material => material.trim().toUpperCase())
      .filter(material => material.length > 0)
      .slice(0, 3);
  } catch (error) {
    console.error("Error parsing materials from AI response:", error);
    return [];
  }
}

/**
 * Улучшенный поиск с учетом контекста применения
 */
export const searchProductsWithContext = (
  userMessage: string,
  aiRecommendation: string,
  products: SearchProduct[]
): SearchProduct[] => {
  const productsByMaterial = searchProductsByAIMaterials(aiRecommendation, products);
  
  // Если по материалам ничего не найдено, используем старый алгоритм как fallback
  if (productsByMaterial.length === 0) {
    mainLogger.debug('Fallback to original search algorithm');
    return searchProducts(userMessage, products);
  }
  
  return productsByMaterial;
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