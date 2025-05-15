import OpenAI from "openai";
import dotenv from "dotenv";
import { bot } from "../lib/context";
import { is3DPrintingRelated } from "../modules/wordtest";
import { findFAQAnswer } from "../modules/faq";
import { getCacheResponse, setCacheResponse } from "../modules/cache";
import { searchFAQ } from "../modules/search";
import { getSystemPrompt } from "../modules/getConfig";
import { findMaterialsInText, formatMaterialLinks } from "../modules/materialSearch";
import { mainLogger, requestLogger } from "../modules/logger";
import { ChatContext, chatCache } from "../modules/cache"; // Импорт из Cache.ts

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

      // 1. Check cache
      const cachedAnswer = getCacheResponse('general', userMessage);
      if (cachedAnswer) {
        await ctx.reply(cachedAnswer);
        return;
      }

      // 2. Search in FAQ findFAQAnswer(userMessage) ?? 
      const faqAnswer =  findFAQAnswer(userMessage);
      if (faqAnswer) {
        await ctx.reply(faqAnswer);
        return;
      }

      // 3. Context handling through Cache.ts
      let context = chatCache.getOrCreate(chatId);

      // Check relevance
      if (!context.isRelevant) {
        const isRelevant = is3DPrintingRelated(userMessage);
        if (!isRelevant) {
          await ctx.reply("Задайте вопрос по 3D-печати, и я помогу! 🖨️");
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

      // Prepare request
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...context.history.slice(-MAX_HISTORY_LENGTH).map(msg => ({
          role: msg.role as "user" | "assistant", // Explicitly specify the allowed roles
          content: msg.content
        }))
      ];

      // OpenAI request
      const response = await client.chat.completions.create({
        messages: messages,
        temperature: 0.4,
        model: modelName,
      });

      let answer = response.choices[0].message.content?.replace(/[*#]/g, "") || "";

      // Cache response
      if (!answer.includes("не связан")) {
        setCacheResponse('general', userMessage, answer);
      }

      // Update history with answer
      chatCache.updateHistory(chatId, {
        role: "assistant",
        content: answer
      });

      // Add materials
      const materialMatches = findMaterialsInText(answer);
      if (materialMatches.length > 0) {
        answer += formatMaterialLinks(materialMatches);
      }

      await ctx.api.editMessageText(ctx.chat.id, instantReply.message_id, answer);
    } catch (error) {
      await ctx.reply("❌ Ошибка. Попробуйте задать вопрос иначе.");
      console.error("Error:", error);
    }
  });
}
