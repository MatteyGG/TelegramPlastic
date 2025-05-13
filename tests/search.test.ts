import { searchFAQ, initSearch } from '../modules/search';
import { loadConfig } from '../modules/getConfig';
import mockFs from 'mock-fs';
import path from 'path';
import { caches } from '../modules/cache';

describe('searchFAQ: Search Module ', () => {
    beforeEach(async () => {
        mockFs({
            [path.join(__dirname, '../config')]: {
                'faq.json': JSON.stringify({
                    FAQ: [
                        { keywords: ['3d printing'], answer: '3D printing answer' },
                        { keywords: ['filament'], answer: 'Filament answer' }
                    ]
                }),
                'materials.json': JSON.stringify({
                    materials: {
                        PLA: { links: ['test-link'] }
                    }
                }),
                'responses.json': JSON.stringify({ test: 'test' }),
                'prompt.json': JSON.stringify({ system_prompt: 'System Prompt' })
            }
        });

        await loadConfig(true);
        await initSearch();
    });

    afterEach(() => {
        mockFs.restore();
    });

    it('Инициализация индекса поиска происходит корректно', () => {
        expect(searchFAQ).toBeDefined();
    });

    it('Находит точное совпадение в FAQ', async () => {
        const result = await searchFAQ('filament');
        expect(result).toBe('Filament answer');
    });

    it('Обрабатывает опечатки с расстоянием редактирования', async () => {
        const result = await searchFAQ('filamnt');
        expect(result).toBe('Filament answer');
    });

    it('Возвращает null для неизвестных запросов', async () => {
        const result = await searchFAQ('unknown query');
        expect(result).toBeNull();
    });

});
