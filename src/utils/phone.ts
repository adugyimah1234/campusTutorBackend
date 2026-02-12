export const normalizeGhanaPhone = (value: string) => value.replace(/\D/g, "");

export const isValidGhanaPhone = (value: string) => {
  const digits = normalizeGhanaPhone(value);
  if (digits.length === 10 && digits.startsWith("0")) return true;
  if (digits.length === 12 && digits.startsWith("233")) return true;
  return false;
};
