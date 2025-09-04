// src/handlers/admin.ts
import { Context, InlineKeyboard } from "grammy";
import { bot } from "../lib/context";
import { InputFile } from "grammy";
import { loadConfig } from "../modules/getConfig";
import { LOGGER_DIR, mainLogger } from "../modules/logger";
import { chatCache, getCacheStats } from "../modules/cache";
import { prisma } from "../modules/database";
import { getDialogHistory, getDialogHistoryByUsername } from '../modules/dialogHistory';
import path from "path";
import fs from "fs/promises";
import { verifyAdmin } from "../lib/isAdmin";

// Интерфейсы для состояния админ-панели
interface AdminState {
  currentPage: string;
  data: any;
  editingConfig?: {
    type: string;
    key: string;
    currentValue: string;
  };
}

// Кэш состояний админов
const adminStates = new Map<number, AdminState>();

// Состояние для отслеживания ожидания файла
const awaitingFile = new Map<number, boolean>();

// Дефолтные значения конфигов
const DEFAULT_RESPONSES = {
  "start": "Привет! Я помогу выбрать материалы для 3D-печати. Задавайте вопросы! 🛠️",
  "startAdmin": "👋 Добро пожаловать в панель управления!",
  "help": "Привет! Я помогу...",
  "ratelimit": "Пожалуйста, подождите немного перед отправкой следующего сообщения."
};

const DEFAULT_PROMPT = {
  "system_prompt": "Вы эксперт по 3D-печати на FDM принтерах. Отвечайте кратко, используя историю диалога."
};

// Главное меню админ-панели
function getMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Статистика", "admin_stats")
    .text("📝 Конфиги", "admin_configs").row()
    .text("💬 Диалоги", "admin_dialogs")
    .text("👥 Админы", "admin_manage").row()
    .text("📁 Логи", "admin_logs")
    .text("✨ Продукты", "admin_products").row()
    .text("🔄 Перезагрузка", "admin_reload")
    .text("❌ Закрыть", "admin_close");
}

// Меню конфигурации
function getConfigMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Responses", "config_responses_1")
    .text("Prompt", "config_prompts_1").row()
    .text("◀️ Назад", "admin_main");
}

// Меню действий с конфигом
function getConfigItemMenu(type: string, key: string, page: number = 1): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Редактировать", `edit_${type}_${key}`)
    .text("🗑️ Удалить", `delete_${type}_${key}`).row()
    .text("◀️ Назад", `config_${type}s_${page}`);
}

// Меню подтверждения сброса
function getResetConfirmMenu(type: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Да", `reset_${type}_confirm`)
    .text("❌ Нет", type === "response" ? "config_responses_1" : "config_prompts_1");
}

// Меню диалогов
function getDialogsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("По ID чата", "dialog_by_id")
    .text("По username", "dialog_by_username").row()
    .text("◀️ Назад", "admin_main");
}

// Меню логов
function getLogsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Бот", "log_bot")
    .text("Запросы", "log_requests").row()
    .text("◀️ Назад", "admin_main");
}

// Меню продуктов
function getProductsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📤 Загрузить продукты", "upload_products")
    .text("📊 Статистика продуктов", "products_stats").row()
    .text("◀️ Назад", "admin_main");
}

// Функция отправки сообщения с меню
async function sendMenu(ctx: Context, text: string, menu: InlineKeyboard) {
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      reply_markup: menu,
      parse_mode: "HTML"
    });
  } else {
    await ctx.reply(text, {
      reply_markup: menu,
      parse_mode: "HTML"
    });
  }
}

// Функция для отправки длинных сообщений
async function sendLongMessage(ctx: Context, text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  if (text.length <= 4096) {
    await ctx.reply(text, { parse_mode: parseMode });
    return;
  }

  const parts = [];
  for (let i = 0; i < text.length; i += 4096) {
    parts.push(text.substring(i, i + 4096));
  }

  for (const part of parts) {
    await ctx.reply(part, { parse_mode: parseMode });
  }
}

// Функция сброса конфига к значениям по умолчанию
async function resetConfigToDefault(type: string) {
  if (type === 'responses') {
    // Удаляем все существующие responses
    await prisma.response.deleteMany({});

    // Создаем дефолтные значения
    for (const [key, value] of Object.entries(DEFAULT_RESPONSES)) {
      await prisma.response.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }
  } else if (type === 'prompt') {
    // Удаляем все существующие prompts
    await prisma.prompt.deleteMany({});

    // Создаем дефолтные значения
    for (const [key, value] of Object.entries(DEFAULT_PROMPT)) {
      await prisma.prompt.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }
  }
}

// Функции для работы с админами
async function addAdmin(userId: string, username?: string) {
  return await prisma.admin.upsert({
    where: { userId },
    update: { username },
    create: { userId, username }
  });
}

async function removeAdmin(userId: string) {
  return await prisma.admin.delete({
    where: { userId }
  });
}

async function listAdmins() {
  return await prisma.admin.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

// Функция валидации структуры продуктов
function validateProductsStructure(data: any): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Invalid JSON structure'] };
  }

  if (typeof data.timestamp !== 'string') {
    errors.push('Missing or invalid timestamp');
  }

  if (!Array.isArray(data.products)) {
    errors.push('Products must be an array');
  } else {
    data.products.forEach((product: any, index: number) => {
      if (typeof product.title !== 'string') {
        errors.push(`Product[${index}]: missing title`);
      }
      if (typeof product.material !== 'string') {
        errors.push(`Product[${index}]: missing material`);
      }
      if (!Array.isArray(product.diameters)) {
        errors.push(`Product[${index}]: diameters must be an array`);
      }
      if (!Array.isArray(product.colors)) {
        errors.push(`Product[${index}]: colors must be an array`);
      }
      if (!Array.isArray(product.links)) {
        errors.push(`Product[${index}]: links must be an array`);
      }
      if (typeof product.weight !== 'string') {
        errors.push(`Product[${index}]: missing weight`);
      }
      if (typeof product.description !== 'string') {
        errors.push(`Product[${index}]: missing description`);
      }
      if (!product.characteristics || typeof product.characteristics !== 'object') {
        errors.push(`Product[${index}]: characteristics must be an object`);
      }
    });
  }

  return errors.length === 0 ? { isValid: true } : { isValid: false, errors };
}

// Меню управления админами
function getAdminsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📋 Список админов", "list_admins")
    .text("➕ Добавить админа", "add_admin").row()
    .text("➖ Убрать админа", "remove_admin").row()
    .text("◀️ Назад", "admin_main");
}

// Обработчики для конфигов Responses
async function handleResponsesConfig(ctx: any, page: number) {
  const itemsPerPage = 5;
  const skip = (page - 1) * itemsPerPage;

  const [responses, total] = await Promise.all([
    prisma.response.findMany({
      skip,
      take: itemsPerPage,
      orderBy: { key: 'asc' }
    }),
    prisma.response.count()
  ]);

  const totalPages = Math.ceil(total / itemsPerPage);

  let responseText = `<b>Responses (стр. ${page}/${totalPages})</b>\n\n`;
  responses.forEach((item, index) => {
    responseText += `<b>${skip + index + 1}. ${item.key}:</b>\n<code>${item.value.substring(0, 50)}${item.value.length > 50 ? '...' : ''}</code>\n\n`;
  });

  const keyboard = new InlineKeyboard();

  // Кнопки для каждого response
  responses.forEach(item => {
    keyboard.text(`✏️ ${item.key}`, `config_item_response_${item.key}_${page}`);
  });

  keyboard.row();

  if (page > 1) {
    keyboard.text("⬅️ Назад", `config_responses_${page - 1}`);
  }

  if (page < totalPages) {
    keyboard.text("Вперед ➡️", `config_responses_${page + 1}`);
  }

  keyboard.row().text("➕ Добавить response", "add_response");
  keyboard.row().text("🔄 Сбросить к дефолту", `reset_responses`);
  keyboard.row().text("◀️ В меню", "admin_configs");

  await sendMenu(ctx, responseText, keyboard);
  await ctx.answerCallbackQuery();
}

// Обработчики для конфигов Prompt
async function handlePromptsConfig(ctx: any, page: number) {
  const itemsPerPage = 5;
  const skip = (page - 1) * itemsPerPage;

  const [prompts, total] = await Promise.all([
    prisma.prompt.findMany({
      skip,
      take: itemsPerPage,
      orderBy: { key: 'asc' }
    }),
    prisma.prompt.count()
  ]);

  const totalPages = Math.ceil(total / itemsPerPage);

  let promptText = `<b>Prompts (стр. ${page}/${totalPages})</b>\n\n`;
  prompts.forEach((item, index) => {
    promptText += `<b>${skip + index + 1}. ${item.key}:</b>\n<code>${item.value.substring(0, 100)}${item.value.length > 100 ? '...' : ''}</code>\n\n`;
  });

  const keyboard = new InlineKeyboard();

  // Кнопки для каждого prompt
  prompts.forEach(item => {
    keyboard.text(`✏️ ${item.key}`, `config_item_prompt_${item.key}_${page}`);
  });

  keyboard.row();

  if (page > 1) {
    keyboard.text("⬅️ Назад", `config_prompts_${page - 1}`);
  }

  if (page < totalPages) {
    keyboard.text("Вперед ➡️", `config_prompts_${page + 1}`);
  }

  keyboard.row().text("➕ Добавить prompt", "add_prompt");
  keyboard.row().text("🔄 Сбросить к дефолту", `reset_prompt`);
  keyboard.row().text("◀️ В меню", "admin_configs");

  await sendMenu(ctx, promptText, keyboard);
  await ctx.answerCallbackQuery();
}

// Регистрация обработчиков админ-панели
export function register_admin() {
  mainLogger.info("Registering admin commands");

  // Команда для открытия админ-панели
  bot.command("admin", async (ctx) => {
    if (!(await verifyAdmin(ctx))) {
      return ctx.reply("🚫 Доступ запрещен");
    }

    const adminId = ctx.from!.id;
    adminStates.set(adminId, { currentPage: "main", data: null });

    await sendMenu(
      ctx,
      "🛠️ <b>Админ-панель</b>\n\nВыберите раздел:",
      getMainMenu()
    );
  });

  // Обработчики инлайн-кнопок
  // Главное меню
  bot.callbackQuery("admin_main", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    adminStates.set(adminId, { currentPage: "main", data: null });

    await sendMenu(
      ctx,
      "🛠️ <b>Админ-панель</b>\n\nВыберите раздел:",
      getMainMenu()
    );
    await ctx.answerCallbackQuery();
  });

  // Статистика
  bot.callbackQuery("admin_stats", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const stats = getCacheStats();
    const [userCount, productCount] = await Promise.all([
      prisma.dialogHistory.groupBy({ by: ['chatId'] }),
      prisma.product.count(),
    ]);

    const statsText = `
📊 <b>Статистика системы</b>

<b>Кэш:</b>
- Поиск: ${stats.search}
- Вопросы: ${stats.general}
- Диалоги: ${stats.clientDialogCache}
- Всего: ${stats.total}

<b>База данных:</b>
- Пользователей: ${userCount.length}
- Продуктов: ${productCount}
    `.trim();

    await sendMenu(
      ctx,
      statsText,
      new InlineKeyboard().text("◀️ Назад", "admin_main")
    );
    await ctx.answerCallbackQuery();
  });

  // Конфиги
  bot.callbackQuery("admin_configs", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    adminStates.set(adminId, { currentPage: "configs", data: null });

    await sendMenu(
      ctx,
      "⚙️ <b>Управление конфигурацией</b>\n\nВыберите тип конфига:",
      getConfigMenu()
    );
    await ctx.answerCallbackQuery();
  });

  // Обработчик кнопки "Продукты"
  bot.callbackQuery("admin_products", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await sendMenu(
      ctx,
      "🔄 Управление продуктами\n\nВыберите действие:",
      getProductsMenu()
    );
    await ctx.answerCallbackQuery();
  });

  // Обработчик кнопки "Загрузить продукты"
  bot.callbackQuery("upload_products", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    awaitingFile.set(adminId, true);

    await ctx.editMessageText(
      '📤 Отправьте JSON файл с продуктами. Файл должен быть создан парсером.\n\n' +
      'Для отмены используйте кнопку ниже:',
      {
        reply_markup: new InlineKeyboard().text('❌ Отмена', 'cancel_upload')
      }
    );
    await ctx.answerCallbackQuery();
  });

  // Обработчик кнопки "Статистика продуктов"
  bot.callbackQuery("products_stats", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const productCount = await prisma.product.count();
    const materials = await prisma.product.groupBy({
      by: ['material'],
      _count: { _all: true }
    });
    
    let statsText = `📊 Статистика продуктов:\n\nВсего продуктов: ${productCount}\n\n`;
    
    materials.forEach(material => {
      statsText += `• ${material.material}: ${material._count._all}\n`;
    });

    await sendMenu(
      ctx,
      statsText,
      new InlineKeyboard().text("◀️ Назад", "admin_products")
    );
    await ctx.answerCallbackQuery();
  });

  // Обработчик отмены загрузки
  bot.callbackQuery("cancel_upload", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    awaitingFile.delete(adminId);

    await ctx.editMessageText("Загрузка продуктов отменена");
    await ctx.answerCallbackQuery();
  });

  // Просмотр responses с пагинацией
  bot.callbackQuery(/^config_responses_(\d+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;
    await handleResponsesConfig(ctx, parseInt(ctx.match[1]));
  });

  // Просмотр prompts с пагинацией
  bot.callbackQuery(/^config_prompts_(\d+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;
    await handlePromptsConfig(ctx, parseInt(ctx.match[1]));
  });

  // Просмотр конкретного response
  bot.callbackQuery(/^config_item_response_(.+)_(\d+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const key = ctx.match[1];
    const page = parseInt(ctx.match[2]);

    const response = await prisma.response.findUnique({
      where: { key }
    });

    if (!response) {
      await ctx.answerCallbackQuery({ text: "❌ Response не найден" });
      return;
    }

    const responseText = `
<b>Response:</b> ${response.key}
<code>${response.value}</code>
    `.trim();

    await sendMenu(
      ctx,
      responseText,
      getConfigItemMenu("response", response.key, page)
    );
    await ctx.answerCallbackQuery();
  });

  // Просмотр конкретного prompt
  bot.callbackQuery(/^config_item_prompt_(.+)_(\d+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const key = ctx.match[1];
    const page = parseInt(ctx.match[2]);

    const prompt = await prisma.prompt.findUnique({
      where: { key }
    });

    if (!prompt) {
      await ctx.answerCallbackQuery({ text: "❌ Prompt не найден" });
      return;
    }

    const promptText = `
<b>Prompt:</b> ${prompt.key}
<code>${prompt.value}</code>
    `.trim();

    await sendMenu(
      ctx,
      promptText,
      getConfigItemMenu("prompt", prompt.key, page)
    );
    await ctx.answerCallbackQuery();
  });

  // Редактирование response
  bot.callbackQuery(/^edit_response_(.+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const key = ctx.match[1];
    const adminId = ctx.from.id;

    const response = await prisma.response.findUnique({
      where: { key }
    });

    if (!response) {
      await ctx.answerCallbackQuery({ text: "❌ Response не найден" });
      return;
    }

    // Сохраняем состояние редактирования
    adminStates.set(adminId, {
      currentPage: "editing_response",
      data: null,
      editingConfig: {
        type: "response",
        key: response.key,
        currentValue: response.value
      }
    });

    await ctx.editMessageText(
      `✏️ <b>Редактирование response:</b> ${response.key}\n\nТекущее значение:\n<code>${response.value}</code>\n\nВведите новое значение:`,
      { parse_mode: "HTML" }
    );
    await ctx.answerCallbackQuery();
  });

  // Редактирование prompt
  bot.callbackQuery(/^edit_prompt_(.+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const key = ctx.match[1];
    const adminId = ctx.from.id;

    const prompt = await prisma.prompt.findUnique({
      where: { key }
    });

    if (!prompt) {
      await ctx.answerCallbackQuery({ text: "❌ Prompt не найден" });
      return;
    }

    // Сохраняем состояние редактирования
    adminStates.set(adminId, {
      currentPage: "editing_prompt",
      data: null,
      editingConfig: {
        type: "prompt",
        key: prompt.key,
        currentValue: prompt.value
      }
    });

    await ctx.editMessageText(
      `✏️ <b>Редактирование prompt:</b> ${prompt.key}\n\nТекущее значение:\n<code>${prompt.value}</code>\n\nВведите новое значение:`,
      { parse_mode: "HTML" }
    );
    await ctx.answerCallbackQuery();
  });

  // Добавление нового response
  bot.callbackQuery("add_response", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;

    // Сохраняем состояние добавления
    adminStates.set(adminId, {
      currentPage: "adding_response",
      data: null
    });

    await ctx.editMessageText(
      "➕ <b>Добавление нового response</b>\n\nВведите данные в формате:\n<code>ключ|значение</code>\n\nНапример:\n<code>welcome|Добро пожаловать!</code>",
      { parse_mode: "HTML" }
    );
    await ctx.answerCallbackQuery();
  });

  // Добавление нового prompt
  bot.callbackQuery("add_prompt", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;

    // Сохраняем состояние добавления
    adminStates.set(adminId, {
      currentPage: "adding_prompt",
      data: null
    });

    await ctx.editMessageText(
      "➕ <b>Добавление нового prompt</b>\n\nВведите данные в формате:\n<code>ключ|значение</code>\n\nНапример:\n<code>system_prompt|Ваш текст промпта</code>",
      { parse_mode: "HTML" }
    );
    await ctx.answerCallbackQuery();
  });

  // Удаление response
  bot.callbackQuery(/^delete_response_(.+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const key = ctx.match[1];

    try {
      await prisma.response.delete({
        where: { key }
      });

      await ctx.answerCallbackQuery({ text: "✅ Response удален" });

      // Возвращаемся к списку responses
      await sendMenu(
        ctx,
        "⚙️ <b>Управление конфигурацией</b>\n\nВыберите тип конфига:",
        getConfigMenu()
      );
    } catch (error) {
      await ctx.answerCallbackQuery({ text: "❌ Ошибка при удалении" });
    }
  });

  // Удаление prompt
  bot.callbackQuery(/^delete_prompt_(.+)$/, async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const key = ctx.match[1];

    try {
      await prisma.prompt.delete({
        where: { key }
      });

      await ctx.answerCallbackQuery({ text: "✅ Prompt удален" });

      // Возвращаемся к списку prompts
      await sendMenu(
        ctx,
        "⚙️ <b>Управление конфигурацией</b>\n\nВыберите тип конфига:",
        getConfigMenu()
      );
    } catch (error) {
      await ctx.answerCallbackQuery({ text: "❌ Ошибка при удалении" });
    }
  });

  // Подтверждение сброса responses
  bot.callbackQuery("reset_responses", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await sendMenu(
      ctx,
      "🔄 <b>Сброс responses</b>\n\nВы уверены, что хотите сбросить все responses к значениям по умолчанию?",
      getResetConfirmMenu("response")
    );
    await ctx.answerCallbackQuery();
  });

  // Подтверждение сброса prompt
  bot.callbackQuery("reset_prompt", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await sendMenu(
      ctx,
      "🔄 <b>Сброс prompt</b>\n\nВы уверены, что хотите сбросить все prompts к значениям по умолчанию?",
      getResetConfirmMenu("prompt")
    );
    await ctx.answerCallbackQuery();
  });

  // Выполнение сброса responses
  bot.callbackQuery("reset_responses_confirm", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    try {
      await resetConfigToDefault("responses");
      await ctx.answerCallbackQuery({ text: "✅ Responses сброшены к значениям по умолчанию" });

      // Возвращаемся к списку responses
      await handleResponsesConfig(ctx, 1);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: "❌ Ошибка при сбросе responses" });
    }
  });

  // Выполнение сброса prompt
  bot.callbackQuery("reset_prompt_confirm", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    try {
      await resetConfigToDefault("prompt");
      await ctx.answerCallbackQuery({ text: "✅ Prompts сброшены к значениям по умолчанию" });

      // Возвращаемся к списку prompts
      await handlePromptsConfig(ctx, 1);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: "❌ Ошибка при сбросе prompts" });
    }
  });

  // Диалоги
  bot.callbackQuery("admin_dialogs", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    adminStates.set(adminId, { currentPage: "dialogs", data: null });

    await sendMenu(
      ctx,
      "💬 <b>Просмотр диалогов</b>\n\nВыберите тип поиска:",
      getDialogsMenu()
    );
    await ctx.answerCallbackQuery();
  });

  // Запрос ID чата для просмотра истории
  bot.callbackQuery("dialog_by_id", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await ctx.editMessageText("Введите ID чата для просмотра истории:");
    await ctx.answerCallbackQuery();

    // Ожидаем следующий ввод от пользователя
    const adminId = ctx.from.id;
    adminStates.set(adminId, {
      currentPage: "awaiting_chat_id",
      data: null
    });
  });

  // Запрос username для просмотра истории
  bot.callbackQuery("dialog_by_username", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await ctx.editMessageText("Введите username для просмотра истории (без @):");
    await ctx.answerCallbackQuery();

    // Ожидаем следующий ввод от пользователя
    const adminId = ctx.from.id;
    adminStates.set(adminId, {
      currentPage: "awaiting_username",
      data: null
    });
  });

  // Обработчик для раздела админов
  bot.callbackQuery("admin_manage", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    adminStates.set(adminId, { currentPage: "manage_admins", data: null });

    await sendMenu(
      ctx,
      "👥 <b>Управление администраторами</b>\n\nВыберите действие:",
      getAdminsMenu()
    );
    await ctx.answerCallbackQuery();
  });

  // Просмотр списка админов
  bot.callbackQuery("list_admins", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const admins = await listAdmins();
    let adminsText = "<b>📋 Список администраторов:</b>\n\n";

    admins.forEach((admin, index) => {
      adminsText += `${index + 1}. ID: ${admin.userId}`;
      if (admin.username) {
        adminsText += ` (@${admin.username})`;
      }
      adminsText += `\n   Добавлен: ${admin.createdAt.toLocaleDateString('ru-RU')}\n\n`;
    });

    await sendMenu(
      ctx,
      adminsText,
      new InlineKeyboard().text("◀️ Назад", "admin_manage")
    );
    await ctx.answerCallbackQuery();
  });

  // Добавление админа
  bot.callbackQuery("add_admin", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await ctx.editMessageText("Введите ID пользователя для добавления в админы (можно с @username):");
    await ctx.answerCallbackQuery();

    const adminId = ctx.from.id;
    adminStates.set(adminId, {
      currentPage: "adding_admin",
      data: null
    });
  });

  // Удаление админа
  bot.callbackQuery("remove_admin", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await ctx.editMessageText("Введите ID пользователя для удаления из админов (можно с @username):");
    await ctx.answerCallbackQuery();

    const adminId = ctx.from.id;
    adminStates.set(adminId, {
      currentPage: "removing_admin",
      data: null
    });
  });

  // Обработка ввода chatId или username
  bot.on("message:text", async (ctx, next) => {
    if (!(await verifyAdmin(ctx))) {
      return next(); // Пропускаем если не админ
    }

    const adminId = ctx.from.id;
    const state = adminStates.get(adminId);

    // Если нет активного состояния - пропускаем сообщение дальше
    if (!state) {
      return next();
    }

    const text = ctx.message.text;

    if (state.currentPage === "awaiting_chat_id") {
      try {
        const history = await getDialogHistory(text, 10);

        if (history.length === 0) {
          await ctx.reply("📝 История диалогов пуста");
          await sendMenu(ctx, "💬 <b>Просмотр диалогов</b>", getDialogsMenu());
          return;
        }

        let historyText = `📝 <b>История диалогов для ${text}:</b>\n\n`;

        history.reverse().forEach((record, index) => {
          const date = new Date(record.timestamp).toLocaleString('ru-RU');
          const userInfo = record.username ? `(@${record.username})` : '';
          historyText += `<b>${index + 1}. [${date}] ${record.role}${userInfo}:</b>\n${record.message}\n`;

          if (record.products) {
            try {
              const products = JSON.parse(record.products);
              if (products.length > 0) {
                historyText += `   <b>📦 Продукты:</b> ${products.map((p: any) => p.title).join(', ')}\n`;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          historyText += '\n';
        });

        await sendLongMessage(ctx, historyText, "HTML");
        await sendMenu(ctx, "💬 <b>Просмотр диалогов</b>", getDialogsMenu());

        // Сбрасываем состояние
        adminStates.set(adminId, { currentPage: "dialogs", data: null });

      } catch (error) {
        console.error('History error:', error);
        await ctx.reply('❌ Ошибка получения истории');
      }
    }
    else if (state.currentPage === "awaiting_username") {
      try {
        const history = await getDialogHistoryByUsername(text, 10);

        if (history.length === 0) {
          await ctx.reply(`📝 История диалогов для @${text} пуста`);
          await sendMenu(ctx, "💬 <b>Просмотр диалогов</b>", getDialogsMenu());
          return;
        }

        let historyText = `📝 <b>История диалогов для @${text}:</b>\n\n`;

        history.reverse().forEach((record, index) => {
          const date = new Date(record.timestamp).toLocaleString('ru-RU');
          historyText += `<b>${index + 1}. [${date}] ${record.role}:</b>\n${record.message}\n`;

          if (record.products) {
            try {
              const products = JSON.parse(record.products);
              if (products.length > 0) {
                historyText += `   <b>📦 Продукты:</b> ${products.map((p: any) => p.title).join(', ')}\n`;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          historyText += '\n';
        });

        await sendLongMessage(ctx, historyText, "HTML");
        await sendMenu(ctx, "💬 <b>Просмотр диалогов</b>", getDialogsMenu());

        // Сбрасываем состояние
        adminStates.set(adminId, { currentPage: "dialogs", data: null });

      } catch (error) {
        console.error('History by user error:', error);
        await ctx.reply('❌ Ошибка получения истории по username');
      }
    }
    else if (state.currentPage === "editing_response") {
      try {
        const { key } = state.editingConfig!;

        await prisma.response.upsert({
          where: { key },
          update: { value: text },
          create: { key, value: text }
        });

        await ctx.reply("✅ Response успешно обновлен!");

        // Возвращаемся к меню конфигов
        adminStates.set(adminId, { currentPage: "configs", data: null });
        await sendMenu(ctx, "⚙️ <b>Управление конфигурацией</b>", getConfigMenu());

      } catch (error) {
        console.error('Edit response error:', error);
        await ctx.reply('❌ Ошибка при обновлении response');
      }
    }
    else if (state.currentPage === "editing_prompt") {
      try {
        const { key } = state.editingConfig!;

        await prisma.prompt.upsert({
          where: { key },
          update: { value: text },
          create: { key, value: text }
        });

        await ctx.reply("✅ Prompt успешно обновлен!");

        // Возвращаемся к меню конфигов
        adminStates.set(adminId, { currentPage: "configs", data: null });
        await sendMenu(ctx, "⚙️ <b>Управление конфигурацией</b>", getConfigMenu());

      } catch (error) {
        console.error('Edit prompt error:', error);
        await ctx.reply('❌ Ошибка при обновлении prompt');
      }
    }
    else if (state.currentPage === "adding_response") {
      try {
        const [key, ...valueParts] = text.split("|");
        const value = valueParts.join("|").trim();

        if (!key || !value) {
          await ctx.reply("❌ Неверный формат. Используйте: ключ|значение");
          return;
        }

        await prisma.response.upsert({
          where: { key },
          update: { value },
          create: { key, value }
        });

        await ctx.reply("✅ Response успешно добавлен!");

        // Возвращаемся к меню конфигов
        adminStates.set(adminId, { currentPage: "configs", data: null });
        await sendMenu(ctx, "⚙️ <b>Управление конфигурацией</b>", getConfigMenu());

      } catch (error) {
        console.error('Add response error:', error);
        await ctx.reply('❌ Ошибка при добавлении response');
      }
    }
    else if (state.currentPage === "adding_prompt") {
      try {
        const [key, ...valueParts] = text.split("|");
        const value = valueParts.join("|").trim();

        if (!key || !value) {
          await ctx.reply("❌ Неверный формат. Используйте: ключ|значение");
          return;
        }

        await prisma.prompt.upsert({
          where: { key },
          update: { value },
          create: { key, value }
        });

        await ctx.reply("✅ Prompt успешно добавлен!");

        // Возвращаемся к меню конфигов
        adminStates.set(adminId, { currentPage: "configs", data: null });
        await sendMenu(ctx, "⚙️ <b>Управление конфигурацией</b>", getConfigMenu());

      } catch (error) {
        console.error('Add prompt error:', error);
        await ctx.reply('❌ Ошибка при добавлении prompt');
      }
    }
    else if (state.currentPage === "adding_admin") {
      try {
        let userId = text.trim();
        let username: string | undefined;

        // Если введен username с @
        if (userId.startsWith('@')) {
          username = userId.slice(1);
          // Нужно получить user_id по username - это сложно без дополнительной информации
          await ctx.reply("❌ Необходимо ввести User ID, а не username. Username может меняться.");
          return;
        }

        // Добавляем админа
        await addAdmin(userId, username);
        await ctx.reply("✅ Админ успешно добавлен!");

        // Возвращаемся к меню управления админами
        adminStates.set(adminId, { currentPage: "manage_admins", data: null });
        await sendMenu(ctx, "👥 <b>Управление администраторами</b>", getAdminsMenu());

      } catch (error: any) {
        if (error.code === 'P2002') {
          await ctx.reply("❌ Этот пользователь уже является администратором");
        } else {
          await ctx.reply("❌ Ошибка при добавлении администратора");
          console.error('Add admin error:', error);
        }
      }
    }
    else if (state.currentPage === "remove_admin") {
      try {
        const userId = text.trim();

        // Удаляем админа
        await prisma.admin.delete({ where: { userId } });
        await ctx.reply("✅ Админ успешно удален!");

        // Возвращаемся к меню управления админами
        adminStates.set(adminId, { currentPage: "manage_admins", data: null });
        await sendMenu(ctx, "👥 <b>Управление администраторами</b>", getAdminsMenu());

      } catch (error) {
        await ctx.reply("❌ Ошибка при удалении администратора");
        console.error('Remove admin error:', error);
      }
    }
    else {
      // Если состояние неизвестно, очищаем его и пропускаем сообщение
      adminStates.delete(adminId);
      return next();
    }
  });

  // Обработчик документов (загрузка продуктов)
  bot.on("message:document", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;
    
    const adminId = ctx.from.id;
    
    // Проверяем, ожидаем ли мы файл от этого пользователя
    if (!awaitingFile.get(adminId)) {
      return; // Игнорируем файлы, которые не ожидались
    }
    
    // Сбрасываем состояние ожидания
    awaitingFile.delete(adminId);
    
    try {
      const document = ctx.message.document;
      
      // Проверяем, что это JSON файл
      if (!document.file_name?.endsWith('.json')) {
        await ctx.reply('❌ Файл должен быть в формате JSON');
        return;
      }
      
      if ((document.file_size ?? 0) > 5 * 1024 * 1024) { // 5MB лимит
        await ctx.reply('❌ Файл слишком большой. Максимальный размер: 5MB');
        return;
      }
      
      // Скачиваем файл
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const jsonData = await response.json();
      
      // Валидируем структуру
      const validationResult = validateProductsStructure(jsonData);
      
      if (!validationResult.isValid) {
        await ctx.reply(
          `❌ Неверная структура JSON файла:\n${validationResult.errors?.slice(0, 5).join('\n')}${validationResult.errors && validationResult.errors.length > 5 ? '\n...и еще ' + (validationResult.errors.length - 5) + ' ошибок' : ''}`
        );
        return;
      }
      
      // Создаем резервную копию
      const backupProducts = await prisma.product.findMany();
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        products: backupProducts.map(p => ({
          title: p.title,
          material: p.material,
          diameters: JSON.parse(p.diameters),
          colors: JSON.parse(p.colors),
          links: JSON.parse(p.links),
          weight: p.weight,
          description: p.description,
          characteristics: JSON.parse(p.characteristics || '[]')
        }))
      };
      
      // Отправляем резервную копию админу
      await ctx.replyWithDocument(
        new InputFile(Buffer.from(JSON.stringify(backupData, null, 2)), 'products_backup.json'),
        { caption: 'Резервная копия текущих продуктов' }
      );
      
      // Обновляем продукты в базе данных
      await prisma.$transaction(async (tx) => {
        // Удаляем старые продукты
        await tx.product.deleteMany({});
        
        // Добавляем новые продукты
        for (const product of jsonData.products) {
          await tx.product.create({
            data: {
              title: product.title,
              material: product.material,
              diameters: JSON.stringify(product.diameters),
              colors: JSON.stringify(product.colors),
              links: JSON.stringify(product.links),
              weight: product.weight,
              description: product.description,
              characteristics: JSON.stringify(product.characteristics)
            }
          });
        }
      });
      
      await ctx.reply(
        `✅ Продукты успешно обновлены!\n` +
        `Загружено: ${jsonData.products.length} продуктов\n` +
        `Резервная копия сохранена выше`
      );
      
    } catch (error) {
      console.error('Error processing products file:', error);
      await ctx.reply('❌ Ошибка при обработке файла');
    }
  });

  // Логи
  bot.callbackQuery("admin_logs", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    const adminId = ctx.from.id;
    adminStates.set(adminId, { currentPage: "logs", data: null });

    await sendMenu(
      ctx,
      "📁 <b>Логи системы</b>\n\nВыберите тип логов:",
      getLogsMenu()
    );
    await ctx.answerCallbackQuery();
  });

  // Просмотр логов бота
  bot.callbackQuery("log_bot", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    try {
      const logPath = path.resolve(LOGGER_DIR, "bot.log");
      await fs.access(logPath);
      await ctx.replyWithDocument(new InputFile(logPath), {
        caption: "bot.log"
      });
    } catch (error) {
      await ctx.reply("❌ Файл логов бота не найден");
    }

    await sendMenu(ctx, "📁 <b>Логи системы</b>", getLogsMenu());
    await ctx.answerCallbackQuery();
  });

  // Просмотр логов запросов
  bot.callbackQuery("log_requests", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    try {
      const logPath = path.resolve(LOGGER_DIR, "requests.log");
      await fs.access(logPath);
      await ctx.replyWithDocument(new InputFile(logPath), {
        caption: "requests.log"
      });
    } catch (error) {
      await ctx.reply("❌ Файл логов запросов не найден");
    }

    await sendMenu(ctx, "📁 <b>Логи системы</b>", getLogsMenu());
    await ctx.answerCallbackQuery();
  });

  // Перезагрузка конфигурации
  bot.callbackQuery("admin_reload", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    try {
      await loadConfig(true);
      await ctx.answerCallbackQuery({ text: "✅ Конфигурация обновлена!" });
    } catch (error: any) {
      await ctx.answerCallbackQuery({ text: `❌ Ошибка: ${error.message}` });
    }
  });

  // Закрытие админ-панели
  bot.callbackQuery("admin_close", async (ctx) => {
    if (!(await verifyAdmin(ctx))) return;

    await ctx.deleteMessage();
    await ctx.answerCallbackQuery({ text: "Админ-панель закрыта" });

    const adminId = ctx.from.id;
    adminStates.delete(adminId);
  });

  // Сохранение истории диалога
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
}