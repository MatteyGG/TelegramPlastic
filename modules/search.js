"use strict";
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
exports.initSearch = initSearch;
exports.searchFAQ = searchFAQ;
var lunr_1 = require("lunr");
var getConfig_1 = require("./getConfig");
var cache_1 = require("./cache");
var searchIndex;
var faqData = [];
function initSearch() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!faqData.length) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, getConfig_1.loadConfig)()];
                case 1:
                    _a.sent();
                    faqData = (0, getConfig_1.getFAQ)();
                    _a.label = 2;
                case 2:
                    searchIndex = (0, lunr_1.default)(function () {
                        var _this = this;
                        this.ref("id");
                        this.field("keywords", { boost: 10 });
                        this.field("answer");
                        faqData.forEach(function (item, id) {
                            _this.add({
                                id: id.toString(),
                                keywords: item.keywords.join(" "),
                                answer: item.answer
                            });
                        });
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function searchFAQ(query) {
    return __awaiter(this, void 0, void 0, function () {
        var lowerQ, cached, results, answer;
        return __generator(this, function (_a) {
            lowerQ = query.toLowerCase();
            cached = cache_1.caches.search.get(lowerQ);
            if (cached)
                return [2 /*return*/, cached.answer];
            results = searchIndex.query(function (q) {
                q.term(query.toLowerCase(), {
                    fields: ["keywords"],
                    editDistance: 3,
                    wildcard: lunr_1.default.Query.wildcard.TRAILING
                });
            });
            if (results.length > 0) {
                answer = faqData[parseInt(results[0].ref)].answer;
                // Сохраняем в кэш поиска
                cache_1.caches.search.set(lowerQ, {
                    answer: answer,
                    timestamp: Date.now()
                });
                return [2 /*return*/, answer];
            }
            return [2 /*return*/, null];
        });
    });
}
