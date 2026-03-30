export const CATEGORY_NAME_MAX_LENGTH = 64;

export type CategoryNameValidationError = 'empty' | 'too_long' | 'duplicate';

export interface CategoryNameValidationResult {
  normalizedName: string;
  error: CategoryNameValidationError | null;
}

export class CategoryNameValidationException extends Error {
  readonly code: CategoryNameValidationError;

  constructor(code: CategoryNameValidationError) {
    super(code);
    this.name = 'CategoryNameValidationException';
    this.code = code;
  }
}

export function normalizeCategoryName(name: string): string {
  return name.trim();
}

export function normalizeCategoryNameKey(name: string): string {
  return normalizeCategoryName(name).toLocaleLowerCase();
}

export function validateCategoryName(
  candidateName: string,
  existingNames: readonly string[],
  options?: { excludeName?: string | null }
): CategoryNameValidationResult {
  const normalizedName = normalizeCategoryName(candidateName);
  if (!normalizedName) {
    return { normalizedName, error: 'empty' };
  }

  if (normalizedName.length > CATEGORY_NAME_MAX_LENGTH) {
    return { normalizedName, error: 'too_long' };
  }

  const candidateKey = normalizeCategoryNameKey(normalizedName);
  const excludedKey = options?.excludeName
    ? normalizeCategoryNameKey(options.excludeName)
    : null;

  const duplicateFound = existingNames.some((existingName) => {
    const existingKey = normalizeCategoryNameKey(existingName);
    if (excludedKey && existingKey === excludedKey) {
      return false;
    }
    return existingKey === candidateKey;
  });

  if (duplicateFound) {
    return { normalizedName, error: 'duplicate' };
  }

  return { normalizedName, error: null };
}

export function categoryNameValidationErrorToI18nKey(
  error: CategoryNameValidationError
): string {
  switch (error) {
    case 'empty':
      return 'CATEGORY_VALIDATION.EMPTY';
    case 'duplicate':
      return 'CATEGORY_VALIDATION.DUPLICATE';
    case 'too_long':
      return 'CATEGORY_VALIDATION.TOO_LONG';
    default:
      return 'CATEGORY_VALIDATION.EMPTY';
  }
}
