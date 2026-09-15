/** Indian mobile numbers: exactly 10 digits, first digit 6-9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Strip spaces, dashes, +91 / 0 prefixes, then check. Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  const trimmed = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith("0") && digits.length === 11
      ? digits.slice(1)
      : digits;

  return INDIAN_MOBILE.test(trimmed) ? trimmed : null;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** 9876543210 -> "98765 43210", the way it is read aloud. */
export function formatPhone(phone: string): string {
  return phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}
