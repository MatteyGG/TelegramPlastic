import { Bot } from "grammy";

import dotenv from "dotenv";

dotenv.config();

export const bot = new Bot(process.env["BOT_TOKEN"]!);
export const memory: Record<string, ChatContext> = {};

type Material = {
  links: string[];
};


// Типы
export const MATERIALS: Record<string, Material> = {
  ABS: {
    links: [
      "https://rec3d.ru/plastik-dlya-3d-printerov/all-plastic/?material[]=6",
    ],
  },
  PETG: {
    links: [
      "https://rec3d.ru/plastik-dlya-3d-printerov/all-plastic/?material[]=42",
    ],
  },
  PLA: {
    links: [
      "https://rec3d.ru/plastik-dlya-3d-printerov/all-plastic/?material[]=38",
    ],
  },
  TPU: {
    links: [
      "https://rec3d.ru/plastik-dlya-3d-printerov/all-plastic/?material[]=43",
    ],
  },
};

export interface ChatContext {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  isRelevant: boolean;
}

// Экспорт констант
export const APP_CONSTANTS = {
  MAX_HISTORY_LENGTH: 6,
  SYSTEM_PROMPT: `Вы эксперт по 3D-печати...`, // ваш оригинальный промпт
  MATERIALS,
};
