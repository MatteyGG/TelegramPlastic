"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProducts = void 0;
var normalizeString_1 = require("../lib/normalizeString");
var logger_1 = require("./logger");
/**
 * Поиск пластиков с учетом нечеткого соответствия
 * @param {string} query Поисковый запрос
 * @param {SearchProduct[]} products Продукты для поиска
 * @param {number} threshold Порог сходства (по умолчанию 0.5)
 * @returns {SearchProduct[]} Продукты, соответствующие запросу
 */
var searchProducts = function (query, products, threshold) {
    if (threshold === void 0) { threshold = 0.5; }
    // Нормализация запроса
    var normalizedQuery = (0, normalizeString_1.normalizeString)(query);
    var queryWords = normalizedQuery.split(' ');
    logger_1.mainLogger.debug("searchProducts: queryWords=".concat(queryWords));
    // Фильтрация продуктов, которые соответствуют запросу
    return products.filter(function (product) {
        var matchScore = queryWords.reduce(function (score, qWord) {
            var dynamicThreshold = qWord.length < 4 ? 0.3 : 0.5;
            var distanceLimit = Math.floor(qWord.length * dynamicThreshold);
            var wordMatch = product.searchKeywords.some(function (keyword) {
                var distance = levenshteinDistance(qWord, keyword);
                return distance <= distanceLimit;
            });
            return score + (wordMatch ? 1 : 0);
        }, 0);
        logger_1.mainLogger.debug("searchProducts: matchScore=".concat(matchScore));
        return matchScore >= queryWords.length * 0.7;
    });
};
exports.searchProducts = searchProducts;
// Алгоритм Левенштейна
var levenshteinDistance = function (a, b) {
    var matrix = [];
    for (var i = 0; i <= b.length; i++)
        matrix[i] = [i];
    for (var j = 0; j <= a.length; j++)
        matrix[0][j] = j;
    for (var i = 1; i <= b.length; i++) {
        for (var j = 1; j <= a.length; j++) {
            var cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[b.length][a.length];
};
