import dotenv from "dotenv";
import { bot } from "./lib/context";
import { register_admin } from "./handlers/admin";
import { register_commands } from "./handlers/commands";
import { register_message } from "./handlers/messages";


// Инициализация окружения
dotenv.config();

// Регистрация обработчиков
async function setupBot() {
  register_commands();
  register_admin(); // Админские команды (/getcache)
  register_message(); // Обработчики сообщений

}

// Запуск бота
async function bootstrap() {
  try {
    setupBot();
    bot.start({
      onStart: (info) => console.log(`🤖Бот запущен как ${info.username}`),
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
