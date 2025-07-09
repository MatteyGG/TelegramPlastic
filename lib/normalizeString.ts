// Утилиты для нормализации текста
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s+-]/g, ' ')
    .replace(/\b(пластик|rec|пласт)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};
