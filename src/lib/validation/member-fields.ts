/** Shared client/server format checks for member fields. */
export const DNI_REGEX = /^[0-9]{8}[A-Za-z]$/;
export const NIE_REGEX = /^[XYZxyz][0-9]{7}[A-Za-z]$/;
export const POSTAL_CODE_REGEX = /^[0-9]{5}$/;
export const PHONE_REGEX = /^\+?[0-9\s().-]{6,20}$/;

export function isValidDniNie(value: string): boolean {
  return DNI_REGEX.test(value) || NIE_REGEX.test(value);
}

export function isValidPostalCode(value: string): boolean {
  return POSTAL_CODE_REGEX.test(value);
}

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value);
}
