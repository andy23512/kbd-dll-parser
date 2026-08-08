/**
 * One dead-key composition result, matching kbdlayout-parser's DeadKeyTable
 * shape (Windows DeadKeyTable/Result -> { with, text }).
 */
export interface DeadKeyResult {
  with: string;
  text: string;
}

/**
 * All composition results for a keyboard layout, keyed by the accent
 * character the dead key produces on its own (e.g. "¯" for macron).
 */
export type DeadKeyTable = Record<string, DeadKeyResult[]>;
