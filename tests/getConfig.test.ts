import { loadConfig, getResponse, getFAQ, getMaterial, getSystemPrompt } from '../modules/getConfig';
import * as fs from 'fs/promises';

// Мокаем fs.readFile
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
}));

describe('Геттеры', () => {
    (async () => {
        await loadConfig(true);
    })();

    it('getResponse', () => {
        expect(getResponse('test')).toBe('test');
        expect(getResponse('unknown')).toBe('Ответ не найден');
    });

    it('getMaterial', () => {
        expect(getMaterial('PLA')).toEqual([
            'https://rec3d.ru/plastik-dlya-3d-printerov/all-plastic/?material[]=38',
        ]);
        expect(getMaterial('TPU')).toEqual([
            'https://rec3d.ru/plastik-dlya-3d-printerov/all-plastic/?material[]=43',
        ]);
        expect(getMaterial('invalid')).toEqual([]);
    });

    it('getSystemPrompt', () => {
        expect(getSystemPrompt()).not.toBeNull();
    });
});