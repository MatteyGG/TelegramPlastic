import OpenAI from "openai";
import dotenv from "dotenv";
import { is3DPrintingRelated } from "../modules/wordtest";

import { findFAQAnswer } from "../modules/faq";
import { getCacheResponse, setCacheResponse } from "../modules/cache";
import { initSearch, searchFAQ } from "../modules/search";
import { logRequest } from "../modules/metrics";
import { bot } from "../lib/context";

dotenv.config();
const memory: Record<string, ChatContext> = {}; // Обновленная структура памяти
const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const modelName = "openai/gpt-4.1";

const MAX_HISTORY_LENGTH = 6; // Сохраняем последние 3 пары вопрос-ответ

// Тип для хранения истории диалога
type ChatContext = {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  isRelevant: boolean; // Флаг релевантности диалога
};

// Словарь материалов

type Material = {
  links: string[];
};

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

initSearch();

const client = new OpenAI({ baseURL: endpoint, apiKey: token });

const SYSTEM_PROMPT = `Вы эксперт по 3D-печати. Отвечайте кратко, используя историю диалога. Ваша задача:
1. Рекомендовать материалы (PLA, ABS, PETG, TPU) на основе:
   - Типа принтера (FDM/SLA/SLS)
   - Требований к детали (прочность, гибкость, термостойкость)
   - Условий эксплуатации и бюджета
2. **Запрещено:**
   - Упоминать конкурентов или сторонние магазины
   - Создавать гиперссылки или предлагать альтернативные ресурсы
3. Все ссылки уже предоставлены — не генерируйте их. 

Формат: лаконичный ответ администратора с emoji. Если вопрос не о 3D-печати — вежливо сообщите об этом.`;

export function register_message() {

  console.log("Registering message handler...");
  bot.on("message", async (ctx) => {
    
    if (ctx.message?.text?.startsWith("/")) {
      console.log("Command received:", ctx.message.text);
      return; // Пропускаем команды
    }
    
    try {
      const userMessage = ctx.message.text?.trim() || "";
      const chatId = ctx.chat.id.toString();

      // Логирование запроса
      logRequest(userMessage, "ai");

      // 1. Проверка кэша
      const cachedAnswer = getCacheResponse(userMessage);
      if (cachedAnswer) {
        await ctx.reply(cachedAnswer);
        logRequest(userMessage, "cache");
        return;
      }

      // 2. Поиск в FAQ
      const faqAnswer = findFAQAnswer(userMessage) || searchFAQ(userMessage);
      if (faqAnswer) {
        await ctx.reply(faqAnswer);
        logRequest(userMessage, "faq");
        return;
      }

      // Инициализация контекста
      if (!memory[chatId]) {
        memory[chatId] = {
          history: [],
          isRelevant: false,
        } as ChatContext;
      }

      // Проверка релевантности ТОЛЬКО для первого сообщения
      if (!memory[chatId].isRelevant) {
        const isRelevant = is3DPrintingRelated(userMessage);
        if (!isRelevant) {
          await ctx.reply("Задайте вопрос по 3D-печати, и я помогу! 🖨️");
          return;
        }
        memory[chatId].isRelevant = true; // Диалог помечен как релевантный
      }

      const instantReply = await ctx.reply("🔍 Анализирую...");

      /// Добавляем сообщение в историю
      memory[chatId].history.push({ role: "user", content: userMessage });

      // Формируем запрос с ВСЕЙ историей
      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        } as const, // Явное указание типа для системного сообщения
        ...memory[chatId].history.slice(-MAX_HISTORY_LENGTH).map((msg) => ({
          role: msg.role as "user" | "assistant", // Ограничиваем допустимые роли
          content: msg.content,
        })),
      ];

      const response = await client.chat.completions.create({
        messages: messages as any, // Временное решение для совместимости типов
        temperature: 0.4,
        model: modelName,
      });

      let answer =
        response.choices[0].message.content?.replace(/[*#]/g, "") || "";

      // Кэширование ответа
      if (!answer.includes("не связан")) {
        setCacheResponse(userMessage, answer);
      }

      // Добавляем ответ в историю и обрезаем
      memory[chatId].history.push({ role: "assistant", content: answer });
      if (memory[chatId].history.length > MAX_HISTORY_LENGTH * 2) {
        memory[chatId].history = memory[chatId].history.slice(
          -MAX_HISTORY_LENGTH * 2
        );
      }

      // Добавляем ссылки на материалы
      const mentionedMaterial = Object.keys(MATERIALS).find((m) =>
        answer.toLowerCase().includes(m.toLowerCase())
      );

      if (mentionedMaterial) {
        answer += `\n\n🏷️ Где купить ${mentionedMaterial}:\n${MATERIALS[
          mentionedMaterial
        ].links.join("\n")}`;
      }

      await ctx.api.editMessageText(
        ctx.chat.id,
        instantReply.message_id,
        answer
      );
    } catch (error) {
      await ctx.reply("❌ Ошибка. Попробуйте задать вопрос иначе.");
      console.error("Error:", error);
    }
  });

}
