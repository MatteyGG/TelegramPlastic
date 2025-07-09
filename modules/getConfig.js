"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_PATH = void 0;
exports.loadConfig = loadConfig;
exports.getResponse = getResponse;
exports.getFAQ = getFAQ;
exports.getMaterial = getMaterial;
exports.getSystemPrompt = getSystemPrompt;
exports.getProducts = getProducts;
var promises_1 = require("fs/promises");
var path_1 = require("path");
var logger_1 = require("./logger");
var normalizeString_1 = require("../lib/normalizeString");
var config = {};
var isConfigLoaded = false;
exports.CONFIG_PATH = path_1.default.join(__dirname, '../config');
// Универсальный загрузчик конфигов
function loadConfigFile(fileName) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, filePath, content;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    logger_1.mainLogger.info("CONFIG_PATH: ".concat(exports.CONFIG_PATH)); // Проверит реальный путь
                    _b = (_a = logger_1.mainLogger).info;
                    _c = "Files in config dir: ".concat;
                    return [4 /*yield*/, promises_1.default.readdir(exports.CONFIG_PATH)];
                case 1:
                    _b.apply(_a, [_c.apply("Files in config dir: ", [_d.sent()])]); // Список файлов
                    filePath = path_1.default.join(exports.CONFIG_PATH, "".concat(fileName, ".json"));
                    return [4 /*yield*/, promises_1.default.readFile(filePath, 'utf8')];
                case 2:
                    content = _d.sent();
                    return [2 /*return*/, JSON.parse(content)];
            }
        });
    });
}
// Основная функция загрузки
function loadConfig() {
    return __awaiter(this, arguments, void 0, function (force) {
        var _a, faq, materials, responses, prompt_1, products, error_1;
        if (force === void 0) { force = false; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (isConfigLoaded && !force)
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all([
                            loadConfigFile('faq').then(function (r) { return r.FAQ; }),
                            loadConfigFile('materials'),
                            loadConfigFile('responses'),
                            loadConfigFile('prompt'),
                            loadConfigFile('products'),
                        ])];
                case 2:
                    _a = _b.sent(), faq = _a[0], materials = _a[1], responses = _a[2], prompt_1 = _a[3], products = _a[4];
                    config = {
                        faq: faq,
                        materials: materials.materials,
                        responses: responses,
                        prompt: prompt_1,
                        products: products.products
                    };
                    isConfigLoaded = true;
                    logger_1.mainLogger.info('✅ Конфигурация успешно загружена');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    logger_1.mainLogger.error('🚨 Ошибка загрузки конфигурации:', error_1);
                    throw new Error('Failed to load configs');
                case 4: return [2 /*return*/];
            }
        });
    });
}
// геттеры
function getResponse(key) {
    var _a;
    return ((_a = config.responses) === null || _a === void 0 ? void 0 : _a[key]) || 'Ответ не найден';
}
function getFAQ() {
    return config.faq || [];
}
function getMaterial(name) {
    var _a, _b;
    return ((_b = (_a = config.materials) === null || _a === void 0 ? void 0 : _a[name.toUpperCase()]) === null || _b === void 0 ? void 0 : _b.links) || [];
}
function getSystemPrompt() {
    if (!config.prompt) {
        throw new Error("Конфиг prompt не загружен!");
    }
    return config.prompt.system_prompt;
}
function getProducts() {
    return config.products.map(function (product) { return (__assign(__assign({}, product), { searchKeywords: (0, normalizeString_1.normalizeString)(product.title).split(' ') })); });
}
