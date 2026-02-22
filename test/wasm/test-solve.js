'use strict';

// Sanity-tests for SolveBoardPBN: solve all hands in list10.txt (target=-1,
// solutions=3, mode=1) and compare against the golden FUT data in the file.

const path = require('path');
const { loadDDS, solveBoardPBN, parseHandFile, TestRunner } = require('./helpers.js');

const HANDS_FILE = process.env.DDS_HANDS_PATH ||
  path.resolve(__dirname, '../../hands/list10.txt');

async function main() {
  const DDS   = await loadDDS();
  const hands = parseHandFile(HANDS_FILE);
  const t     = new TestRunner(`solve (${hands.length} hands)`);

  DDS._SetMaxThreads(1);

  for (let n = 0; n < hands.length; n++) {
    const h      = hands[n];
    const prefix = `hand ${n + 1}`;

    const { ret, result } = solveBoardPBN(DDS, h.pbn, h.trump, h.first);

    t.eq(ret, 1, `${prefix}: SolveBoardPBN returned 1 (success)`);
    if (ret !== 1) continue;

    t.eq(result.cards, h.fut.cards, `${prefix}: cards count`);

    // Only compare up to the number of cards the solver returned to avoid
    // array-bounds confusion on a mismatch.
    const n_cards = Math.min(result.cards, h.fut.cards);

    t.arrEq(result.suit.slice(0, n_cards),
            h.fut.suits.slice(0, n_cards),   `${prefix}: suit[]`);
    t.arrEq(result.rank.slice(0, n_cards),
            h.fut.ranks.slice(0, n_cards),   `${prefix}: rank[]`);
    t.arrEq(result.equals.slice(0, n_cards),
            h.fut.equals.slice(0, n_cards),  `${prefix}: equals[]`);
    t.arrEq(result.score.slice(0, n_cards),
            h.fut.scores.slice(0, n_cards),  `${prefix}: score[]`);
  }

  if (!t.summary()) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
