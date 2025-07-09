"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatCache = exports.ChatCache = exports.caches = void 0;
exports.getCacheResponse = getCacheResponse;
exports.setCacheResponse = setCacheResponse;
exports.getCacheStats = getCacheStats;
var lru_cache_1 = require("lru-cache");
var MAX_HISTORY_LENGTH = 6; // Сохраняем последние 3 пары вопрос-ответ
var CACHE_CONFIG = {
    FAQ: {
        max: 50, // 50 последних FAQ-ответов
        ttl: 3600 * 1000 * 2, // 2 часа
    },
    SEARCH: {
        max: 100, // 100 поисковых запросов
        ttl: 3600 * 1000, // 1 час
    },
    GENERAL: {
        max: 30, // 30 общих ответов
        ttl: 3600 * 1000 * 24, // 24 часа
    }
};
// Создаем отдельные кэши
exports.caches = {
    faq: new lru_cache_1.LRUCache(CACHE_CONFIG.FAQ),
    search: new lru_cache_1.LRUCache(CACHE_CONFIG.SEARCH),
    general: new lru_cache_1.LRUCache(CACHE_CONFIG.GENERAL),
};
function getCacheResponse(module, question) {
    var _a;
    return ((_a = exports.caches[module].get(question.toLowerCase())) === null || _a === void 0 ? void 0 : _a.answer) || null;
}
function setCacheResponse(module, question, answer) {
    exports.caches[module].set(question.toLowerCase(), {
        answer: answer,
        timestamp: Date.now(),
    });
}
// Для админ-панели (опционально)
function getCacheStats() {
    return {
        faq: exports.caches.faq.size,
        search: exports.caches.search.size,
        general: exports.caches.general.size,
        clientDialogCache: exports.chatCache.size,
        total: exports.caches.faq.size + exports.caches.search.size + exports.caches.general.size
    };
}
var ChatCache = /** @class */ (function () {
    function ChatCache() {
        this.cache = new lru_cache_1.LRUCache({
            max: 1000,
            ttl: 3600 * 1000,
        });
    }
    ChatCache.prototype.getOrCreate = function (chatId) {
        if (!this.cache.has(chatId)) {
            this.cache.set(chatId, {
                history: [],
                isRelevant: false,
            });
        }
        return this.cache.get(chatId);
    };
    ChatCache.prototype.update = function (chatId, context) {
        this.cache.set(chatId, context);
    };
    ChatCache.prototype.updateHistory = function (chatId, message) {
        var context = this.getOrCreate(chatId);
        context.history.push(message);
        if (context.history.length > MAX_HISTORY_LENGTH * 2) {
            context.history = context.history.slice(-MAX_HISTORY_LENGTH * 2);
        }
        this.cache.set(chatId, context);
        return context;
    };
    Object.defineProperty(ChatCache.prototype, "size", {
        get: function () {
            return this.cache.size;
        },
        enumerable: false,
        configurable: true
    });
    return ChatCache;
}());
exports.ChatCache = ChatCache;
exports.chatCache = new ChatCache();
