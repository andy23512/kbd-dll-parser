import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDeadKeys } from './parse-dead-keys.ts';

function wrap(entries: string): string {
  return `static ALLOC_SECTION_LDATA DEADKEY dead_keys[] = {\n${entries}\n  0, 0\n};\n`;
}

describe('parseDeadKeys: token resolution', () => {
  it('resolves wide char literals', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(L'a', L'´', L'á', 0x0000),`));
    assert.deepEqual(table, { '´': [{ with: 'a', text: 'á' }] });
  });

  it('resolves plain (non-wide) char literals', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS('a', '´', 'á', 0),`));
    assert.deepEqual(table, { '´': [{ with: 'a', text: 'á' }] });
  });

  it('resolves hex and decimal codepoints', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(0x0065, 0xB4, 233, 0),`));
    assert.deepEqual(table, { '´': [{ with: 'e', text: 'é' }] });
  });

  it('resolves UC_* names through unicode.h', () => {
    const table = parseDeadKeys(
      wrap(`DEADTRANS(L'A', UC_ACUTE, UC_UPPER_A_ACUTE, 0),`)
    );
    assert.deepEqual(table, { '´': [{ with: 'A', text: 'Á' }] });
  });

  it('unescapes C escape sequences in char literals', () => {
    const table = parseDeadKeys(
      wrap(
        [
          `DEADTRANS(L'\\'', L'x', L'\\\\', 0),`,
          `DEADTRANS(L'\\n', L'y', L'\\t', 0),`,
        ].join('\n')
      )
    );
    assert.deepEqual(table, {
      x: [{ with: "'", text: '\\' }],
      y: [{ with: '\n', text: '\t' }],
    });
  });

  it('handles codepoints outside the BMP', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(0x61, 0xB4, 0x1D400, 0),`));
    assert.equal(table['´']?.[0]?.text, '\u{1D400}');
  });
});

describe('parseDeadKeys: grouping', () => {
  it('groups results by accent, keeping source order', () => {
    const table = parseDeadKeys(
      wrap(
        [
          `DEADTRANS(L'a', L'´', L'á', 0),`,
          `DEADTRANS(L'a', L'¯', L'ā', 0),`,
          `DEADTRANS(L'e', L'´', L'é', 0),`,
        ].join('\n')
      )
    );
    assert.deepEqual(table, {
      '´': [
        { with: 'a', text: 'á' },
        { with: 'e', text: 'é' },
      ],
      '¯': [{ with: 'a', text: 'ā' }],
    });
  });

  it('tolerates extra whitespace and symbolic flags', () => {
    const table = parseDeadKeys(
      wrap(`DEADTRANS(  L'a' ,  L'´' ,  L'á' ,  DKF_DEAD  ),`)
    );
    assert.deepEqual(table, { '´': [{ with: 'a', text: 'á' }] });
  });

  it('returns an empty table for an empty array', () => {
    assert.deepEqual(parseDeadKeys(wrap('')), {});
  });

  it('ignores DEADTRANS entries outside the dead_keys array', () => {
    const source =
      wrap(`DEADTRANS(L'a', L'´', L'á', 0),`) +
      `\nDEADTRANS(L'z', L'^', L'ẑ', 0),\n`;
    assert.deepEqual(parseDeadKeys(source), {
      '´': [{ with: 'a', text: 'á' }],
    });
  });
});

describe('parseDeadKeys: error handling', () => {
  it('throws when there is no dead_keys array', () => {
    assert.throws(
      () => parseDeadKeys('int nothing_here;'),
      /No dead_keys array found/
    );
  });

  it('throws on an unresolved symbolic token', () => {
    assert.throws(
      () =>
        parseDeadKeys(wrap(`DEADTRANS(L'a', UC_DOES_NOT_EXIST, L'á', 0),`)),
      /Unresolved DEADTRANS token: UC_DOES_NOT_EXIST/
    );
  });
});

describe('parseDeadKeys: comma character literals', () => {
  it('keeps a comma used as the accent', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(L'a', L',', L'x', 0x0000),`));
    assert.deepEqual(table, { ',': [{ with: 'a', text: 'x' }] });
  });

  it('keeps a comma used as the base character', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(L',', L'´', L'x', 0x0000),`));
    assert.deepEqual(table, { '´': [{ with: ',', text: 'x' }] });
  });

  it('keeps a comma used as the composed character', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(L'a', L'´', L',', 0x0000),`));
    assert.deepEqual(table, { '´': [{ with: 'a', text: ',' }] });
  });

  it('keeps entries on both sides of a comma entry', () => {
    const table = parseDeadKeys(
      wrap(
        [
          `DEADTRANS(L'r', L',', UC_LOWER_R_CEDILLA, 0x0000),`,
          `DEADTRANS(L'a', L'´', L'á', 0x0000),`,
          `DEADTRANS(L'u', L',', UC_LOWER_U_OGONEK, 0x0000),`,
        ].join('\n')
      )
    );
    assert.equal(table[',']?.length, 2);
    assert.equal(table['´']?.length, 1);
  });

  it('handles an escaped quote literal next to commas', () => {
    const table = parseDeadKeys(wrap(`DEADTRANS(L'\\'', L',', L'x', 0),`));
    assert.deepEqual(table, { ',': [{ with: "'", text: 'x' }] });
  });
});

// Regression against real kbdreverse output: these files contain DEADTRANS
// rows with L',' which used to be silently dropped (96 of 111 were parsed).
describe('parseDeadKeys: real data with comma literals', () => {
  for (const name of ['kbdczapple', 'kbdczapplevm']) {
    it(`${name} parses every DEADTRANS row`, async () => {
      const { readFileSync } = await import('node:fs');
      const source = readFileSync(
        `vendor/winkbdlayouts/keyboards/${name}/${name}.c`,
        'utf8'
      );
      const start = source.indexOf('dead_keys[]');
      const body = source.slice(
        source.indexOf('{', start),
        source.indexOf('};', start)
      );
      const rows = body.split('\n').filter((l) => l.includes('DEADTRANS('));
      const parsed = Object.values(parseDeadKeys(source)).reduce(
        (n, entries) => n + entries.length,
        0
      );
      assert.equal(rows.length, 111);
      assert.equal(parsed, rows.length);
    });
  }
});
