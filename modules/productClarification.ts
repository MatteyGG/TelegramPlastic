import { Context } from "grammy";
import { ChatContext, chatCache } from "./cache";
import { Product } from "../types";

export async function handleProductClarification(
  ctx: Context,
  userMessage: string,
  foundProducts: Product[]
) {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return false;

  const context = chatCache.getOrCreate(chatId);
  
  // Сохраняем состояние для последующей обработки
  context.waitingForProductSelection = true;
  context.candidateProducts = foundProducts; // Сохраняем весь массив продуктов
  context.pendingMessage = userMessage;
  chatCache.update(chatId, context);

  // Создаем кнопки для продуктов (вертикально)
  const productButtons = foundProducts.map((product, index) => [
    { text: product.title, callback_data: `product:${index}` } // Используем индекс вместо ID
  ]);

  // Кнопки "Все" и "Отмена" в одном ряду
  const actionButtons = [
    { text: "Все продукты", callback_data: "product:all" },
    { text: "Отмена уточнения", callback_data: "product:cancel" }
  ];

  await ctx.reply("Уточните, какой именно продукт вас интересует:", {
    reply_markup: {
      inline_keyboard: [...productButtons, actionButtons]
    }
  });

  return true;
}

// Функция для получения выбранных продуктов по индексу
export function selectProductsFromCandidate(
  candidateProducts: Product[],
  productIndex: string // Принимаем индекс или спец. значение
): Product[] {
  if (!candidateProducts || candidateProducts.length === 0) {
    return [];
  }

  if (productIndex === "all") {
    return [...candidateProducts];
  } else if (productIndex === "cancel") {
    return [];
  } else {
    const index = parseInt(productIndex);
    if (!isNaN(index) && index >= 0 && index < candidateProducts.length) {
      return [candidateProducts[index]];
    }
    return [];
  }
}

// Функция для завершения процесса уточнения
export function completeProductClarification(chatId: string) {
  const context = chatCache.getOrCreate(chatId);
  
  // Сбрасываем состояние уточнения
  context.waitingForProductSelection = false;
  delete context.candidateProducts;
  delete context.pendingMessage;
  
  chatCache.update(chatId, context);
}