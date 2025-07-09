import { getProducts } from "../modules/getConfig";
import { searchProducts } from "../modules/plasticInfoSearch";

export function searchByWord(userMessage: string): string {
  const products = getProducts();
  const foundProducts = searchProducts(userMessage, products);
  return foundProducts.map(product => 
    `${product.title} - ${product.material} - Диаметры нити: ${product.diameters.join(", ")} - ${product.colors.join(", ")} - ${product.links.join(", ")} - ${product.description}`
  ).join(", ");
}

console.log(searchByWord('пластик'));