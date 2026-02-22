'use strict';

// Sanity-tests for Par(): compute par scores for every hand in list10.txt
// using the golden DD-table values from the file, then compare par score
// strings against the expected PAR data.
//
// The DD table is sourced from the file (not recomputed) so this test is
// independent of CalcDDtablePBN correctness.

const path = require('path');
const { loadDDS, par, parseHandFile, TestRunner } = require('./helpers.js');

const HANDS_FILE = process.env.DDS_HANDS_PATH ||
  path.resolve(__dirname, '../../hands/list10.txt');

async function main() {
  const DDS   = await loadDDS();
  const hands = parseHandFile(HANDS_FILE);
  const t     = new TestRunner(`par (${hands.length} hands)`);

  DDS._SetMaxThreads(1);

  for (let n = 0; n < hands.length; n++) {
    const h      = hands[n];
    const prefix = `hand ${n + 1}`;

    const { ret, result } = par(DDS, h.table, h.vul);

    t.eq(ret, 1, `${prefix}: Par returned 1 (success)`);
    if (ret !== 1) continue;

    // parScore[0] is the NS view, parScore[1] is the EW view.
    t.eq(result.parScore[0], h.par.score[0], `${prefix}: parScore[NS]`);
    t.eq(result.parScore[1], h.par.score[1], `${prefix}: parScore[EW]`);

    // Contract strings include the declaring side and denomination, e.g.
    // "NS:EW 2S" means from the NS view the par contract is EW 2S.
    t.eq(result.parContracts[0], h.par.contracts[0], `${prefix}: parContracts[NS]`);
    t.eq(result.parContracts[1], h.par.contracts[1], `${prefix}: parContracts[EW]`);
  }

  if (!t.summary()) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
