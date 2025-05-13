import { caches, getCacheResponse, setCacheResponse } from '../modules/cache';

describe('Модуль кэша', () => {
  beforeEach(() => {
    // Очищаем все кэши перед каждым тестом
    caches.faq.clear();
    caches.search.clear();
    caches.general.clear();
  });

  it('должен хранить и извлекать значения из кэша', () => {
    setCacheResponse('faq', 'test', 'answer');
    expect(getCacheResponse('faq', 'test')).toBe('answer');
  });

  it('должен обрабатывать регистронезависимость', () => {
    setCacheResponse('faq', 'TEST', 'answer');
    expect(getCacheResponse('faq', 'test')).toBe('answer');
  });

  it('должен уважать TTL', async () => {
    setCacheResponse('search', 'query', 'result');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(getCacheResponse('search', 'query')).toBe('result');
  });

  it('должен очищать старые записи', () => {
    // Заполнить кэш сверх лимита
    for (let i = 0; i < 60; i++) {
      setCacheResponse('faq', `q${i}`, `a${i}`);
    }
    expect(caches.faq.size).toBe(50);
  });
});
