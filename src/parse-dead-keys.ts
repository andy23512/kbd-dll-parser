import { readFileSync, writeFileSync } from 'node:fs';
import { loadUnicodeSymbols } from './unicode-symbols.ts';
import type { DeadKeyTable } from './model.ts';

const CHAR_LITERAL = /^L?'(.*)'$/;
const HEX_LITERAL = /^0x[0-9A-Fa-f]+$/;
const DEC_LITERAL = /^[0-9]+$/;

function unescapeCLiteral(raw: string): string {
  return raw
    .replace(/\\\\/g, '\\')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

/**
 * Resolves one DEADTRANS() argument (a WCHAR literal, hex codepoint, or a
 * symbolic UC_* name from unicode.h) to the character it represents.
 */
function resolveToken(token: string, symbols: Map<string, number>): string {
  const charMatch = token.match(CHAR_LITERAL);
  if (charMatch) {
    return unescapeCLiteral(charMatch[1] as string);
  }
  if (HEX_LITERAL.test(token)) {
    return String.fromCodePoint(parseInt(token, 16));
  }
  if (DEC_LITERAL.test(token)) {
    return String.fromCodePoint(parseInt(token, 10));
  }
  const codepoint = symbols.get(token);
  if (codepoint === undefined) {
    throw new Error(`Unresolved DEADTRANS token: ${token}`);
  }
  return String.fromCodePoint(codepoint);
}

/**
 * Parses the `dead_keys` DEADTRANS(base, accent, composed, flags) array out
 * of a kbdreverse-generated C source file and groups the results by accent
 * character, matching kbdlayout-parser's DeadKeyTable shape.
 */
export function parseDeadKeys(source: string): DeadKeyTable {
  const arrayStart = source.indexOf('dead_keys[]');
  if (arrayStart === -1) {
    throw new Error('No dead_keys array found in source');
  }
  const bodyStart = source.indexOf('{', arrayStart);
  const bodyEnd = source.indexOf('};', bodyStart);
  const body = source.slice(bodyStart, bodyEnd);

  const symbols = loadUnicodeSymbols();
  const table: DeadKeyTable = {};

  for (const match of body.matchAll(
    /DEADTRANS\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*[^,)]+?\s*\)/g
  )) {
    const [, baseToken, accentToken, composedToken] = match;
    const base = resolveToken(baseToken as string, symbols);
    const accent = resolveToken(accentToken as string, symbols);
    const composed = resolveToken(composedToken as string, symbols);
    (table[accent] ??= []).push({ with: base, text: composed });
  }

  return table;
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error(
      'Usage: parse-dead-keys <kbdreverse-output.c> <deadKeyResults.json>'
    );
    process.exit(1);
  }
  const source = readFileSync(inputPath, 'utf8');
  const table = parseDeadKeys(source);
  writeFileSync(outputPath, JSON.stringify(table, null, 2));
  console.log(
    `Wrote ${Object.keys(table).length} dead keys to ${outputPath}`
  );
}

main();
