import { Product } from "../types";
import { mainLogger } from "./logger";

export class ProductSearch {
  private static instance: ProductSearch;

  private constructor() {}

  public static getInstance(): ProductSearch {
    if (!ProductSearch.instance) {
      ProductSearch.instance = new ProductSearch();
    }
    return ProductSearch.instance;
  }

  public findProductsByMaterials(recommendedMaterials: string[], products: Product[]): Product[] {
    return products.filter((product: Product) => {
      const productMaterial = product.material.toUpperCase();
      
      return recommendedMaterials.some(material => 
        productMaterial === material || 
        productMaterial === material + '-G' // Для PET-G
      );
    });
  }

  public findDirectProductMatch(userMessage: string, products: Product[]): Product[] {
    const normalizedQuery = userMessage.toLowerCase();
    
    return products.filter(product => {
      const productName = product.title.toLowerCase();
      const productMaterial = product.material.toLowerCase();
      
      // Проверяем прямое упоминание продукта в запросе
      return normalizedQuery.includes(productName) || 
             normalizedQuery.includes(productMaterial) ||
             this.checkProductAliases(normalizedQuery, product);
    });
  }

  private checkProductAliases(query: string, product: Product): boolean {
    // Здесь можно добавить логику для проверки алиасов продуктов
    // Например, "REC PEt-g" -> "PET-G", "PETG" и т.д.
    const aliases: Record<string, string[]> = {
      'pet-g': ['petg', 'pet-g', 'rec pet-g', 'rec petg'],
      'pla': ['pla', 'rec pla'],
      'abs': ['abs', 'rec abs'],
      'tpu': ['tpu', 'rec tpu'],
    };

    const material = product.material.toLowerCase();
    if (aliases[material]) {
      return aliases[material].some(alias => query.includes(alias));
    }

    return false;
  }
}