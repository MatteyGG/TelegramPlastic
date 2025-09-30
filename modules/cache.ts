import { LRUCache } from "lru-cache";
import { Product } from "../types";
import { saveDialogMessage } from "./dialogHistory"; // Импортируем функцию сохранения

const MAX_HISTORY_LENGTH = 6;

type CacheEntry = {
  answer: string;
  timestamp: number;
};

const CACHE_CONFIG = {
  FAQ: {
    max: 50,
    ttl: 3600 * 1000 * 2,
  },
  SEARCH: {
    max: 100,
    ttl: 3600 * 1000,
  },
  GENERAL: {
    max: 30,
    ttl: 3600 * 1000 * 24,
  }
};

export const caches = {
  faq: new LRUCache<string, CacheEntry>(CACHE_CONFIG.FAQ),
  search: new LRUCache<string, CacheEntry>(CACHE_CONFIG.SEARCH),
  general: new LRUCache<string, CacheEntry>(CACHE_CONFIG.GENERAL),
};

export function getCacheResponse(module: keyof typeof caches, question: string): string | null {
  return caches[module].get(question.toLowerCase())?.answer || null;
}

export function setCacheResponse(
  module: keyof typeof caches,
  question: string,
  answer: string
): void {
  caches[module].set(question.toLowerCase(), {
    answer,
    timestamp: Date.now(),
  });
}

export function getCacheStats() {
  return {
    faq: caches.faq.size,
    search: caches.search.size,
    general: caches.general.size,
    clientDialogCache: chatCache.size,
    total: caches.faq.size + caches.search.size + caches.general.size
  };
}

export type ChatContext = {
  aiRecommendation: string | undefined;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  isRelevant: boolean;
  waitingForProductSelection?: boolean;
  candidateProducts?: Product[];
  pendingMessage?: string;
  selectedProducts?: Product[];
  username?: string; 
};
export class ChatCache {
  private cache: LRUCache<string, ChatContext>;
  
  constructor() {
    this.cache = new LRUCache<string, ChatContext>({
      max: 1000,
      ttl: 3600 * 1000,
      dispose: async (value, key, reason) => {
        if (reason === 'evict' || reason === 'delete') {
          await this.saveHistoryToDB(key, value);
        }
      }
    });
  }

  getOrCreate(chatId: string): ChatContext {
    if (!this.cache.has(chatId)) {
      this.cache.set(chatId, {
        history: [],
        isRelevant: false,
        aiRecommendation: undefined
      });
    }
    return this.cache.get(chatId)!;
  }

  update(chatId: string, context: ChatContext) {
    this.cache.set(chatId, context);
  }

  updateHistory(chatId: string, message: { role: "user" | "assistant"; content: string }): ChatContext {
    const context = this.getOrCreate(chatId);
    context.history.push(message);
    
    if (context.history.length > MAX_HISTORY_LENGTH * 2) {
      context.history = context.history.slice(-MAX_HISTORY_LENGTH * 2);
    }
    
    this.cache.set(chatId, context);
    return context;
  }

  // Метод для сохранения истории в БД
private async saveHistoryToDB(chatId: string, context: ChatContext) {
  try {
    // Сохраняем все сообщения из истории
    for (const message of context.history) {
      await saveDialogMessage(chatId, {
        role: message.role,
        message: message.content,
        products: context.selectedProducts,
        username: context.username // Передаем username
      });
    }
    
    console.log(`История диалога ${chatId} сохранена в БД`);
  } catch (error) {
    console.error('Ошибка при сохранении истории диалога в БД:', error);
  }
}

  // Метод для принудительного сохранения истории
  async forceSave(chatId: string) {
    const context = this.cache.get(chatId);
    if (context) {
      await this.saveHistoryToDB(chatId, context);
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

export const chatCache = new ChatCache();