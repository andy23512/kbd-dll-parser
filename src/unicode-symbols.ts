import { readFileSync } from 'node:fs';

const UNICODE_H_PATH = new URL(
  '../vendor/winkbdlayouts/keyboards/unicode.h',
  import.meta.url
);

/**
 * winkbdlayouts' kbdreverse output uses symbolic UC_* names (from
 * keyboards/unicode.h) instead of raw codepoints for readability.
 * This loads that #define table so callers can resolve them back.
 */
export function loadUnicodeSymbols(): Map<string, number> {
  const content = readFileSync(UNICODE_H_PATH, 'utf8');
  const symbols = new Map<string, number>();
  for (const match of content.matchAll(
    /^#define\s+(UC_\w+)\s+(0x[0-9A-Fa-f]+)/gm
  )) {
    const [, name, hex] = match;
    symbols.set(name as string, parseInt(hex as string, 16));
  }
  return symbols;
}
