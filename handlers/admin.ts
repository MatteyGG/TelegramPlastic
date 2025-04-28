import { Bot, Context } from "grammy";
import { bot } from "../lib/context";
import { getAllCache } from "../modules/cache";

export function register_admin() {
  console.log("Registering admin commands");

  bot.command("getcache", (ctx: Context) => {
    console.log("/getcache called. User ID:", ctx.from?.id);

    if (ctx.from?.id.toString() !== process.env.ADMIN_ID) {
      ctx.reply("Доступ запрещен");
      return;
    }

    const cacheItems = Array.from(getAllCache());
    console.log("Cache:", cacheItems);

    ctx.reply(
      `Cache (${cacheItems.length}):\n${cacheItems
        .map(([k, { answer }]) => `• ${k} -> ${answer}`)
        .join("\n")}`
    );
  });
}

