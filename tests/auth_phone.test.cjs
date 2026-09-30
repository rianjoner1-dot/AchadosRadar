const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBrazilianPhone } = require('../src/modules/auth/phone.mjs');

test('normalizes valid Brazilian national and country-prefixed phone numbers', () => {
  assert.equal(normalizeBrazilianPhone('(11) 3333-4444'), '+551133334444');
  assert.equal(normalizeBrazilianPhone('(11) 98888-7777'), '+5511988887777');
  assert.equal(normalizeBrazilianPhone('+55 11 3333-4444'), '+551133334444');
  assert.equal(normalizeBrazilianPhone('55 (11) 98888-7777'), '+5511988887777');
  assert.equal(normalizeBrazilianPhone('   '), null);
});

test('rejects incomplete numbers and long numbers without the Brazilian country code', () => {
  assert.throws(() => normalizeBrazilianPhone('123456789'), /telefone brasileiro válido/);
  assert.throws(() => normalizeBrazilianPhone('991199888877'), /telefone brasileiro válido/);
  assert.throws(() => normalizeBrazilianPhone('551199888877712'), /telefone brasileiro válido/);
});
