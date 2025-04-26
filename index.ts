import OpenAI from "openai";
import { Bot } from "grammy";
import dotenv from "dotenv";
import { is3DPrintingRelated } from "./modules/wordtest";

import { findFAQAnswer } from "./modules/faq";
import { getCacheResponse, setCacheResponse } from "./modules/cache";
import { initSearch, searchFAQ } from "./modules/search";
import { logRequest } from "./modules/metrics";

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
const bot = new Bot(process.env["BOT_TOKEN"]!);

const SYSTEM_PROMPT = `Вы эксперт по 3D-печати. Отвечайте, учитывая всю историю диалога. 
Если вопрос уточняет предыдущий (например, "А он хорош?"), свяжите ответ с обсужденным материалом. Ваша задача - помогать с выбором пластика, учитывая:
1. Тип принтера (FDM, SLA, SLS)
2. Требования к детали (прочность, гибкость, термостойкость)
3. Условия эксплуатации (интерьер, экстерьер, механические нагрузки)
4. Бюджет пользователя
Рекомендуйте материалы (PLA, ABS, PETG, TPU, нейлон, поликарбонат) с обоснованием.
Ответ должен быть сжатым, но информативным, в стиле сообщения в Telegram от администратора (НЕ ИСПОЛЬЗУЙТЕ СПЕЦИАЛЬНЫЕ СИМВОЛЫ в ответе, например # ** * и т.д. Важно дополнить emoji). Если вопрос не связан с 3D-печатью, вежливо укажите на это.
`;

bot.command("start", (ctx) =>
  ctx.reply(
    "Привет! Я помогу выбрать материалы для 3D-печати. Задавайте вопросы! 🛠️\n\nhttps://github.com/MatteyGG/TelegramPlastic"
  )
);

bot.on("message", async (ctx) => {
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

    await ctx.api.editMessageText(ctx.chat.id, instantReply.message_id, answer);
  } catch (error) {
    await ctx.reply("❌ Ошибка. Попробуйте задать вопрос иначе.");
    console.error("Error:", error);
  }
});

bot.start();
console.log("Бот запущен!");
