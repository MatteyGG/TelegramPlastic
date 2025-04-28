import { bot } from "../lib/context";

export function register_commands() {
  console.log("Registering commands...");
  bot.command("start", (ctx) =>
    ctx.reply(
      "Привет! Я помогу выбрать материалы для 3D-печати. Задавайте вопросы! 🛠️\n\nhttps://github.com/MatteyGG/TelegramPlastic"
    )
  );

  bot.command("help", (ctx) =>
    ctx.reply(
      "Привет! Я помогу выбрать материалы для 3D-печати. Задавайте вопросы! 🛠️\n\nhttps://github.com/MatteyGG/TelegramPlastic"
    )
  );
}
