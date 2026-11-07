import { readFileSync, writeFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../node_modules/cldr-core/supplemental/currencyData.json', import.meta.url), 'utf8'));
const regions = source.supplemental.currencyData.region;
const map = {};
for (const [country, histories] of Object.entries(regions)) {
  if (!/^[A-Z]{2}$/.test(country)) continue;
  const current = histories.flatMap(entry => Object.entries(entry))
    .filter(([code, period]) => /^[A-Z]{3}$/.test(code) && !period._to && period._tender !== 'false');
  if (current.length) map[country] = current.at(-1)[0];
}
const currencies = [...new Set(Object.values(map))].sort();
const content = `// Generated from Unicode CLDR ${source.supplemental.version._cldrVersion} currencyData.\n` +
  `// Country codes and currency codes remain stable storage values; display names are localized separately.\n` +
  `export const countryCurrency: Record<string, string> = ${JSON.stringify(map, null, 2)};\n` +
  `export const currencyCodes = ${JSON.stringify(currencies)} as const;\n`;
writeFileSync(new URL('../src/currencyData.ts', import.meta.url), content);
