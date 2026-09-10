import { readFile } from 'node:fs/promises';
import { buildBoard, renderBoard } from './core.mjs';

const [command = 'board', file = 'fixtures/campaign.json'] = process.argv.slice(2);

const input = JSON.parse(await readFile(file, 'utf8'));
const board = buildBoard(input);

if (command === 'json') {
  console.log(JSON.stringify(board, null, 2));
} else if (command === 'validate') {
  console.log(renderBoard(board));
  console.log(`\nValidation complete: ${board.summary.needsChanges} item(s) need changes before approval.`);
} else if (command === 'board') {
  console.log(renderBoard(board));
} else {
  console.error('Usage: node src/cli.mjs <validate|board|json> [fixture.json]');
  process.exitCode = 1;
}
