// src/modules/dialogHistory.ts
import { prisma } from './database';
import { Product } from '../types';

export interface DialogMessage {
  role: 'user' | 'assistant';
  message: string;
  products?: Product[];
  username?: string;
}

export async function saveDialogMessage(chatId: string, dialogMessage: DialogMessage) {
  try {
    await prisma.dialogHistory.create({
      data: {
        chatId,
        username: dialogMessage.username,
        role: dialogMessage.role,
        message: dialogMessage.message,
        products: dialogMessage.products ? JSON.stringify(dialogMessage.products) : null,
      },
    });
  } catch (error) {
    console.error('Ошибка при сохранении истории диалога:', error);
  }
}

// Обновим функцию для получения истории с учетом username
export async function getDialogHistory(chatId: string, limit: number = 20) {
  try {
    return await prisma.dialogHistory.findMany({
      where: { chatId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('Ошибка при получении истории диалога:', error);
    return [];
  }
}

// Добавим функцию для поиска истории по username
export async function getDialogHistoryByUsername(username: string, limit: number = 20) {
  try {
    return await prisma.dialogHistory.findMany({
      where: { username },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('Ошибка при получении истории диалога по username:', error);
    return [];
  }
}