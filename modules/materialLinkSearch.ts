import { getMaterial } from "./getConfig";

export interface MaterialMatch {
  name: string;
  links: string[];
}

export function findMaterialsInText(text: string): MaterialMatch[] {
  const matches = Array.from(
    new Set(text.match(/(ABS|PETG|PLA|TPU)/gi) || [])
  );

  return matches.map(material => ({
    name: material.toUpperCase(),
    links: getMaterial(material.toUpperCase())
  })).filter(m => m.links.length > 0);
}

export function formatMaterialLinks(materials: MaterialMatch[]): string {
  if (!materials.length) return '';

  return `\n\n🏷️ Где купить материалы:\n${
    materials.map(m => `• ${m.name}: ${m.links.join(", ")}`).join("\n")
  }`;
}