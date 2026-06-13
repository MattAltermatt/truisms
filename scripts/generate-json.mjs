// Reads truisms.txt → writes truisms.json as { "items": [...] }.
// Validates: non-empty lines, no blanks, expected count. Exits non-zero on failure.
import { readFileSync, writeFileSync } from 'node:fs';

const EXPECTED_COUNT = 132;

const raw = readFileSync(new URL('../truisms.txt', import.meta.url), 'utf8');
const items = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

if (items.length !== EXPECTED_COUNT) {
  console.error(`Expected ${EXPECTED_COUNT} truisms, got ${items.length}`);
  process.exit(1);
}
if (items.some((l) => l !== l.trim() || l.length === 0)) {
  console.error('Found blank or untrimmed line');
  process.exit(1);
}

const json = JSON.stringify({ items }, null, 2) + '\n';
writeFileSync(new URL('../truisms.json', import.meta.url), json);
console.log(`Wrote truisms.json with ${items.length} items`);
