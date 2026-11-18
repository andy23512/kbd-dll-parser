import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadUnicodeSymbols } from './unicode-symbols.ts';

describe('loadUnicodeSymbols', () => {
  const symbols = loadUnicodeSymbols();

  it('loads a non-empty table', () => {
    assert.ok(symbols.size > 0);
  });

  it('maps known names to their codepoints', () => {
    assert.equal(symbols.get('UC_MACRON'), 0x00af);
    assert.equal(symbols.get('UC_ACUTE'), 0x00b4);
    assert.equal(symbols.get('UC_UPPER_A_ACUTE'), 0x00c1);
  });

  it('only contains UC_* names with valid codepoints', () => {
    for (const [name, codepoint] of symbols) {
      assert.match(name, /^UC_\w+$/);
      assert.ok(Number.isInteger(codepoint) && codepoint >= 0, name);
    }
  });

  it('returns undefined for unknown names', () => {
    assert.equal(symbols.get('UC_DOES_NOT_EXIST'), undefined);
  });
});
