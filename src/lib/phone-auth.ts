export type PhoneCountryOption = {
  code: string;
  label: string;
};

export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: '+372', label: 'Estonia (+372)' },
  { code: '+371', label: 'Latvia (+371)' },
  { code: '+370', label: 'Lithuania (+370)' },
  { code: '+358', label: 'Finland (+358)' },
  { code: '+46', label: 'Sweden (+46)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+1', label: 'United States (+1)' },
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

  if (!/^\+[1-9]\d{5,14}$/.test(candidate)) {
    return null;
  }

  return candidate;
}
