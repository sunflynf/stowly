/** Accent-insensitive normalisation matching the database's normalize_search(). */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesText(haystack: string, needle: string): boolean {
  const n = normalizeText(needle);
  return n === "" || normalizeText(haystack).includes(n);
}
