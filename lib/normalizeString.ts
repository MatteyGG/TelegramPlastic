// В normalizeString.ts
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s+-]/g, ' ')
    .replace(/\b(пластик|rec|пласт|нить|филамент|материал)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};