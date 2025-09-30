/// <reference types="node" />

type FAQItem = {
  keywords: string[];
  answer: string;
};

type Material = {
  links: string[];
};

export interface Config {
  faq: Array<{ keywords: string[]; answer: string }>;
  materials: Record<string, { links: string[] }>;
  responses: Record<string, string>;
  prompt: { system_prompt: string };
}

export interface Product {
  id: number; 
  title: string;
  material: string;
  diameters: string[];
  colors: string[];
  links: string[];
  weight: string;
  description: string;
}

interface SearchProduct extends Product {
  searchKeywords: string[];
}

// tokens.ts
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
  model: string;
  userId?: string;
  chatId: string;
}

export interface CostTracking {
  totalCost: number;
  totalTokens: number;
  dailyUsage: { [date: string]: number };
  userUsage: { [userId: string]: number };
}