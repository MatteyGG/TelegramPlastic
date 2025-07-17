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
  context.candidateProducts = foundProducts;
  context.pendingMessage = userMessage;
  chatCache.update(chatId, context);

 // Создаем кнопокии
  const productButtons = foundProducts.map(product => [
    { text: product.title, callback_data: `product:${product.id}` }
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

//  функция для получения выбранных продуктов
export function selectProductsFromCandidate(
  candidateProducts: Product[],
  productId: string
): Product[] | null {
  if (!candidateProducts || candidateProducts.length === 0) {
    return null;
  }

  let selectedProducts: Product[] = [];

  if (productId === "all") {
    selectedProducts = [...candidateProducts];
  } else if (productId !== "cancel") {
    const product = candidateProducts.find(p => p.id === productId);
    if (product) selectedProducts = [product];
  }

  return selectedProducts.length > 0 ? selectedProducts : null;
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