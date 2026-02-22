'use strict';

// Shared utilities for all WASM sanity tests.

const path = require('path');
const fs   = require('fs');

// ── Module loading ─────────────────────────────────────────────────────────────

async function loadDDS() {
  // Override with DDS_WASM_PATH env var (set by CTest via ENVIRONMENT property).
  const modPath = process.env.DDS_WASM_PATH ||
    path.resolve(__dirname, '../../build-wasm/dds.js');
  const createDDS = require(modPath);
  return createDDS();
}

// ── Struct layout constants ────────────────────────────────────────────────────

// dealPBN: trump(i32) first(i32) trickSuit[3](i32) trickRank[3](i32) cards[80]
const DEAL_PBN_SIZE          = 112;
const DEAL_PBN_OFF_TRUMP     = 0;
const DEAL_PBN_OFF_FIRST     = 4;
const DEAL_PBN_OFF_TRICK_SUIT = 8;   // i32[3]
const DEAL_PBN_OFF_TRICK_RANK = 20;  // i32[3]
const DEAL_PBN_OFF_CARDS     = 32;   // char[80]

// futureTricks: nodes(i32) cards(i32) suit[13] rank[13] equals[13] score[13]
const FUT_SIZE       = 216;
const FUT_OFF_CARDS  = 4;
const FUT_OFF_SUIT   = 8;
const FUT_OFF_RANK   = 60;
const FUT_OFF_EQUALS = 112;
const FUT_OFF_SCORE  = 164;

// ddTableDealPBN: cards[80]
const TABLE_DEAL_PBN_SIZE = 80;

// ddTableResults: resTable[5][4] stored in strain-major order
const TABLE_RES_SIZE = 80;

// parResults: parScore[2][16] + parContractsString[2][128]
const PAR_RES_SIZE        = 288;
const PAR_OFF_SCORE_0     = 0;
const PAR_OFF_SCORE_1     = 16;
const PAR_OFF_CONTRACT_0  = 32;
const PAR_OFF_CONTRACT_1  = 160;

// DDSInfo: major(i32) minor(i32) patch(i32) versionString[10] + …
const DDSINFO_SIZE      = 2048;  // allocate generously
const DDSINFO_OFF_MAJOR = 0;
const DDSINFO_OFF_MINOR = 4;
const DDSINFO_OFF_PATCH = 8;
const DDSINFO_OFF_VSTR  = 12;   // char[10]

// ── Memory helpers ─────────────────────────────────────────────────────────────

function writeStr(DDS, ptr, str) {
  for (let i = 0; i < str.length; i++)
    DDS.setValue(ptr + i, str.charCodeAt(i), 'i8');
  DDS.setValue(ptr + str.length, 0, 'i8');
}

function readStr(DDS, ptr, maxLen = 256) {
  let s = '';
  for (let i = 0; i < maxLen; i++) {
    const c = DDS.getValue(ptr + i, 'i8') & 0xff;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

// ── High-level API wrappers ────────────────────────────────────────────────────

function solveBoardPBN(DDS, pbn, trump, first,
                       target = -1, solutions = 3, mode = 1) {
  const dealPtr = DDS._malloc(DEAL_PBN_SIZE);
  DDS.setValue(dealPtr + DEAL_PBN_OFF_TRUMP, trump, 'i32');
  DDS.setValue(dealPtr + DEAL_PBN_OFF_FIRST, first, 'i32');
  for (let i = 0; i < 6; i++)
    DDS.setValue(dealPtr + DEAL_PBN_OFF_TRICK_SUIT + i * 4, 0, 'i32');
  writeStr(DDS, dealPtr + DEAL_PBN_OFF_CARDS, pbn);

  const ftPtr = DDS._malloc(FUT_SIZE);
  const ret   = DDS._SolveBoardPBN(dealPtr, target, solutions, mode, ftPtr, 0);

  let result = null;
  if (ret === 1) {
    const cards = DDS.getValue(ftPtr + FUT_OFF_CARDS, 'i32');
    result = { cards, suit: [], rank: [], equals: [], score: [] };
    for (let i = 0; i < cards; i++) {
      result.suit.push(  DDS.getValue(ftPtr + FUT_OFF_SUIT   + i * 4, 'i32'));
      result.rank.push(  DDS.getValue(ftPtr + FUT_OFF_RANK   + i * 4, 'i32'));
      result.equals.push(DDS.getValue(ftPtr + FUT_OFF_EQUALS + i * 4, 'i32'));
      result.score.push( DDS.getValue(ftPtr + FUT_OFF_SCORE  + i * 4, 'i32'));
    }
  }
  DDS._free(dealPtr);
  DDS._free(ftPtr);
  return { ret, result };
}

function calcDDtablePBN(DDS, pbn) {
  const dealPtr  = DDS._malloc(TABLE_DEAL_PBN_SIZE);
  writeStr(DDS, dealPtr, pbn);

  const tablePtr = DDS._malloc(TABLE_RES_SIZE);
  const ret      = DDS._CalcDDtablePBN(dealPtr, tablePtr);

  let table = null;
  if (ret === 1) {
    table = [];
    for (let s = 0; s < 5; s++) {
      table[s] = [];
      for (let h = 0; h < 4; h++)
        table[s][h] = DDS.getValue(tablePtr + (s * 4 + h) * 4, 'i32');
    }
  }
  DDS._free(dealPtr);
  DDS._free(tablePtr);
  return { ret, table };
}

function par(DDS, table, vulnerable) {
  const tablePtr = DDS._malloc(TABLE_RES_SIZE);
  for (let s = 0; s < 5; s++)
    for (let h = 0; h < 4; h++)
      DDS.setValue(tablePtr + (s * 4 + h) * 4, table[s][h], 'i32');

  const parPtr = DDS._malloc(PAR_RES_SIZE);
  const ret    = DDS._Par(tablePtr, parPtr, vulnerable);

  let result = null;
  if (ret === 1) {
    result = {
      parScore:    [ readStr(DDS, parPtr + PAR_OFF_SCORE_0,    16),
                     readStr(DDS, parPtr + PAR_OFF_SCORE_1,    16) ],
      parContracts:[ readStr(DDS, parPtr + PAR_OFF_CONTRACT_0, 128),
                     readStr(DDS, parPtr + PAR_OFF_CONTRACT_1, 128) ],
    };
  }
  DDS._free(tablePtr);
  DDS._free(parPtr);
  return { ret, result };
}

function errorMessage(DDS, code) {
  const buf = DDS._malloc(80);
  DDS._ErrorMessage(code, buf);
  const msg = readStr(DDS, buf, 80);
  DDS._free(buf);
  return msg;
}

// ── Hand file parser ───────────────────────────────────────────────────────────
// Parses the txt format used in hands/list*.txt.

function parseHandFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const header = lines[0].split(/\s+/);
  if (header[0] !== 'NUMBER') throw new Error('Expected NUMBER line');
  const count = parseInt(header[1], 10);

  const hands = [];
  let i = 1;

  for (let n = 0; n < count; n++) {
    // PBN -----------------------------------------------------------------
    while (i < lines.length && !lines[i].startsWith('PBN ')) i++;
    const pbnToks = lines[i++].split(/\s+/);
    const dealer = parseInt(pbnToks[1], 10);
    const vul    = parseInt(pbnToks[2], 10);
    const trump  = parseInt(pbnToks[3], 10);
    const first  = parseInt(pbnToks[4], 10);
    // Tokens 5-8 form the quoted PBN string: "N:... ... ... ..."
    const pbn = pbnToks.slice(5).join(' ').replace(/^"|"$/g, '');

    // FUT -----------------------------------------------------------------
    while (i < lines.length && !lines[i].startsWith('FUT ')) i++;
    const futToks = lines[i++].split(/\s+/);
    const cards  = parseInt(futToks[1], 10);
    const suits  = futToks.slice(2,          2 +   cards).map(Number);
    const ranks  = futToks.slice(2 +   cards, 2 + 2*cards).map(Number);
    const equals = futToks.slice(2 + 2*cards, 2 + 3*cards).map(Number);
    const scores = futToks.slice(2 + 3*cards, 2 + 4*cards).map(Number);

    // TABLE ---------------------------------------------------------------
    while (i < lines.length && !lines[i].startsWith('TABLE ')) i++;
    const tblToks = lines[i++].split(/\s+/);
    const flat = tblToks.slice(1).map(Number);  // 20 values, strain-major
    const table = Array.from({ length: 5 }, (_, s) => flat.slice(s*4, s*4+4));

    // PAR (not PAR2) ------------------------------------------------------
    while (i < lines.length && !lines[i].startsWith('PAR ')) i++;
    const parLine = lines[i++];
    // Extract up to four quoted strings.
    const m = parLine.match(/"([^"]*)"/g) || [];
    const parScore     = (m[0] || '""').slice(1,-1);
    const parScoreEW   = (m[1] || '""').slice(1,-1);
    const parContract  = (m[2] || '""').slice(1,-1);
    const parContractEW= (m[3] || '""').slice(1,-1);

    hands.push({
      dealer, vul, trump, first, pbn,
      fut:   { cards, suits, ranks, equals, scores },
      table,
      par:   { score: [parScore, parScoreEW],
               contracts: [parContract, parContractEW] },
    });
  }
  return hands;
}

// ── Lightweight test harness ──────────────────────────────────────────────────

class TestRunner {
  constructor(suiteName) {
    this.suite  = suiteName;
    this.passed = 0;
    this.failed = 0;
  }

  ok(cond, label, detail = '') {
    if (cond) {
      console.log(`  PASS  ${label}`);
      this.passed++;
    } else {
      console.error(`  FAIL  ${label}` + (detail ? `: ${detail}` : ''));
      this.failed++;
    }
  }

  eq(actual, expected, label) {
    this.ok(
      actual === expected, label,
      `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`
    );
  }

  arrEq(actual, expected, label) {
    const same = actual.length === expected.length &&
                 actual.every((v, idx) => v === expected[idx]);
    this.ok(same, label,
      `got [${actual}], want [${expected}]`);
  }

  summary() {
    const status = this.failed === 0 ? 'OK' : 'FAILED';
    console.log(`\n${this.suite}: ${this.passed} passed, ${this.failed} failed  [${status}]`);
    return this.failed === 0;
  }
}

module.exports = {
  loadDDS,
  solveBoardPBN, calcDDtablePBN, par, errorMessage,
  writeStr, readStr,
  parseHandFile,
  TestRunner,
  // Layout constants (for advanced tests that need direct struct access)
  DEAL_PBN_SIZE, DEAL_PBN_OFF_TRUMP, DEAL_PBN_OFF_FIRST,
  DEAL_PBN_OFF_TRICK_SUIT, DEAL_PBN_OFF_TRICK_RANK, DEAL_PBN_OFF_CARDS,
  FUT_SIZE,
  TABLE_DEAL_PBN_SIZE, TABLE_RES_SIZE,
  PAR_RES_SIZE,
  DDSINFO_SIZE, DDSINFO_OFF_MAJOR, DDSINFO_OFF_MINOR,
  DDSINFO_OFF_PATCH, DDSINFO_OFF_VSTR,
};
