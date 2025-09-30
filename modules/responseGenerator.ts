import OpenAI from "openai";
import dotenv from "dotenv";
import { Product } from "../types";
import { TokenTracker } from "../lib/tokenTracker";

dotenv.config();

const token = process.env["YANDEX_TOKEN"];
const endpoint = process.env["YANDEX_ENDPOINT"];
const FINAL_ANSWER_MODEL = "gpt://b1gqrnacgsktinq6ags3/yandexgpt-lite";
const MAX_HISTORY_LENGTH = 6;

const client = new OpenAI({ apiKey: token, baseURL: endpoint });
const tokenTracker = TokenTracker.getInstance();

export class ResponseGenerator {
  private static instance: ResponseGenerator;

  private constructor() {}

  public static getInstance(): ResponseGenerator {
    if (!ResponseGenerator.instance) {
      ResponseGenerator.instance = new ResponseGenerator();
    }
    return ResponseGenerator.instance;
  }

  public async generateFinalResponse(
    userMessage: string,
    recommendedMaterials: string,
    foundProducts: Product[],
    systemPrompt: string,
    history: any[]
  ): Promise<string> {
    const productDescription = this.createProductDescription(foundProducts);
    const strictInstructions = this.createStrictProductInstructions();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { 
        role: "system", 
        content: `${systemPrompt}\n\n${productDescription}\n\n${strictInstructions}` 
      },
      ...history.slice(-MAX_HISTORY_LENGTH),
      { 
        role: "user", 
        content: `Рекомендованные материалы: ${recommendedMaterials}. Задача: ${userMessage}` 
      },
    ];

    const response = await client.chat.completions.create({
      messages: messages,
      temperature: 0.4,
      model: FINAL_ANSWER_MODEL,
    });

    // Логирование токенов
    if (response.usage) {
      const cost = tokenTracker.calculateCost(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        FINAL_ANSWER_MODEL
      );
      tokenTracker.trackUsage({
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        cost,
        timestamp: new Date(),
        model: FINAL_ANSWER_MODEL,
        chatId: "final_request",
      });
    }

    return response.choices[0].message.content?.replace(/[*#]/g, "") || "";
  }

  public createProductLinks(products: Product[]): string {
    if (products.length === 0) return "";

    let message = "\n\n🔗 **Ссылки на продукты:**";
    
    products.forEach((product) => {
      if (product.links.length > 0) {
        message += `\n• ${product.title}: ${product.links[0]}`;
      }
    });
    
    return message;
  }

  private createProductDescription(products: Product[]): string {
    if (products.length === 0) return "";

    return "\n=== КОНКРЕТНЫЕ ПРОДУКТЫ ДЛЯ РЕКОМЕНДАЦИИ ===\n" +
      products
        .map((product, index) => {
          return `ПРОДУКТ ${index + 1}:
🎯 Название: ${product.title}
🧪 Материал: ${product.material}
📝 Описание: ${product.description}`;
        })
        .join("\n\n");
  }

  private createStrictProductInstructions(): string {
    return `
КРИТИЧЕСКИ ВАЖНЫЕ ИНСТРУКЦИИ:
1. ВАША ГЛАВНАЯ ЗАДАЧА - РЕКОМЕНДОВАТЬ КОНКРЕТНЫЕ ПРОДУКТЫ ИЗ СПИСКА ВЫШЕ
2. ОБЯЗАТЕЛЬНО упоминайте в ответе КАЖДЫЙ из найденных продуктов
3. Используйте конкретные характеристики продуктов из описания
4. Ссылайтесь на преимущества КОНКРЕТНЫХ продуктов из описания
5. НЕ добавляйте ссылки на продукты в своем ответе - они будут добавлены отдельно

СТРУКТУРА ОТВЕТА:
- Краткий анализ задачи пользователя
- Подробный обзор КАЖДОГО подходящего продукта
- Сравнение преимуществ конкретных продуктов
- Четкая рекомендация с обоснованием

НЕ ДОПУСКАЕТСЯ:
- Давать общие рекомендации без упоминания конкретных продуктов
- Игнорировать информацию о продуктах из списка
- Добавлять ссылки на продукты в текст ответа`;
  }
}