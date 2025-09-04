import OpenAI from "openai";
import dotenv from "dotenv";
import { bot } from "../lib/context";
import { getProducts, getSystemPrompt } from "../modules/getConfig";
import { mainLogger } from "../modules/logger";
import { ChatContext, chatCache } from "../modules/cache";
import { searchProducts } from "../modules/plasticInfoSearch";
import { completeProductClarification, handleProductClarification, selectProductsFromCandidate } from "../modules/productClarification";
import { Product } from "../types";

dotenv.config();

const token = process.env["YANDEX_TOKEN"];
const endpoint = process.env["YANDEX_ENDPOINT"];
const modelName = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";

const MAX_HISTORY_LENGTH = 6;
const client = new OpenAI({ apiKey: token, baseURL: endpoint });

async function processMessageWithProducts(
  ctx: any,
  userMessage: string,
  selectedProducts: Product[]
) {
  const chatId = ctx.chat.id.toString();
  const SYSTEM_PROMPT = getSystemPrompt();

  // Обновляем историю сообщений
  chatCache.updateHistory(chatId, {
    role: "user",
    content: userMessage
  });

  const context = chatCache.getOrCreate(chatId);
  const instantReply = await ctx.reply("🔍 Анализирую...");

  // Формируем описание продуктов
  let productDescription = "";
  if (selectedProducts.length > 0) {
    productDescription = "\n[Информация о выбранных продуктах]:\n" + 
      selectedProducts.map(product => {
        return `${product.title}: ${product.description.substring(0, 200)}... (Из чего состоит: ${product.material}, Доступные диаметры: ${product.diameters}, Цвета: ${product.colors})`;
      }).join("\n");
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

  // Обновляем историю ответом ассистента
  chatCache.updateHistory(chatId, {
    role: "assistant",
    content: answer
  });

  // Добавляем ссылки на выбранные продукты
  if (selectedProducts.length > 0) {
    answer += "\n\n🔗 Ссылки на выбранные продукты:";
    selectedProducts.forEach(product => {
      if (product.links.length > 0) {
        answer += `\n- ${product.title}: ${product.links[0]}`;
      }
    });
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
  
  // Сохраняем username пользователя в кэш
  if (ctx.from?.username && !context.username) {
    context.username = ctx.from.username;
    chatCache.update(chatId, context);
  }
    //  Ищем продукты в текущем сообщении
    const products = getProducts();
    let foundProducts = searchProducts(userMessage, products);
    // const materialProducts = searchProductsByMaterial(userMessage, products);
    // const generalProducts = searchProducts(userMessage, products);
    // // Объединяем результаты, убирая дубликаты
    // let foundProducts = [...new Set([...materialProducts, ...generalProducts])];
    console.log("Found products:", foundProducts);

    // Уточнение продукта при необходимости
    if (foundProducts.length > 1) {
      const clarificationSent = await handleProductClarification(
        ctx, 
        userMessage, 
        foundProducts
      );
      
      if (clarificationSent) {
        context.candidateProducts = foundProducts;
        chatCache.update(chatId, context);
        return;
      }
    }

    // Если продуктов 0 или 1, сразу обрабатываем
    const selectedProducts = foundProducts.length > 0 ? foundProducts : [];
    await processMessageWithProducts(ctx, userMessage, selectedProducts);
  });

  bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("product:")) return;

  const productIndex = data.split(":")[1]; // Получаем индекс или спец. значение
  console.log("Product index:", productIndex);
  
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  try {
    const chatContext = chatCache.getOrCreate(chatId);
    const pendingMessage = chatContext.pendingMessage || "";
    const candidateProducts = chatContext.candidateProducts || [];

    await ctx.deleteMessage();
    completeProductClarification(chatId);
    
    // Всегда получаем массив продуктов
    const selectedProducts = selectProductsFromCandidate(candidateProducts, productIndex);
    
    let productNames = "";
    if (selectedProducts.length > 0) {
      productNames = selectedProducts.map(p => p.title).join(", ");
    }
    
    // Уведомление пользователя
    if (productIndex === "cancel") {
      await ctx.answerCallbackQuery({ text: "Уточнение отменено" });
    } else if (selectedProducts.length > 0) {
      await ctx.answerCallbackQuery({ 
        text: `Выбрано: ${productNames}` 
      });
    } else {
      await ctx.answerCallbackQuery({ text: "Продукт не найден" });
    }
    
    // Обрабатываем сообщение с выбранными продуктами
    await processMessageWithProducts(ctx, pendingMessage, selectedProducts);
  } catch (error) {
    console.error("Callback error:", error);
    await ctx.answerCallbackQuery({ text: "Ошибка обработки выбора" });
  }
});
}

