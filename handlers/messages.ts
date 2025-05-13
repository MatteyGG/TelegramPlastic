import OpenAI from "openai";
import dotenv from "dotenv";
import { is3DPrintingRelated } from "../modules/wordtest";

import { findFAQAnswer } from "../modules/faq";
import { getCacheResponse, setCacheResponse } from "../modules/cache";
import { searchFAQ } from "../modules/search";
import { logRequest } from "../modules/metrics";
import { bot } from "../lib/context";
import { getSystemPrompt } from "../modules/getConfig";
import { findMaterialsInText, formatMaterialLinks } from "../modules/materialSearch";

dotenv.config();
const memory: Record<string, ChatContext> = {}; // Обновленная структура памяти
const token = process.env["YANDEX_TOKEN"]; //GITHUB_TOKEN || YANDEX_TOKEN;
// const endpoint = "https://models.github.ai/inference";
const endpoint = "https://llm.api.cloud.yandex.net/v1";
// const modelName = "openai/gpt-4.1";
const modelName = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";
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




const client = new OpenAI({ apiKey: token, baseURL: endpoint });



export function register_message() {

  console.log("Registering message handler...");
  bot.on("message:text", async (ctx) => {
    if (ctx.message?.text?.startsWith("/")) {
      console.log("Command received:", ctx.message.text);
      return; // Пропускаем команды
    }

    try {
      const SYSTEM_PROMPT = getSystemPrompt();
      const userMessage = ctx.message.text?.trim() || "";
      const chatId = ctx.chat.id.toString();

      // Логирование запроса
      logRequest(userMessage, "ai");

      // 1. Проверка кэша
      const cachedAnswer = getCacheResponse('general', userMessage);
      if (cachedAnswer) {
        await ctx.reply(cachedAnswer);
        return;
      }

      // 2. Поиск в FAQ
      const faqAnswer = findFAQAnswer(userMessage) ?? await searchFAQ(userMessage);
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
          await ctx.react("👎");
          return;
        }
        memory[chatId].isRelevant = true; // Диалог помечен как релевантный
        await ctx.react("👍");
      }



      const instantReply = await ctx.reply("🔍 Анализирую...");

      /// Добавляем сообщение в историю
      memory[chatId].history.push({ role: "user", content: userMessage });

      // Формируем запрос
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
        messages: messages as any, // Временное решение
        temperature: 0.4,
        model: modelName,
      });

      let answer =
        response.choices[0].message.content?.replace(/[*#]/g, "") || "";

      // Кэширование ответа
      if (!answer.includes("не связан")) {
        setCacheResponse('general', userMessage, answer);
      }

      // Добавляем ответ в историю и обрезаем
      memory[chatId].history.push({ role: "assistant", content: answer });
      if (memory[chatId].history.length > MAX_HISTORY_LENGTH * 2) {
        memory[chatId].history = memory[chatId].history.slice(
          -MAX_HISTORY_LENGTH * 2
        );
      }

      // Добавляем ссылки на материалы
      console.log('Processing message:', userMessage);
      const materialMatches = findMaterialsInText(answer);
      if (materialMatches.length > 0) {
        answer += formatMaterialLinks(materialMatches);
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
