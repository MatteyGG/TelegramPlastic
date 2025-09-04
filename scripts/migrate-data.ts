import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function migrateData() {
  console.log('Начинаем миграцию данных...');

  try {

    // Мигрируем продукты
    const productsData = JSON.parse(await fs.readFile(path.join(__dirname, '../config/products.json'), 'utf-8'));
    console.log('Мигрируем продукты...');
    
    for (const product of productsData.products) {
      await prisma.product.create({
        data: {
          title: product.title,
          material: product.material,
          diameters: JSON.stringify(product.diameters || []),
          colors: JSON.stringify(product.colors || []),
          links: JSON.stringify(product.links || []),
          weight: product.weight || '',
          description: product.description || ''
        }
      });
    }

    // Мигрируем responses
    const responsesData = JSON.parse(await fs.readFile(path.join(__dirname, '../config/responses.json'), 'utf-8'));
    console.log('Мигрируем responses...');
    
    for (const [key, value] of Object.entries(responsesData)) {
      await prisma.response.create({
        data: {
          key,
          value: String(value)
        }
      });
    }

    // Мигрируем prompt
    const promptData = JSON.parse(await fs.readFile(path.join(__dirname, '../config/prompt.json'), 'utf-8'));
    console.log('Мигрируем prompt...');
    
    await prisma.prompt.create({
      data: {
        key: 'system_prompt',
        value: promptData.system_prompt
      }
    });

    console.log('✅ Миграция данных завершена успешно!');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();