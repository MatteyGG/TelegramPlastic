// src/lib/tokenTracker.ts

import { mainLogger } from "../modules/logger";
import { CostTracking, TokenUsage } from "../types";

// Тарифы Yandex GPT (актуальные на 25.09.2025)
const PRICING = {
  'yandexgpt-lite': {
    input: 0.20 / 1000, // 0.20 рубля за 1000 токенов в синхронном режиме
    output: 0.20 / 1000,
    asyncInput: 0.10 / 1000, // 0.10 рубля за 1000 токенов в асинхронном режиме
    asyncOutput: 0.10 / 1000,
  },
  'yandexgpt-pro': {
    input: 1.20 / 1000, // Для версий 5 и младше
    output: 1.20 / 1000,
    asyncInput: 0.60 / 1000,
    asyncOutput: 0.60 / 1000,
  },
  'yandexgpt-pro-5.1': {
    input: 0.40 / 1000, // С учетом скидки 50%
    output: 0.40 / 1000,
    asyncInput: 0.20 / 1000, // С учетом скидки 50%
    asyncOutput: 0.20 / 1000,
  },
  'llama-8b': {
    input: 0.20 / 1000,
    output: 0.20 / 1000,
    asyncInput: 0.10 / 1000,
    asyncOutput: 0.10 / 1000,
  },
  'llama-70b': {
    input: 1.20 / 1000,
    output: 1.20 / 1000,
    asyncInput: 0.60 / 1000,
    asyncOutput: 0.60 / 1000,
  }
};

export class TokenTracker {
  private static instance: TokenTracker;
  private totalCost: number = 0;
  private dailyUsage: Map<string, number> = new Map();
  private userUsage: Map<string, number> = new Map();

  static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string = "yandexgpt-lite"
  ): number {
    const pricing =
      PRICING[model as keyof typeof PRICING] || PRICING["yandexgpt-lite"];

    const inputCost = promptTokens * pricing.input;
    const outputCost = completionTokens * pricing.output;

    return inputCost + outputCost;
  }

  trackUsage(usage: TokenUsage): void {
    // Обновляем общую стоимость
    this.totalCost += usage.cost;

    // Ежедневное использование
    const today = new Date().toISOString().split("T")[0];
    const dailyTotal = this.dailyUsage.get(today) || 0;
    this.dailyUsage.set(today, dailyTotal + usage.cost);

    // Использование по пользователям
    if (usage.userId) {
      const userTotal = this.userUsage.get(usage.userId) || 0;
      this.userUsage.set(usage.userId, userTotal + usage.cost);
    }


    // Детальное логирование
    mainLogger.info(
      {
        userId: usage.userId,
        chatId: usage.chatId,
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        cost: usage.cost.toFixed(6),
        totalCost: this.totalCost.toFixed(2),
        timestamp: usage.timestamp,
      },
      "🔢 Token Usage" // The message is the second argument
    );
  }

  updateChatId(oldChatId: string, newChatId: string): void {
    // Обновляем ежедневную статистику
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${today}_${oldChatId}`;
    const dailyValue = this.dailyUsage.get(dailyKey);
    
    if (dailyValue) {
      this.dailyUsage.delete(dailyKey);
      this.dailyUsage.set(`${today}_${newChatId}`, dailyValue);
    }
    
    // Можно добавить аналогичную логику для userUsage при необходимости
  }

  getStats(): CostTracking {
    const dailyUsageObj: { [date: string]: number } = {};
    this.dailyUsage.forEach((value, key) => {
      dailyUsageObj[key] = value;
    });

    const userUsageObj: { [userId: string]: number } = {};
    this.userUsage.forEach((value, key) => {
      userUsageObj[key] = value;
    });

    return {
      totalCost: this.totalCost,
      totalTokens: Array.from(this.userUsage.values()).reduce(
        (a, b) => a + b,
        0
      ),
      dailyUsage: dailyUsageObj,
      userUsage: userUsageObj,
    };
  }
   getModelPricing(model: string): { input: number; output: number } {
    return PRICING[model as keyof typeof PRICING] || PRICING["yandexgpt-lite"];
  }

  // Метод для сброса статистики (можно вызывать периодически)
  resetStats(): void {
    this.totalCost = 0;
    this.dailyUsage.clear();
    this.userUsage.clear();
    mainLogger.info("📊 Token statistics reset");
  }
}

