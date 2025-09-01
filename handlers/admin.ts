// src/handlers/admin.ts
import { Context } from "grammy";
import { bot } from "../lib/context";
import { InputFile } from "grammy";
import { loadConfig } from "../modules/getConfig";
import { LOGGER_DIR, mainLogger } from "../modules/logger";
import { chatCache, getCacheStats } from "../modules/cache";
import { prisma } from "../modules/database";
import { getDialogHistory, getDialogHistoryByUsername } from '../modules/dialogHistory';

import path from "path";
import fs from "fs/promises";

async function verifyAdmin(ctx: Context): Promise<boolean> {
  return ctx.from?.id.toString() === process.env.ADMIN_ID;
}

export function register_admin() {
  mainLogger.info("Registering admin commands");

  // Команда для редактирования конфигов в БД
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
      // Обработка разных типов конфигов
      if (type === "response") {
        await prisma.response.upsert({
          where: { key },
          update: { value },
          create: { key, value }
        });
        await ctx.reply("✅ Response успешно обновлен в БД!");
      }
      else if (type === "prompt") {
        await prisma.prompt.upsert({
          where: { key },
          update: { value },
          create: { key, value }
        });
        await ctx.reply("✅ Prompt успешно обновлен в БД!");
      }
      else {
        return ctx.reply("❌ Неподдерживаемый тип конфига. Доступные: response, prompt");
      }
    } catch (error: any) {
      console.error("Config edit error:", error);
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  // Просмотр конфига из БД
  bot.command("viewconfig", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const [_, type] = ctx.msg.text.split(" ");
    if (!type) return ctx.reply("❌ Укажите тип конфига (responses, prompt, products)");

    try {
      let data = "";

      if (type === "responses") {
        const responses = await prisma.response.findMany();
        data = JSON.stringify(responses, null, 2);
      }
      else if (type === "prompt") {
        const prompt = await prisma.prompt.findFirst();
        data = JSON.stringify(prompt, null, 2);
      }
      else if (type === "products") {
        const products = await prisma.product.findMany({ take: 5 }); // Ограничим вывод
        data = JSON.stringify(products, null, 2);
      }
      else {
        return ctx.reply("❌ Неподдерживаемый тип конфига");
      }

      await ctx.reply(`📝 ${type} из БД:\n<code>${data}</code>`, {
        parse_mode: "HTML"
      });
    } catch (error) {
      await ctx.reply("❌ Ошибка чтения из БД");
    }
  });

  // Получение логов (остается без изменений)
  bot.command("getlog", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const [_, type] = ctx.msg.text.split(" ");
    if (!type) return ctx.reply("❌ Укажите тип логов (requests/bot)");

    try {
      const logPath = path.resolve(LOGGER_DIR, `${type}.log`);
      await fs.access(logPath); // Проверка существования файла
      await ctx.replyWithDocument(
        new InputFile(logPath),
        { caption: `${type}.log` }
      );
    } catch (error) {
      await ctx.reply("❌ Файл не найден");
    }
  });

  // Статистика кэша (остается без изменений)
  bot.command("getcache", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const stats = getCacheStats();
    const formattedStats = `
      📊 Использование памяти:
      - FAQ: ${stats.faq}
      - Поиск: ${stats.search}
      - Вопросы: ${stats.general}
      - Диалоги пользователей: ${stats.clientDialogCache}
      - Всего: ${stats.total}
    `;
    ctx.reply(formattedStats);
  });

  bot.command("gethistorybyuser", async (ctx) => {
  if (!(await verifyAdmin(ctx))) return;

  const [_, username, limit = "10"] = ctx.msg.text.split(" ");
  if (!username) return ctx.reply("❌ Укажите username пользователя");

  try {
    const history = await getDialogHistoryByUsername(username, parseInt(limit));

    if (history.length === 0) {
      return ctx.reply(`📝 История диалогов для @${username} пуста`);
    }

    let historyText = `📝 История диалогов для @${username}:\n\n`;
    
    history.reverse().forEach((record, index) => {
      const date = new Date(record.timestamp).toLocaleString('ru-RU');
      historyText += `${index + 1}. [${date}] ${record.role}: ${record.message}\n`;
      
      if (record.products) {
        try {
          const products = JSON.parse(record.products);
          if (products.length > 0) {
            historyText += `   📦 Продукты: ${products.map((p: any) => p.title).join(', ')}\n`;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      historyText += '\n';
    });

    // Разбиваем сообщение на части, если оно слишком длинное
    if (historyText.length > 4000) {
      const parts = [];
      for (let i = 0; i < historyText.length; i += 4000) {
        parts.push(historyText.substring(i, i + 4000));
      }
      for (const part of parts) {
        await ctx.reply(part);
      }
    } else {
      await ctx.reply(historyText);
    }
  } catch (error) {
    console.error('History by user error:', error);
    await ctx.reply('❌ Ошибка получения истории по username');
  }
});

// Обновим существующую команду gethistory для отображения username
bot.command("gethistory", async (ctx) => {
  if (!(await verifyAdmin(ctx))) return;

  const [_, chatId, limit = "10"] = ctx.msg.text.split(" ");
  if (!chatId) return ctx.reply("❌ Укажите ID чата");

  try {
    const history = await getDialogHistory(chatId, parseInt(limit));

    if (history.length === 0) {
      return ctx.reply("📝 История диалогов пуста");
    }

    let historyText = `📝 История диалогов для ${chatId}:\n\n`;

    history.reverse().forEach((record, index) => {
      const date = new Date(record.timestamp).toLocaleString('ru-RU');
      // Добавляем отображение username, если он есть
      const userInfo = record.username ? `(@${record.username})` : '';
      historyText += `${index + 1}. [${date}] ${record.role}${userInfo}: ${record.message}\n`;

      if (record.products) {
        try {
          const products = JSON.parse(record.products);
          if (products.length > 0) {
            historyText += `   📦 Продукты: ${products.map((p: any) => p.title).join(', ')}\n`;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      historyText += '\n';
    });

    // Разбиваем сообщение на части, если оно слишком длинное
    if (historyText.length > 4000) {
      const parts = [];
      for (let i = 0; i < historyText.length; i += 4000) {
        parts.push(historyText.substring(i, i + 4000));
      }
      for (const part of parts) {
        await ctx.reply(part);
      }
    } else {
      await ctx.reply(historyText);
    }
  } catch (error) {
    console.error('History error:', error);
    await ctx.reply('❌ Ошибка получения истории');
  }
});

  // Команда для принудительного сохранения истории
bot.command("savehistory", async (ctx) => {
  if (!(await verifyAdmin(ctx))) return;

  const [_, chatId] = ctx.msg.text.split(" ");
  if (!chatId) return ctx.reply("❌ Укажите ID чата");

  try {
    await chatCache.forceSave(chatId);
    await ctx.reply("✅ История диалога сохранена в БД");
  } catch (error) {
    console.error('Save history error:', error);
    await ctx.reply('❌ Ошибка сохранения истории');
  }
});


  // Перезагрузка конфигурации из БД
  bot.command("reload", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    try {
      await loadConfig(true); // Принудительная перезагрузка из БД
      await ctx.reply("✅ Конфигурация полностью обновлена из БД!");
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка перезагрузки: ${error.message}`);
      console.error('Reload Error:', error);
    }
  });
}