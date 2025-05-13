import { Context } from "grammy";
import { bot } from "../lib/context";
import fs from "fs/promises";
import path from "path";
import { InputFile } from "grammy";
import { loadConfig } from "../modules/getConfig";
import { mainLogger } from "../modules/logger";

const CONFIG_PATH = "./config";

async function verifyAdmin(ctx: Context): Promise<boolean> {
  return ctx.from?.id.toString() === process.env.ADMIN_ID;
}

export function register_admin() {
  mainLogger.info("Registering admin commands");

  // Команда для редактирования конфигов
  bot.command("editconfig", async (ctx) => {
    if (!(await verifyAdmin(ctx))) {
      return ctx.reply("🚫 Доступ запрещен");
    } 

    const [_, type, key, ...valueParts] = ctx.msg.text.split(" ");
    const value = valueParts.join(" ");

    if (!type || !key || !value) {
      return ctx.reply("❌ Неверный формат команды. Используйте: /editconfig <тип> <ключ> <значение>");
    }

    try {
      const configFile = path.join(CONFIG_PATH, `${type}.json`);
      const data = JSON.parse(await fs.readFile(configFile, "utf-8"));

      const keys = key.split(".");
      let target = data;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = JSON.parse(value);

      await fs.writeFile(configFile, JSON.stringify(data, null, 2));
      await ctx.reply("✅ Конфиг успешно обновлен!");
    } catch (error: any) {
      console.error("Config edit error:", error);
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  // Просмотр конфига
  bot.command("viewconfig", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const [_, type] = ctx.msg.text.split(" ");
    if (!type) return ctx.reply("❌ Укажите тип конфига");

    try {
      const configFile = path.join(CONFIG_PATH, `${type}.json`);
      const data = await fs.readFile(configFile, "utf-8");
      await ctx.reply(`📝 ${type}.json:\n<code>${data}</code>`, {
        parse_mode: "HTML"
      });
    } catch (error) {
      await ctx.reply("❌ Файл не найден или ошибка чтения");
    }
  });

  // Скачать конфиг
  bot.command("getconfig", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const [_, type] = ctx.msg.text.split(" ");
    if (!type) return ctx.reply("❌ Укажите тип конфига");

    try {
      const configPath = path.resolve(CONFIG_PATH, `${type}.json`);
      await fs.access(configPath); // Проверка существования файла
      await ctx.replyWithDocument(
        new InputFile(configPath),
        { caption: `${type}.json` }
      );
    } catch (error) {
      await ctx.reply("❌ Файл не найден");
    }
  });

  // Загрузка нового конфига
  bot.on("message:document", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const doc = ctx.message.document;
    if (!doc?.file_name?.endsWith(".json")) {
      return ctx.reply("❌ Можно загружать только JSON-файлы");
    }

    try {

      const dest = path.join(CONFIG_PATH, doc.file_name);
      const file = await ctx.getFile();
      // @ts-ignore
      const tempPath = await file.download(); // Получаем путь к временному файлу
      const data = await fs.readFile(tempPath); // Читаем JSON data
      await fs.writeFile(dest, data); // Пишем JSON data

      await ctx.reply("✅ Файл конфига успешно обновлен!");
    } catch (error) {
      console.error("File upload error:", error);
      await ctx.reply("❌ Ошибка загрузки файла");
    }
  });

  bot.command("reload", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;
  
    try {
      await loadConfig(true); // Принудительная перезагрузка
      await ctx.reply("✅ Конфигурация полностью обновлена!");
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка перезагрузки: ${error.message}`);
      console.error('Reload Error:', error);
    }
  });
  
}