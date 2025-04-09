import { Bot } from "grammy";
import OpenAI from "openai";
import { config } from "dotenv";

config();

const token = process.env["GITHUB_TOKEN"] ?? "";
const endpoint = "https://models.inference.ai.azure.com";
const modelName = "gpt-4o-mini";

// Инициализация OpenAI клиента
const client = new OpenAI({ baseURL: endpoint, apiKey: token });

// Контекстный промпт для 3D-печати
const SYSTEM_PROMPT = `Вы эксперт по материалам для 3D-печати. Ваша задача - помогать с выбором пластика, учитывая:
1. Тип принтера (FDM, SLA, SLS)
2. Требования к детали (прочность, гибкость, термостойкость)
3. Условия эксплуатации (интерьер, экстерьер, механические нагрузки)
4. Бюджет пользователя
Рекомендуйте материалы (PLA, ABS, PETG, TPU, нейлон, поликарбонат) с обоснованием.
НЕ ИСПОЛЬЗОВАТЬ СИМВОЛЫ ** в ответе. Ответ должен быть сжатым, но информативным, в стиле сообщения в Telegram от администратора(Важно дополнить текст переносами и emoji) . Если вопрос не связан с 3D-печатью, вежливо укажите на это.`;

// Инициализация бота
const bot = new Bot(process.env.BOT_TOKEN ?? "");

// Обработчик на приветствие
bot.command("start", (ctx) => ctx.reply("Привет! Я бот, который поможет тебе выбрать материалы для 3D-печати."));

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
    const instantReply = await ctx.reply("Пожалуйста, подождите, я обрабатываю ваш запрос...");

    console.log("Формирование запроса к AI...");
    // Формирование запроса к AI
    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 1.0,
      top_p: 1.0,
      max_tokens: 1000,
      model: modelName,
    });

    const answer = response.choices[0].message.content ?? "";
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
function is3DPrintingRelated(text: string): boolean {
  const keywords = [
    "3d",
    "пластик",
    "pla",
    "abs",
    "petg",
    "tpu",
    "температура",
    "экструзия",
    "стол",
    "наполнитель",
    "прочность",
    "гибкость",
    "термостойкость",
    "фильтр",
    "фильтрующий",
    "материал",
    "материалы",
    "печать",
    "печатью",
    "печати",
    "печатать",
    "печати",
    "печатание",
    "3d-печать",
    "3d-печати",
    "3d-печатию",
    "3d-печатью",
    "3d-",
    "адгезия",
    "адгезив",
    "адгезивный",
    "адгезивом",
    "адгезиву",
    "адгезия",
    "адгезий",
    "адгезияю",
    "адгезиям",
    "адгезии",
    "адгезиях",
    "адгезии",
    "адгезиями",
  ];
  return keywords.some((keyword) => text.toLowerCase().includes(keyword));
}

// Запуск бота
bot.start();
console.log("Бот запущен и готов к работе!");

