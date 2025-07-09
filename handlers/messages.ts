import OpenAI from "openai";
import dotenv from "dotenv";
import { bot } from "../lib/context";
import { is3DPrintingRelated } from "../modules/wordtest";
import { findFAQAnswer } from "../modules/faq";
import { getCacheResponse, setCacheResponse } from "../modules/cache";
import { searchFAQ } from "../modules/search";
import { getProducts, getSystemPrompt } from "../modules/getConfig";
import { findMaterialsInText, formatMaterialLinks } from "../modules/materialLinkSearch";
import { mainLogger, requestLogger } from "../modules/logger";
import { ChatContext, chatCache } from "../modules/cache"; // Импорт из Cache.ts
import { searchProducts } from "../modules/plasticInfoSearch";

dotenv.config();

const token = process.env["YANDEX_TOKEN"]; //GITHUB_TOKEN || YANDEX_TOKEN;
// const endpoint = "https://models.github.ai/inference";
const endpoint = "https://llm.api.cloud.yandex.net/v1";
// const modelName = "openai/gpt-4.1";
const modelName = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";

const MAX_HISTORY_LENGTH = 6;
const client = new OpenAI({ apiKey: token, baseURL: endpoint });



export function register_message() {
  mainLogger.info("Registering message handler...");
  bot.on("message:text", async (ctx) => {
    if (ctx.message?.text?.startsWith("/")) {
      mainLogger.info("Command received:", ctx.message.text);
      return;
    }

    const user = ctx.from?.username || "unknown_user";
    const text = ctx.message.text || "[non-text message]";
    requestLogger.info(`User ${user}: ${text}`);

    try {
      const userMessage = ctx.message.text?.trim() || "";
      const chatId = ctx.chat.id.toString();
      const SYSTEM_PROMPT = getSystemPrompt();

      console.log("Received message:", userMessage);
      console.log(SYSTEM_PROMPT)

      // 1. Check cache
      console.log("Checking cache...");
      const cachedAnswer = getCacheResponse('general', userMessage);
      if (cachedAnswer) {
        console.log("Cache hit!");
        await ctx.reply(cachedAnswer);
        return;
      }

      // 2. Search in FAQ findFAQAnswer(userMessage) ?? 
      console.log("Searching in FAQ...");
      const faqAnswer = findFAQAnswer(userMessage);
      if (faqAnswer) {
        console.log("FAQ answer:", faqAnswer);
        await ctx.reply(faqAnswer);
        return;
      }

      console.log("No FAQ answer, proceeding with context handling...");

      // 3. Context handling through Cache.ts
      let context = chatCache.getOrCreate(chatId);

      // Check relevance
      if (!context.isRelevant) {
        console.log("Checking relevance...");
        const isRelevant = is3DPrintingRelated(userMessage);
        if (!isRelevant) {
          console.log("Not relevant, sending instant reply...");
          await ctx.reply("Задайте вопрос по 3D-печати, и я помогу! ");
          return;
        }
        context.isRelevant = true;
        chatCache.update(chatId, context); // Save changes
      }

      const instantReply = await ctx.reply("🔍 Анализирую...");

      // Update history
      context = chatCache.updateHistory(chatId, {
        role: "user",
        content: userMessage
      });

      console.log("Updating history...");

      // Search for product
      const products = getProducts();
      let UserfoundProducts = searchProducts(userMessage, products);
      let ProductDescription = UserfoundProducts.map(product => {
        return `${product.title} - ${product.material} - Диаметры нити: ${product.diameters.join(", ")} - ${product.colors.join(", ")} - ${product.links.join(", ")} - ${product.description}`;
      }).join(", ");

      console.log("Searching for product...\nFound products:", ProductDescription);

      // Prepare request
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: SYSTEM_PROMPT + " Описание продукта для тебя(Если продукт найден): " + ProductDescription,
        },
        ...context.history.slice(-MAX_HISTORY_LENGTH).map(msg => ({
          role: msg.role as "user" | "assistant", // Explicitly specify the allowed roles
          content: msg.content
        }))
      ];

      console.log("Request:", messages);

      console.log("Preparing request...");

      // OpenAI request
      const response = await client.chat.completions.create({
        messages: messages,
        temperature: 0.4,
        model: modelName,
      });

      let answer = response.choices[0].message.content?.replace(/[*#]/g, "") || "";

      console.log("OpenAI response:", answer);

      // Cache response
      if (!answer.includes("не связан")) {
        console.log("Caching response...");
        setCacheResponse('general', userMessage, answer);
      }

      // Update history with answer
      chatCache.updateHistory(chatId, {
        role: "assistant",
        content: answer
      });

      console.log("Updating history with answer...");

      // Add materials
      // if (!answer.includes("ссылки ссылка")) {
        const AifoundProducts = searchProducts(answer, products);
        console.log(" Found products: ", AifoundProducts.length);
        if (AifoundProducts.length > 0) {
          answer += AifoundProducts.map(product => {
            return `\n\n${product.title}:\n${product.links.join(" \n")}`;
          }).join("");
        } else if (UserfoundProducts.length > 0) {
          answer += UserfoundProducts.map(product => {
            return `\n\n${product.title}:\n${product.links.join(" \n")}`;
          }).join("");
        }
      // }

      await ctx.api.editMessageText(ctx.chat.id, instantReply.message_id, answer);
    } catch (error) {
      console.error("Error:", error);
      await ctx.reply(" Ошибка. Попробуйте задать вопрос иначе.");
    }
  });
}
