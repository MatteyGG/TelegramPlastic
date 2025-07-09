"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchByWord = searchByWord;
var getConfig_1 = require("../modules/getConfig");
var plasticInfoSearch_1 = require("../modules/plasticInfoSearch");
function searchByWord(userMessage) {
    var products = (0, getConfig_1.getProducts)();
    var foundProducts = (0, plasticInfoSearch_1.searchProducts)(userMessage, products);
    return foundProducts.map(function (product) {
        return "".concat(product.title, " - ").concat(product.material, " - \u0414\u0438\u0430\u043C\u0435\u0442\u0440\u044B \u043D\u0438\u0442\u0438: ").concat(product.diameters.join(", "), " - ").concat(product.colors.join(", "), " - ").concat(product.links.join(", "), " - ").concat(product.description);
    }).join(", ");
}
console.log(searchByWord('пластик'));
