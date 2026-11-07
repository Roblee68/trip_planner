import { countryCurrency, currencyCodes } from './currencyData.ts';

export function currencyForCountry(isoCountryCode: string | null | undefined): string | undefined {
  return isoCountryCode ? countryCurrency[isoCountryCode.toUpperCase()] : undefined;
}

export function currencyName(code: string, locale?: string): string {
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'currency' }).of(code) || code;
  } catch {
    return code;
  }
}

const popular = ['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'INR', 'AUD', 'NZD', 'CHF', 'CNY', 'MXN'];

export function currencyOptions(query: string, selected: string, suggested?: string): string[] {
  const text = query.trim().toLocaleLowerCase();
  const all = [...new Set([selected, suggested, ...popular, ...currencyCodes].filter((code): code is string => !!code))];
  return (text ? all.filter(code => code.toLocaleLowerCase().includes(text) || currencyName(code).toLocaleLowerCase().includes(text)) : all)
    .slice(0, text ? 25 : 12);
}
