import OpenAI from "openai";
import { Bot } from "grammy";
import dotenv from "dotenv";
import { is3DPrintingRelated } from "./modules/wordtest";

dotenv.config();
const memory: Record<string, string> = {};
const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const modelName = "openai/gpt-4.1";

// Инициализация OpenAI клиента
const client = new OpenAI({ baseURL: endpoint, apiKey: token });
// Инициализация бота
const botToken = process.env["BOT_TOKEN"];
if (typeof botToken !== "string") {
  throw new Error("BOT_TOKEN must be a string");
}
const bot = new Bot(botToken);

// Контекстный промпт для 3D-печати
const SYSTEM_PROMPT = `Вы эксперт по материалам для 3D-печати. Ваша задача - помогать с выбором пластика, учитывая:
1. Тип принтера (FDM, SLA, SLS)
2. Требования к детали (прочность, гибкость, термостойкость)
3. Условия эксплуатации (интерьер, экстерьер, механические нагрузки)
4. Бюджет пользователя
Рекомендуйте материалы (PLA, ABS, PETG, TPU, нейлон, поликарбонат) с обоснованием.
Ответ должен быть сжатым, но информативным, в стиле сообщения в Telegram от администратора (НЕ ИСПОЛЬЗУЙТЕ СПЕЦИАЛЬНЫЕ СИМВОЛЫ в ответе, например # ** * и т.д. Важно дополнить emoji). Если вопрос не связан с 3D-печатью, вежливо укажите на это.
`;
// Обработчик на приветствие
bot.command("start", (ctx) =>
  ctx.reply(
    "Привет!\n Я бот, который поможет тебе выбрать материалы для 3D-печати. \n Напиши мне свой вопрос. \n\n\n\n https://github.com/MatteyGG/TelegramPlastic"
  )
);

// Обработчик сообщений
bot.on("message", async (ctx) => {
  try {
    const userMessage = ctx.message.text ?? "";
    const chatId = ctx.chat.id;

    // Проверка на релевантность темы только для первого запроса
    if (!memory[chatId] && !is3DPrintingRelated(userMessage)) {
      await ctx.reply("Если у вас есть вопросы по 3D-печати, я готов помочь.");
      return;
    }
    // Отправка моментального ответа
    const instantReply = await ctx.reply(
      "Пожалуйста, подождите, я обрабатываю ваш запрос..."
    );
    // Формирование запроса к AI
    const request = memory[chatId] ?? "";
    memory[chatId] = request + "\n\n" + userMessage;

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: memory[chatId] },
      ],
      temperature: 0.4,
      top_p: 1.0,
      max_tokens: 1000,
      model: modelName,
    });

    let answer = response.choices[0].message.content ?? "";
    answer = answer.replace(/[*]/g, "");
    console.log("Ответ от AI получен:", answer);

    // Обновление моментального ответа
    await ctx.api.editMessageText(ctx.chat.id, instantReply.message_id, answer);
    console.log("Моментальный ответ обновлен.");
  } catch (error) {
    console.error("Ошибка:", error);
    await ctx.reply(
      "Произошла ошибка при обработке запроса. Попробуйте снова."
    );
  }
});


// Запуск бота
bot.start();
console.log("Бот запущен и готов к работе!");
