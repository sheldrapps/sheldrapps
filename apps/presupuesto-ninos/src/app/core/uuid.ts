export const createUuid = (): string => {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${now}-${rand}`;
};