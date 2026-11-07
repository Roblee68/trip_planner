import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyForCountry, currencyOptions } from '../src/currencies.ts';
import { formatDistance, fromKilometres, toKilometres } from '../src/units.ts';

test('distance conversion keeps a canonical kilometre radius', () => {
  assert.ok(Math.abs(toKilometres(10, 'mi') - 16.09344) < 1e-8);
  assert.ok(Math.abs(fromKilometres(16.09344, 'mi') - 10) < 1e-8);
  assert.equal(formatDistance(100, 'mi'), '62 mi');
  assert.equal(formatDistance(5, 'km'), '5 km');
});

test('currency suggestion uses country code and keeps a manual selector', () => {
  assert.equal(currencyForCountry('ca'), 'CAD');
  assert.equal(currencyForCountry('JP'), 'JPY');
  assert.equal(currencyForCountry('DE'), 'EUR');
  assert.equal(currencyForCountry('XX'), undefined);
  assert.ok(currencyOptions('won', 'CAD').includes('KRW'));
});
