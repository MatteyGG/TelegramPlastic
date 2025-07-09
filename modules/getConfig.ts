import fs from 'fs/promises';
import path from 'path';
import { mainLogger } from './logger';
import { Product, SearchProduct } from '../types';
import { normalizeString } from '../lib/normalizeString';

export interface Config {
  faq: Array<{ keywords: string[]; answer: string }>;
  materials: Record<string, { links: string[] }>;
  responses: Record<string, string>;
  prompt: { system_prompt: string };
  products: Product[];
}

let config: Config = {} as Config;
let isConfigLoaded = false;

export const CONFIG_PATH = path.join(__dirname, '../config');


// Универсальный загрузчик конфигов
async function loadConfigFile<T>(fileName: string): Promise<T> {
  mainLogger.info(`CONFIG_PATH: ${CONFIG_PATH}`); // Проверит реальный путь
  mainLogger.info(`Files in config dir: ${await fs.readdir(CONFIG_PATH)}`); // Список файлов
  const filePath = path.join(CONFIG_PATH, `${fileName}.json`);
  // mainLogger.info(`Loading config from: ${filePath}`);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

// Основная функция загрузки
export async function loadConfig(force = false): Promise<void> {
  if (isConfigLoaded && !force) return;
  
  try {
    const [faq, materials, responses, prompt, products] = await Promise.all([
      loadConfigFile<{ FAQ: Config['faq'] }>('faq').then(r => r.FAQ),
      loadConfigFile<{ materials: Config['materials'] }>('materials'),
      loadConfigFile<Config['responses']>('responses'),
      loadConfigFile<Config['prompt']>('prompt'),
      loadConfigFile<{ products: Config['products'] }>('products'),
    ]);

    config = {
      faq,
      materials: materials.materials,
      responses,
      prompt,
      products: products.products
    };

    isConfigLoaded = true;
    mainLogger.info('✅ Конфигурация успешно загружена');
  } catch (error) {
    mainLogger.error('🚨 Ошибка загрузки конфигурации:', error);
    throw new Error('Failed to load configs');
  }
}

// геттеры
export function getResponse(key: string): string {
  return config.responses?.[key] || 'Ответ не найден';
}

export function getFAQ(): Config['faq'] {
  return config.faq || [];
}

export function getMaterial(name: string): string[] {
  return config.materials?.[name.toUpperCase()]?.links || [];
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