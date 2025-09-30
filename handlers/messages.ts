// src/handlers/messages.ts

import OpenAI from "openai";
import dotenv from "dotenv";
import { bot } from "../lib/context";
import { getProducts, getSystemPrompt } from "../modules/getConfig";
import { mainLogger } from "../modules/logger";
import { ChatContext, chatCache } from "../modules/cache";
import { searchProductsByAIMaterials } from "../modules/plasticInfoSearch";
import {
  completeProductClarification,
  handleProductClarification,
  selectProductsFromCandidate,
} from "../modules/productClarification";
import { Product } from "../types";
import { TokenTracker } from "../lib/tokenTracker";

dotenv.config();

// Конфигурация
const token = process.env["YANDEX_TOKEN"];
const endpoint = process.env["YANDEX_ENDPOINT"];
const ANALYTICAL_MODEL = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";
const FINAL_ANSWER_MODEL = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";
const MAX_HISTORY_LENGTH = 6;

const client = new OpenAI({ apiKey: token, baseURL: endpoint });
const tokenTracker = TokenTracker.getInstance();

// Вспомогательные функции
function parseMaterialsFromAIResponse(aiResponse: string): string[] {
  try {
    const match = aiResponse.match(/\[([^\]]+)\]/);
    if (match) {
      const materialsString = match[1];
      return materialsString
        .split(",")
        .map((material) => material.trim().toUpperCase())
        .filter((material) => material.length > 0);
    }

    return aiResponse
      .split(",")
      .map((material) => material.trim().toUpperCase())
      .filter((material) => material.length > 0)
      .slice(0, 3);
  } catch (error) {
    console.error("Error parsing materials from AI response:", error);
    return [];
  }
}

function createProductDescription(products: Product[]): string {
  if (products.length === 0) return "";

  return "\n=== КОНКРЕТНЫЕ ПРОДУКТЫ ДЛЯ РЕКОМЕНДАЦИИ ===\n" +
    products
      .map((product, index) => {
        return `ПРОДУКТ ${index + 1}:
🎯 Название: ${product.title}
🧪 Материал: ${product.material}
📝 Описание: ${product.description}`;
      })
      .join("\n\n");
}

function createStrictProductInstructions(): string {
  return `
КРИТИЧЕСКИ ВАЖНЫЕ ИНСТРУКЦИИ:
1. ВАША ГЛАВНАЯ ЗАДАЧА - РЕКОМЕНДОВАТЬ КОНКРЕТНЫЕ ПРОДУКТЫ ИЗ СПИСКА ВЫШЕ
2. ОБЯЗАТЕЛЬНО упоминайте в ответе КАЖДЫЙ из найденных продуктов
3. Используйте конкретные характеристики продуктов из описания
4. Ссылайтесь на преимущества КОНКРЕТНЫХ продуктов из описания
5. НЕ добавляйте ссылки на продукты в своем ответе - они будут добавлены отдельно

СТРУКТУРА ОТВЕТА:
- Краткий анализ задачи пользователя
- Подробный обзор КАЖДОГО подходящего продукта
- Сравнение преимуществ конкретных продуктов
- Четкая рекомендация с обоснованием

НЕ ДОПУСКАЕТСЯ:
- Давать общие рекомендации без упоминания конкретных продуктов
- Игнорировать информацию о продуктах из списка
- Добавлять ссылки на продукты в текст ответа`;
}

// Основные AI функции
async function getAIRecommendation(userMessage: string, systemPrompt: string): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Пользователь хочет: "${userMessage}". 
Проанализируй задачу и верни ТОЛЬКО список подходящих типов пластиков в формате: [MATERIAL1, MATERIAL2, MATERIAL3]
Требования:
- Только названия материалов через запятую в квадратных скобках
- Не больше 3 материалов
- Без объяснений, без текста, только чистый список
- Используй стандартные названия: ABS, PLA, PETG, TPU, ASA, NYLON и т.д.`,
    },
  ];

  const response = await client.chat.completions.create({
    messages: messages,
    temperature: 0.1,
    model: ANALYTICAL_MODEL,
    max_tokens: 50,
  });

  // Логирование токенов
  if (response.usage) {
    const cost = tokenTracker.calculateCost(
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
      ANALYTICAL_MODEL
    );
    tokenTracker.trackUsage({
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      cost,
      timestamp: new Date(),
      model: ANALYTICAL_MODEL,
      chatId: "analytical_request",
    });
  }

  return response.choices[0].message.content || "";
}

async function getFinalAIResponse(
  userMessage: string,
  recommendedMaterials: string,
  foundProducts: Product[],
  systemPrompt: string,
  history: any[]
): Promise<string> {
  const productDescription = createProductDescription(foundProducts);
  const strictInstructions = createStrictProductInstructions();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { 
      role: "system", 
      content: `${systemPrompt}\n\n${productDescription}\n\n${strictInstructions}` 
    },
    ...history.slice(-MAX_HISTORY_LENGTH),
    { 
      role: "user", 
      content: `Рекомендованные материалы: ${recommendedMaterials}. Задача: ${userMessage}` 
    },
  ];

  const response = await client.chat.completions.create({
    messages: messages,
    temperature: 0.4,
    model: FINAL_ANSWER_MODEL,
  });

  // Логирование токенов
  if (response.usage) {
    const cost = tokenTracker.calculateCost(
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
      FINAL_ANSWER_MODEL
    );
    tokenTracker.trackUsage({
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      cost,
      timestamp: new Date(),
      model: FINAL_ANSWER_MODEL,
      chatId: "final_request",
    });
  }

  return response.choices[0].message.content?.replace(/[*#]/g, "") || "";
}

function createProductLinksMessage(products: Product[]): string {
  if (products.length === 0) return "";

  let message = "\n\n🔗 **Ссылки на продукты:**";
  
  products.forEach((product) => {
    if (product.links.length > 0) {
      message += `\n• ${product.title}: ${product.links[0]}`;
    }
  });
  
  return message;
}

// Основная логика обработки сообщений
async function processMessageWithTwoStepAI(ctx: any, userMessage: string) {
  const chatId = ctx.chat.id.toString();
  const SYSTEM_PROMPT = getSystemPrompt();

  chatCache.updateHistory(chatId, { role: "user", content: userMessage });
  const context = chatCache.getOrCreate(chatId);

  const instantReply = await ctx.reply("🔍 Анализирую задачу...");

  try {
    // Шаг 1: Получаем рекомендацию по материалам
    const aiRecommendation = await getAIRecommendation(userMessage, SYSTEM_PROMPT);
    mainLogger.info("Raw AI Recommendation: " + aiRecommendation);

    const recommendedMaterials = parseMaterialsFromAIResponse(aiRecommendation);
    mainLogger.info("Parsed Materials: " + recommendedMaterials.join(", "));

    const materialsString = recommendedMaterials.join(", ");
    const products = getProducts();
    const foundProducts = searchProductsByAIMaterials(materialsString, products);
    mainLogger.info("Products found: " + foundProducts.length);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Уточнение продукта при необходимости
    if (foundProducts.length > 1) {
      const clarificationSent = await handleProductClarification(ctx, userMessage, foundProducts);
      mainLogger.info("Clarification sent: " + clarificationSent);

      if (clarificationSent) {
        context.candidateProducts = foundProducts;
        context.pendingMessage = userMessage;
        context.aiRecommendation = materialsString;
        chatCache.update(chatId, context);
        mainLogger.info("Context updated, waiting for user selection");
        return;
      }
    }

    // Шаг 3: Получаем финальный ответ
    const finalAnswer = await getFinalAIResponse(
      userMessage,
      materialsString,
      foundProducts,
      SYSTEM_PROMPT,
      context.history
    );

    mainLogger.info("Final Answer: " + finalAnswer);

    // Создаем сообщение со ссылками
    const productLinksMessage = createProductLinksMessage(foundProducts);
    const fullMessage = finalAnswer + productLinksMessage;

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Обновляем историю и отправляем ответ
    chatCache.updateHistory(chatId, { role: "assistant", content: fullMessage });
    tokenTracker.updateChatId("analytical_request", chatId);
    tokenTracker.updateChatId("final_request", chatId);

    await ctx.api.editMessageText(ctx.chat.id, instantReply.message_id, fullMessage);
    await new Promise((resolve) => setTimeout(resolve, 100));

  } catch (error) {
    mainLogger.error("Error in two-step AI process:", { error: (error as Error).message } as any);
    await ctx.api.editMessageText(
      ctx.chat.id, 
      instantReply.message_id, 
      "Извините, произошла ошибка при обработке запроса."
    );
  }
}

// Обработчики сообщений
export function register_message() {
  mainLogger.info("Registering message handler with two-step AI...");

  bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id.toString();
    const context = chatCache.getOrCreate(chatId);

    if (ctx.from?.username && !context.username) {
      context.username = ctx.from.username;
      chatCache.update(chatId, context);
    }

    await processMessageWithTwoStepAI(ctx, userMessage);
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("product:")) return;

    const productIndex = data.split(":")[1];
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    try {
      const chatContext = chatCache.getOrCreate(chatId);
      const { pendingMessage = "", candidateProducts = [], aiRecommendation = "" } = chatContext;

      await ctx.deleteMessage();
      completeProductClarification(chatId);

      const selectedProducts = selectProductsFromCandidate(candidateProducts, productIndex);

      if (productIndex === "cancel") {
        await ctx.answerCallbackQuery({ text: "Уточнение отменено" });
      } else if (selectedProducts.length > 0) {
        const productNames = selectedProducts.map((p) => p.title).join(", ");
        await ctx.answerCallbackQuery({ text: `Выбрано: ${productNames}` });

        const SYSTEM_PROMPT = getSystemPrompt();
        const finalAnswer = await getFinalAIResponse(
          pendingMessage,
          aiRecommendation,
          selectedProducts,
          SYSTEM_PROMPT,
          chatContext.history
        );

        // Добавляем ссылки к финальному ответу
        const productLinksMessage = createProductLinksMessage(selectedProducts);
        const fullMessage = finalAnswer + productLinksMessage;

        chatCache.updateHistory(chatId, { role: "assistant", content: fullMessage });
        await ctx.reply(fullMessage);
      }
    } catch (error) {
      console.error("Callback error:", error);
      await ctx.answerCallbackQuery({ text: "Ошибка обработки выбора" });
    }
  });
}