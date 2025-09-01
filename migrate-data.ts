import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function migrateData() {
  // Мигрируем материалы
  const materials = JSON.parse(await fs.readFile('./config/materials.json', 'utf-8'));
  for (const [name, data] of Object.entries(materials.materials)) {
    await prisma.material.create({
      data: {
        name,
        links: JSON.stringify(data.links)
      }
    });
  }

  // Мигрируем продукты
  const products = JSON.parse(await fs.readFile('./config/products.json', 'utf-8'));
  for (const product of products.products) {
    await prisma.product.create({
      data: {
        title: product.title,
        material: product.material,
        diameters: JSON.stringify(product.diameters),
        colors: JSON.stringify(product.colors),
        links: JSON.stringify(product.links),
        weight: product.weight,
        description: product.description
      }
    });
  }

  // Мигрируем FAQ
  const faq = JSON.parse(await fs.readFile('./config/faq.json', 'utf-8'));
  for (const item of faq.FAQ) {
    await prisma.fAQ.create({
      data: {
        keywords: JSON.stringify(item.keywords),
        answer: item.answer
      }
    });
  }

  // Мигрируем responses
  const responses = JSON.parse(await fs.readFile('./config/responses.json', 'utf-8'));
  for (const [key, value] of Object.entries(responses)) {
    await prisma.response.create({
      data: {
        key,
        value: String(value)
      }
    });
  }

  // Мигрируем prompt
  const prompt = JSON.parse(await fs.readFile('./config/prompt.json', 'utf-8'));
  await prisma.prompt.create({
    data: {
      key: 'system_prompt',
      value: prompt.system_prompt
    }
  });
}

migrateData()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });