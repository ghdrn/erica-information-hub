export type InferredColumnType = 'text' | 'number' | 'date' | 'boolean';

const TRUE_VALUES = new Set(['true', 't', 'yes', 'y', '1', 'on', '예', '네', '참']);
const FALSE_VALUES = new Set(['false', 'f', 'no', 'n', '0', 'off', '아니오', '아니요', '거짓']);

function cleanValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function parseBooleanValue(value: unknown): boolean | null {
  const normalized = cleanValue(value).toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function parseNumberValue(value: unknown): number | null {
  let normalized = cleanValue(value);
  if (!normalized) return null;

  let negative = false;
  if (/^\(.*\)$/.test(normalized)) {
    negative = true;
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized
    .replace(/[,\s]/g, '')
    .replace(/^[₩$€£¥]/, '')
    .replace(/%$/, '');

  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parseDateValue(value: unknown): Date | null {
  const normalized = cleanValue(value);
  if (!normalized) return null;

  const dateOnlyPatterns: RegExp[] = [
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
    /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
    /^(\d{4})(\d{2})(\d{2})$/,
  ];

  for (const pattern of dateOnlyPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const [, year, month, day] = match;
    return buildDate(Number(year), Number(month), Number(day));
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const firstNum = Number(first);
    const secondNum = Number(second);
    const yearNum = Number(year);

    if (firstNum > 12) return buildDate(yearNum, secondNum, firstNum);
    return buildDate(yearNum, firstNum, secondNum);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function inferColumnType(values: unknown[]): InferredColumnType {
  const nonEmptyValues = values.map(cleanValue).filter(Boolean);
  if (nonEmptyValues.length === 0) return 'text';

  const ratio = (count: number) => count / nonEmptyValues.length;
  const booleanCount = nonEmptyValues.filter((value) => parseBooleanValue(value) !== null).length;
  const dateCount = nonEmptyValues.filter((value) => parseDateValue(value) !== null).length;
  const numberCount = nonEmptyValues.filter((value) => parseNumberValue(value) !== null).length;

  if (ratio(booleanCount) >= 0.9) return 'boolean';
  if (ratio(dateCount) >= 0.85) return 'date';
  if (ratio(numberCount) >= 0.85) return 'number';

  return 'text';
}
