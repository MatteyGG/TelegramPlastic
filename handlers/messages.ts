import OpenAI from "openai";
import dotenv from "dotenv";
import { bot } from "../lib/context";
import { is3DPrintingRelated } from "../modules/wordtest";
import { findFAQAnswer } from "../modules/faq";
import { getCacheResponse, setCacheResponse } from "../modules/cache";
import { getProducts, getSystemPrompt } from "../modules/getConfig";
import { findMaterialsInText, formatMaterialLinks } from "../modules/materialLinkSearch";
import { mainLogger, requestLogger } from "../modules/logger";
import { ChatContext, chatCache } from "../modules/cache";
import { searchProducts } from "../modules/plasticInfoSearch";
import { completeProductClarification, handleProductClarification, selectProductsFromCandidate } from "../modules/productClarification"; // Добавленный модуль
import { Product } from "../types"; // Добавить тип Product если нужно

dotenv.config();

const token = process.env["YANDEX_TOKEN"];
const endpoint = process.env["YANDEX_ENDPOINT"];
const modelName = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";

const MAX_HISTORY_LENGTH = 6;
const client = new OpenAI({ apiKey: token, baseURL: endpoint });

// функция для обработки сообщений с продуктами
async function processMessageWithProducts(
  ctx: any,
  userMessage: string,
  selectedProducts: Product[]
) {
  const chatId = ctx.chat.id.toString();
  const SYSTEM_PROMPT = getSystemPrompt();

  // Обновляем историю сообщений
  let context = chatCache.updateHistory(chatId, {
    role: "user",
    content: userMessage
  });

  const instantReply = await ctx.reply("🔍 Анализирую...");

  // Формируем описание продуктов ТОЛЬКО если они есть
  let productDescription = "";
  if (selectedProducts.length > 0) {
    productDescription = " Описание выбранных продуктов: " + 
      selectedProducts.map(product => {
        return `${product.title} - ${product.material} - Диаметры: ${product.diameters.join(", ")}`;
      }).join(", ");
  }

  // Подготовка запроса к AI
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT + productDescription,
    },
    ...context.history.slice(-MAX_HISTORY_LENGTH).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    }))
  ];

  console.log("Request:", messages);

  // OpenAI запрос
  const response = await client.chat.completions.create({
    messages: messages,
    temperature: 0.4,
    model: modelName,
  });

  let answer = response.choices[0].message.content?.replace(/[*#]/g, "") || "";

  console.log("OpenAI response:", answer);

  // Кэширование ответа
  if (!answer.includes("не связан")) {
    setCacheResponse('general', userMessage, answer);
  }

  // Обновляем историю ответом ассистента
  chatCache.updateHistory(chatId, {
    role: "assistant",
    content: answer
  });

  // Добавляем информацию о материалах
  const products = getProducts();
  const AifoundProducts = searchProducts(answer, products);
  if (AifoundProducts.length > 0) {
    answer += AifoundProducts.map(product => {
      return `\n\n${product.title}:\n${product.links.join(" \n")}`;
    }).join("");
  } else if (selectedProducts.length > 0) {
    answer += selectedProducts.map(product => {
      return `\n\n${product.title}:\n${product.links.join(" \n")}`;
    }).join("");
  }

  await ctx.api.editMessageText(ctx.chat.id, instantReply.message_id, answer);
}
export function register_message() {
  mainLogger.info("Registering message handler...");
  
  // Обработчик текстовых сообщений
  bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id.toString();
    const context = chatCache.getOrCreate(chatId);

    // 4. Поиск продуктов
    const products = getProducts();
    let foundProducts = searchProducts(userMessage, products);

    // 5. Уточнение продукта (новый блок)
    if (foundProducts.length > 1) {
      const clarificationSent = await handleProductClarification(
        ctx, 
        userMessage, 
        foundProducts
      );
      
      // Сохраняем исходные продукты на случай отмены уточнения
      if (clarificationSent) {
        context.candidateProducts = foundProducts;
        chatCache.update(chatId, context);
        return;
      }
    }

    // Если продуктов 0 или 1, продолжаем обработку
    const selectedProducts = foundProducts.length > 0 ? 
      foundProducts : 
      [];

    await processMessageWithProducts(ctx, userMessage, selectedProducts);
  });

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("product:")) return;

  const productId = data.split(":")[1];
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  try {
    const chatContext = chatCache.getOrCreate(chatId);
    const pendingMessage = chatContext.pendingMessage || "";
    const candidateProducts = chatContext.candidateProducts || [];

    // Удаляем сообщение с кнопками ТОЛЬКО после обработки выбора
    await ctx.deleteMessage();
    
    // Всегда завершаем уточнение после выбора
    completeProductClarification(chatId);
    
    if (productId === "cancel") {
      await ctx.answerCallbackQuery({ text: "Уточнение отменено" });
      // Обрабатываем с исходными продуктами
      await processMessageWithProducts(ctx, pendingMessage, candidateProducts);
    } else {
      const selectedProducts = selectProductsFromCandidate(
        candidateProducts,
        productId
      );
      
      if (selectedProducts) {
        const productNames = selectedProducts.map(p => p.title).join(", ");
        await ctx.answerCallbackQuery({ 
          text: `Выбран: ${productNames}` 
        });
        
        await processMessageWithProducts(
          ctx, 
          pendingMessage, 
          selectedProducts
        );
      } else {
        await ctx.answerCallbackQuery({ text: "Продукт не найден" });
        // Обрабатываем без продуктов
        await processMessageWithProducts(ctx, pendingMessage, []);
      }
    }
  } catch (error) {
    console.error("Callback error:", error);
    await ctx.answerCallbackQuery({ text: "Ошибка обработки выбора" });
  }
});
}