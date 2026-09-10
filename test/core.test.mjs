import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildBoard, applyDecision, renderBoard } from '../src/core.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/campaign.json', import.meta.url), 'utf8'));

test('builds a review board and catches duplicate scheduled slots', () => {
  const board = buildBoard(fixture);
  assert.equal(board.summary.total, 3);
  assert.equal(board.summary.collisions, 1);
  assert.deepEqual(board.collisions[0].itemIds, ['fitness-001', 'fitness-002']);
  assert.equal(board.items.find((item) => item.id === 'fitness-001').state, 'needs_changes');
});

test('respects a truthful approval decision when no blocking issue exists', () => {
  const board = buildBoard(fixture);
  const item = board.items.find((entry) => entry.id === 'fitness-003');
  assert.equal(item.state, 'approved');
  assert.equal(item.decision.reviewer, 'demo-owner');
});

test('does not allow approval while blocking issues remain', () => {
  const board = buildBoard(fixture);
  assert.throws(() => applyDecision(board, 'fitness-001', 'approved', 'reviewer'), /blocking issues/);
});

test('allows a reviewer to approve a clean item', () => {
  const board = buildBoard(fixture);
  const item = applyDecision(board, 'fitness-002', 'changes_requested', 'reviewer', 'Move it to a different time slot');
  assert.equal(item.state, 'changes_requested');
  assert.equal(item.decision.note, 'Move it to a different time slot');
});

test('flags missing accessibility text and unsupported platforms', () => {
  const board = buildBoard({
    campaignId: 'small-check',
    name: 'Small check',
    items: [{ id: 'bad-1', platform: 'myspace', scheduledAt: '2026-09-10T10:00:00Z', hook: 'A useful hook', caption: 'A caption', cta: 'Learn', asset: 'assets/a.jpg', destinationUrl: 'https://example.test/a' }]
  });
  const review = board.items[0].review;
  assert.ok(review.issues.includes('unsupported platform: myspace'));
  assert.ok(review.issues.includes('altText is required for review and accessibility'));
});

test('renders a human-readable board and local review link', () => {
  const output = renderBoard(buildBoard(fixture));
  assert.match(output, /CONTENT APPROVAL DESK/);
  assert.match(output, /review_link=http:\/\/localhost:4173\/review\/bhagalpur-september-demo/);
  assert.match(output, /COLLISIONS/);
});
