import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneCountryOption = {
  code: string;
  label: string;
  maxLength: number;
};

export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: '+372', label: 'Estonia (+372)', maxLength: 8 },
  { code: '+371', label: 'Latvia (+371)', maxLength: 8 },
  { code: '+370', label: 'Lithuania (+370)', maxLength: 8 },
  { code: '+358', label: 'Finland (+358)', maxLength: 12 },
  { code: '+46', label: 'Sweden (+46)', maxLength: 9 },
  { code: '+49', label: 'Germany (+49)', maxLength: 11 },
  { code: '+44', label: 'United Kingdom (+44)', maxLength: 10 },
  { code: '+1', label: 'United States (+1)', maxLength: 10 },
];

export function sanitizePhoneLocalNumber(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildE164PhoneNumber(countryCode: string, localNumber: string): string | null {
  const sanitizedCountryCode = countryCode.startsWith('+')
    ? countryCode
    : `+${countryCode.replace(/\D/g, '')}`;
  const sanitizedLocalNumber = sanitizePhoneLocalNumber(localNumber).replace(/^0+/, '');
  const candidate = `${sanitizedCountryCode}${sanitizedLocalNumber}`;

  const phoneNumber = parsePhoneNumberFromString(candidate);
  if (!phoneNumber || !phoneNumber.isValid()) {
    return null;
  }

  return phoneNumber.number;
}
