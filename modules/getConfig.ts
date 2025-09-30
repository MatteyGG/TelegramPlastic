// src/modules/getConfig.ts
import { mainLogger } from './logger';
import { Product, SearchProduct } from '../types';
import { normalizeString } from '../lib/normalizeString';
import { prisma } from './database';

export interface Config {
  responses: Record<string, string>;
  prompt: { system_prompt: string };
  products: Product[];
}



let config: Config = {} as Config;
let isConfigLoaded = false;


// Основная функция загрузки
export async function loadConfig(force = false): Promise<void> {
  if (isConfigLoaded && !force) return;
  
  try {
    // Загружаем данные из базы
    const [responses, prompt, products] = await Promise.all([
      loadResponsesFromDB(),
      loadPromptFromDB(),
      loadProductsFromDB(),
    ]);

    config = {
      responses,
      prompt,
      products
    };

    isConfigLoaded = true;
    mainLogger.info('✅ Конфигурация успешно загружена из БД');
  } catch (error) {
    mainLogger.error('🚨 Ошибка загрузки конфигурации из БД:', error as any);
    throw new Error('Failed to load configs from database');
  }
}

// Загрузка responses из БД
async function loadResponsesFromDB(): Promise<Record<string, string>> {
  const responses = await prisma.response.findMany();
  const result: Record<string, string> = {};
  
  responses.forEach(item => {
    result[item.key] = item.value;
  });
  
  return result;
}

// Загрузка prompt из БД
async function loadPromptFromDB(): Promise<{ system_prompt: string }> {
  const prompt = await prisma.prompt.findFirst({
    where: { key: 'system_prompt' }
  });
  
  return {
    system_prompt: prompt?.value || 'Стандартный системный промпт'
  };
}

// Загрузка products из БД
async function loadProductsFromDB(): Promise<Product[]> {
  const products = await prisma.product.findMany();
  
  return products.map(product => ({
    id: product.id, 
    title: product.title,
    material: product.material,
    diameters: JSON.parse(product.diameters),
    colors: JSON.parse(product.colors),
    links: JSON.parse(product.links),
    weight: product.weight ?? '',
    description: product.description
  }));
}
// геттеры
export function getResponse(key: string): string {
  return config.responses?.[key] || 'Ответ не найден';
}

export function getSystemPrompt(): string {
  if (!config.prompt) {
    throw new Error("Конфиг prompt не загружен!");
  }
  return config.prompt.system_prompt;
}

export function getProducts(): SearchProduct[] {
  return config.products.map(product => ({
      ...product,
      searchKeywords: [...normalizeString(product.title).split(' '), ...normalizeString(product.material).split(' ')]
    }));
}