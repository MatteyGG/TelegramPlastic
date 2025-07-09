"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeString = void 0;
// Утилиты для нормализации текста
var normalizeString = function (str) {
    return str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s+-]/g, ' ')
        .replace(/\b(пластик|rec|пласт)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
};
exports.normalizeString = normalizeString;
