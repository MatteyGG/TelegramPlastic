import fs from 'fs/promises';
import path from 'path';

export interface Config {
  faq: Array<{ keywords: string[]; answer: string }>;
  materials: Record<string, { links: string[] }>;
  responses: Record<string, string>;
  prompt: { system_prompt: string };
}

let config: Config = {} as Config;
let isConfigLoaded = false;
const CONFIG_DIR = path.join(__dirname, '../config');

// Универсальный загрузчик конфигов
async function loadConfigFile<T>(fileName: string): Promise<T> {
  const filePath = path.join(CONFIG_DIR, `${fileName}.json`);
  // console.log(`Loading config from: ${filePath}`);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

// Основная функция загрузки
export async function loadConfig(force = false): Promise<void> {
  if (isConfigLoaded && !force) return;
  
  try {
    const [faq, materials, responses, prompt] = await Promise.all([
      loadConfigFile<{ FAQ: Config['faq'] }>('faq').then(r => r.FAQ),
      loadConfigFile<{ materials: Config['materials'] }>('materials'),
      loadConfigFile<Config['responses']>('responses'),
      loadConfigFile<Config['prompt']>('prompt'),
    ]);

    config = {
      faq,
      materials: materials.materials,
      responses,
      prompt,
    };

    isConfigLoaded = true;
    console.log('✅ Конфигурация успешно загружена');
  } catch (error) {
    console.error('🚨 Ошибка загрузки конфигурации:', error);
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