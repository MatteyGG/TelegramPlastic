import { loadConfig, getResponse, getFAQ, getMaterial, getSystemPrompt } from '../modules/getConfig';
import mockFs from 'mock-fs';
import path from 'path';

describe('loadConfig - успешная загрузка', () => {
  beforeEach(() => {
    // Создаем виртуальную файловую систему с тестовыми файлами
    mockFs({
      [path.join(__dirname, '../config')]: {
        'faq.json': JSON.stringify({ FAQ: [{ keywords: ['test'], answer: 'Test Answer' }] }),
        'materials.json': JSON.stringify({ materials: { PLA: { links: ['test-link'] } } }),
        'responses.json': JSON.stringify({ test: 'test' }),
        'prompt.json': JSON.stringify({ system_prompt: 'System Prompt' }),
      },
    });
  });

  afterEach(() => {
    mockFs.restore(); // Восстанавливаем оригинальную файловую систему
  });

  it('должен загружать конфигурацию без ошибок', async () => {
    await expect(loadConfig()).resolves.not.toThrow();
  });
});


describe('Геттеры после успешной загрузки конфига', () => {
  beforeEach(async () => {
    // Создаем виртуальную файловую систему с тестовыми данными
    mockFs({
      [path.join(__dirname, '../config')]: {
        // faq.json
        'faq.json': JSON.stringify({
          FAQ: [
            { keywords: ['help'], answer: 'Answer for help' },
            { keywords: ['faq'], answer: 'FAQ Answer' },
          ],
        }),
        // materials.json
        'materials.json': JSON.stringify({
          materials: {
            PLA: { links: ['https://plastic.com/pla '] },
            PETG: { links: ['https://plastic.com/petg '] },
          },
        }),
        // responses.json
        'responses.json': JSON.stringify({
          test: 'test',
          hello: 'world',
        }),
        // prompt.json
        'prompt.json': JSON.stringify({
          system_prompt: 'System Prompt',
        }),
      },
    });

    // Загружаем конфиг перед каждым тестом
    await loadConfig(true);
  });

  afterEach(() => {
    mockFs.restore(); // Восстанавливаем оригинальную файловую систему
  });

  it('getResponse возвращает значение по ключу', () => {
    expect(getResponse('test')).toBe('test'); // Существующий ключ
    expect(getResponse('hello')).toBe('world'); // Другой существующий ключ
    expect(getResponse('unknown')).toBe('Ответ не найден'); // Несуществующий ключ
  });

  it('getFAQ возвращает список FAQ', () => {
    const faq = getFAQ();
    expect(faq).toHaveLength(2); // Проверка количества элементов
    expect(faq[0]).toEqual({ keywords: ['help'], answer: 'Answer for help' }); // Проверка структуры
  });

  it('getMaterial возвращает ссылки для материала', () => {
    expect(getMaterial('PLA')).toEqual(['https://plastic.com/pla ']); // Существующий материал
    expect(getMaterial('petg')).toEqual(['https://plastic.com/petg ']); // Регистр не важен
    expect(getMaterial('invalid')).toEqual([]); // Несуществующий материал
  });

  it('getSystemPrompt возвращает системный промпт', () => {
    expect(getSystemPrompt()).toBe('System Prompt'); // Проверка значения
  });
});