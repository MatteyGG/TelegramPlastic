import  ModelClient,{ isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { Bot } from "grammy";
import dotenv from "dotenv";
import { is3DPrintingRelated } from "./modules/wordtest";

dotenv.config();

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.inference.ai.azure.com";
const modelName = "DeepSeek-V3-0324";

// Инициализация OpenAI клиента
const client = ModelClient(endpoint, new AzureKeyCredential(token as string));

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
    console.log("Получено сообщение:", ctx.message.text);
    const userMessage = ctx.message.text ?? "";

    // Проверка на релевантность темы
    if (!is3DPrintingRelated(userMessage)) {
      console.log("Сообщение не связано с 3D печатью.");
      await ctx.reply("Ваш вопрос не связан с 3D печатью. Я не могу помочь.");
      return;
    }

    console.log("Сообщение связано с 3D печатью, отправка моментального ответа...");
    // Отправка моментального ответа
    const instantReply = await ctx.reply(
      "Пожалуйста, подождите, я обрабатываю ваш запрос..."
    );

    console.log("Формирование запроса к AI...");
    // Формирование запроса к AI
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 1.0,
        top_p: 1.0,
        max_tokens: 1000,
        model: modelName,
      },
    });

    if (isUnexpected(response)) {
      throw response.body.error;
    }

    let answer = response.body.choices[0].message.content ?? "";
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

// Фильтр тематики


// Запуск бота
bot.start();
console.log("Бот запущен и готов к работе!");



