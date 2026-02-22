'use strict';

// Sanity-tests for CalcDDtablePBN: compute the full double-dummy table
// (5 strains × 4 declarers) for every hand in list10.txt and compare
// against the golden TABLE data stored in the file.

const path = require('path');
const { loadDDS, calcDDtablePBN, parseHandFile, TestRunner } = require('./helpers.js');

const HANDS_FILE = process.env.DDS_HANDS_PATH ||
  path.resolve(__dirname, '../../hands/list10.txt');

const STRAIN_NAMES = ['S', 'H', 'D', 'C', 'NT'];
const HAND_NAMES   = ['N', 'E', 'S', 'W'];

async function main() {
  const DDS   = await loadDDS();
  const hands = parseHandFile(HANDS_FILE);
  const t     = new TestRunner(`table (${hands.length} hands)`);

  DDS._SetMaxThreads(1);

  for (let n = 0; n < hands.length; n++) {
    const h      = hands[n];
    const prefix = `hand ${n + 1}`;

    const { ret, table } = calcDDtablePBN(DDS, h.pbn);

    t.eq(ret, 1, `${prefix}: CalcDDtablePBN returned 1 (success)`);
    if (ret !== 1) continue;

    // Check every cell of the 5×4 table individually for precise diagnostics.
    for (let s = 0; s < 5; s++) {
      for (let hh = 0; hh < 4; hh++) {
        t.eq(
          table[s][hh], h.table[s][hh],
          `${prefix}: resTable[${STRAIN_NAMES[s]}][${HAND_NAMES[hh]}]`
        );
      }
    }
  }

  if (!t.summary()) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
