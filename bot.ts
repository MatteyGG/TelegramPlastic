import dotenv from "dotenv";
import { bot } from "./lib/context";
import { register_admin } from "./handlers/admin";
import { register_commands } from "./handlers/commands";
import { register_message } from "./handlers/messages";
import { hydrateFiles } from "@grammyjs/files";
import { limit } from "@grammyjs/ratelimiter";
import { getResponse, loadConfig } from "./modules/getConfig";
import { initSearch } from "./modules/search";
import { printBanner } from "./modules/printBanner";
import { mainLogger } from "./modules/logger";




// Инициализация окружения
dotenv.config();

// Регистрация плагинов
async function registerPlugins() {
  bot.api.config.use(hydrateFiles(bot.token));
  bot.use(limit({
    timeFrame: 3000,
    limit: 1,
    onLimitExceeded: async (ctx) => {
      await ctx.reply(getResponse("ratelimit"));
    },
  }));
}

// Регистрация обработчиков
async function setupBot() {
  loadConfig();
  initSearch();
  register_commands();
  register_admin(); // Админские команды (/getcache)
  register_message(); // Обработчики сообщений

}

// Запуск бота
async function bootstrap() {
  try {
    await printBanner();
    await registerPlugins();
    await setupBot();
    bot.start({
      onStart: (info) => mainLogger.info(`🤖Бот запущен как ${info.username}`),
      drop_pending_updates: true,
    });

  } catch (error) {
    console.error("💥 Ошибка запуска:", error);
    process.exit(1);
  }
}

bootstrap();

// Обработка ошибок
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`⚠️ Ошибка в обработчике ${ctx.update.update_id}:`, err.error);
  ctx.reply("😔 Произошла техническая ошибка").catch(console.error);
});
