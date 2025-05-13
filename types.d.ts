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
