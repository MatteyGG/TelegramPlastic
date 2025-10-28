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
const ANALYTICAL_MODEL = process.env["ANALYTICAL_MODEL"] || "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";
const FINAL_ANSWER_MODEL = process.env["FINAL_ANSWER_MODEL"] || "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";
const MAX_HISTORY_LENGTH = 6;

const client = new OpenAI({ apiKey: token, baseURL: endpoint });
const tokenTracker = TokenTracker.getInstance();

// Вспомогательные функции для форматирования
function parseMaterialsFromAIResponse(aiResponse: string): string[] {
  try {
    console.log("Raw AI response for parsing:", aiResponse); // ДЛЯ ОТЛАДКИ

    const match = aiResponse.match(/\[([^\]]+)\]/);
    if (match) {
      const materialsString = match[1];
      const materials = materialsString
        .split(",")
        .map((material) => material.trim().toUpperCase())
        .filter((material) => material.length > 0);

      console.log("Parsed materials:", materials); // ДЛЯ ОТЛАДКИ
      return materials;
    }

    const fallback = aiResponse
      .split(",")
      .map((material) => material.trim().toUpperCase())
      .filter((material) => material.length > 0)
      .slice(0, 3);

    console.log("Fallback materials:", fallback); // ДЛЯ ОТЛАДКИ
    return fallback;
  } catch (error) {
    console.error("Error parsing materials from AI response:", error);
    return [];
  }
}

function createProductDescription(products: Product[]): string {
  if (products.length === 0) return "";

  return (
    "\n=== КОНКРЕТНЫЕ ПРОДУКТЫ ДЛЯ РЕКОМЕНДАЦИИ ===\n" +
    products
      .map((product, index) => {
        return `ПРОДУКТ ${index + 1}:
Название: ${product.title}
Материал: ${product.material}
Описание: ${product.description}`;
      })
      .join("\n\n")
  );
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

async function getAIRecommendation(
  userMessage: string,
  systemPrompt: string
): Promise<string> {
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
Всего продуктов: 53

• ABS+CF15: 1
• PEEK+CF: 1
• TPU (A80): 1
• PSU: 1
• PEEK+GF: 1
• PP: 1
• PA6+CF30: 1
• rPETG+GF: 1
• PET-G: 2
• TPU (A95): 1
• rPETG: 1
• TPU (A70): 1
• N/A: 10
• PMMA: 1
• ABS+PC: 1
• PLA: 3
• PA12+GF12: 1
• PC: 1
• HIPS: 1
• ABS+GF13: 8
• PA12+CF: 1
• PVA: 1
• ABS: 1
• PA12: 1
• PP+Nano Tubes: 1
• PA6: 1
• ASA: 1
• PP+GF: 1
• PEI: 1
• PETG+GF10: 1
• TPU+GF: 1
• SEBS: 1
• PEEK: 1
• PVFD: 1`,
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

// Используется функция из plasticInfoSearch.ts
function findProductsByMaterials(recommendedMaterials: string[]): Product[] {
  const materialsString = recommendedMaterials.join(", ");
  const products = getProducts();
  return searchProductsByAIMaterials(materialsString, products);
}

async function getFinalAIResponse(
  userMessage: string,
  recommendedMaterials: string[],
  foundProducts: Product[],
  systemPrompt: string,
  history: any[]
): Promise<string> {
  const productDescription = createProductDescription(foundProducts);
  
  // More explicit instructions
  const enhancedInstructions = `
${systemPrompt}

ДОСТУПНЫЕ ПРОДУКТЫ ДЛЯ РЕКОМЕНДАЦИИ:
${productDescription}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. РЕКОМЕНДУЙТЕ ТОЛЬКО ТЕ ПРОДУКТЫ, КОТОРЫЕ ПЕРЕЧИСЛЕНЫ ВЫШЕ
2. Не упоминайте продукты, которых нет в списке доступных
3. Сосредоточьтесь на преимуществах КОНКРЕТНЫХ продуктов из списка
4. Объясните, почему выбранные продукты подходят для задачи пользователя
5. НЕ добавляйте ссылки - они будут добавлены автоматически

СТРУКТУРА ОТВЕТА:
- Краткий анализ требований пользователя
- Обзор 1-2 наиболее подходящих продуктов из доступных
- Конкретные рекомендации с обоснованием
`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { 
      role: "system", 
      content: enhancedInstructions
    },
    ...history.slice(-MAX_HISTORY_LENGTH),
    { 
      role: "user", 
      content: `Рекомендованные материалы: ${recommendedMaterials.join(", ")}. Задача: ${userMessage}` 
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

async function processMessageWithTwoStepAI(ctx: any, userMessage: string) {
  const chatId = ctx.chat.id.toString();
  const SYSTEM_PROMPT = getSystemPrompt();

  chatCache.updateHistory(chatId, { role: "user", content: userMessage });
  const context = chatCache.getOrCreate(chatId);

  const instantReply = await ctx.reply("🔍 Анализирую задачу...");

  try {
    // ШАГ 1: Получаем рекомендацию по материалам
    const aiRecommendation = await getAIRecommendation(
      userMessage,
      SYSTEM_PROMPT
    );
    mainLogger.info("Raw AI Recommendation: " + aiRecommendation);

    const recommendedMaterials = parseMaterialsFromAIResponse(aiRecommendation);
    mainLogger.info("Parsed Materials: " + recommendedMaterials.join(", "));

    // ШАГ 2: Ищем продукты в базе
    const foundProducts = findProductsByMaterials(recommendedMaterials);
    mainLogger.info("Products found: " + foundProducts.length);
    foundProducts.forEach((product) => {
      mainLogger.info(`Found product: ${product.title} - ${product.material}`);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Уточнение продукта при необходимости EDIT: Выключено, подразумевается, что пользователь не знает какой продукт нужен
    // if (foundProducts.length > 1) {
    //   const clarificationSent = await handleProductClarification(
    //     ctx,
    //     userMessage,
    //     foundProducts
    //   );
    //   mainLogger.info("Clarification sent: " + clarificationSent);

    //   if (clarificationSent) {
    //     context.candidateProducts = foundProducts;
    //     context.pendingMessage = userMessage;
    //     context.aiRecommendation = recommendedMaterials.join(", ");
    //     chatCache.update(chatId, context);
    //     mainLogger.info("Context updated, waiting for user selection");
    //     return;
    //   }
    // }

    // ШАГ 3: Получаем финальный ответ
    const finalAnswer = await getFinalAIResponse(
      userMessage,
      recommendedMaterials,
      foundProducts,
      SYSTEM_PROMPT,
      context.history
    );

    mainLogger.info("Final Answer: " + finalAnswer);

    // ШАГ 4: Добавляем ссылки на продукты
    const productLinksMessage = createProductLinksMessage(foundProducts);
    const fullMessage = finalAnswer + productLinksMessage;

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Обновляем историю и отправляем ответ
    chatCache.updateHistory(chatId, {
      role: "assistant",
      content: fullMessage,
    });
    tokenTracker.updateChatId("analytical_request", chatId);
    tokenTracker.updateChatId("final_request", chatId);

    await ctx.api.editMessageText(
      ctx.chat.id,
      instantReply.message_id,
      fullMessage
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    mainLogger.error("Error in two-step AI process:", {
      error: (error as Error).message,
    } as any);
    await ctx.api.editMessageText(
      ctx.chat.id,
      instantReply.message_id,
      "Извините, произошла ошибка при обработке запроса."
    );
  }
}

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
      const {
        pendingMessage = "",
        candidateProducts = [],
        aiRecommendation = "",
      } = chatContext;

      await ctx.deleteMessage();
      completeProductClarification(chatId);

      const selectedProducts = selectProductsFromCandidate(
        candidateProducts,
        productIndex
      );

      if (productIndex === "cancel") {
        await ctx.answerCallbackQuery({ text: "Уточнение отменено" });
      } else if (selectedProducts.length > 0) {
        const productNames = selectedProducts
          .map((p: { title: any }) => p.title)
          .join(", ");
        await ctx.answerCallbackQuery({ text: `Выбрано: ${productNames}` });

        const SYSTEM_PROMPT = getSystemPrompt();
        const finalAnswer = await getFinalAIResponse(
          pendingMessage,
          [aiRecommendation],
          selectedProducts,
          SYSTEM_PROMPT,
          chatContext.history
        );

        // Добавляем ссылки к финальному ответу
        const productLinksMessage = createProductLinksMessage(selectedProducts);
        const fullMessage = finalAnswer + productLinksMessage;

        chatCache.updateHistory(chatId, {
          role: "assistant",
          content: fullMessage,
        });
        try {
          await ctx.editMessageText(fullMessage);
        } catch (editError) {
          // Fallback if message can't be edited (e.g., too old)
          await ctx.reply(fullMessage);
        }
      }
    } catch (error) {
      console.error("Callback error:", error);
      await ctx.answerCallbackQuery({ text: "Ошибка обработки выбора" });
    }
  });
}
