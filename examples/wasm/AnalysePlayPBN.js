'use strict';

// Example: AnalysePlayPBN via the Emscripten WASM module.
//
// Mirrors examples/AnalysePlayPBN.cpp. For each of the three pre-set hands
// it calls AnalysePlayPBN(), prints the play trace (one line per card played
// plus the double-dummy trick count at that point), and verifies the results
// against the expected golden values from examples/hands.cpp.
//
// Usage:
//   DDS_WASM_PATH=../../build-wasm/dds.js node AnalysePlayPBN.js

const path = require('path');

// ── Load WASM module ──────────────────────────────────────────────────────────

async function loadDDS() {
  const modPath = process.env.DDS_WASM_PATH ||
    path.resolve(__dirname, '../../build-wasm/dds.js');
  return require(modPath)();
}

// ── Struct size / offset constants ────────────────────────────────────────────

// dealPBN: trump(i32) first(i32) trickSuit[3](i32) trickRank[3](i32) cards[80]
const DEAL_PBN_SIZE           = 112;
const DEAL_PBN_OFF_TRUMP      = 0;
const DEAL_PBN_OFF_FIRST      = 4;
const DEAL_PBN_OFF_TRICK_SUIT = 8;   // 3 × i32
const DEAL_PBN_OFF_TRICK_RANK = 20;  // 3 × i32
const DEAL_PBN_OFF_CARDS      = 32;  // char[80]

// playTracePBN: number(i32) cards[106]
const PLAY_TRACE_PBN_SIZE      = 112; // 4 + 106 rounded up to 4-byte alignment
const PLAY_TRACE_PBN_OFF_NUM   = 0;
const PLAY_TRACE_PBN_OFF_CARDS = 4;

// solvedPlay: number(i32) tricks[53](i32)
const SOLVED_PLAY_SIZE         = 216; // 4 + 53*4
const SOLVED_PLAY_OFF_NUM      = 0;
const SOLVED_PLAY_OFF_TRICKS   = 4;

// ── Memory helpers ────────────────────────────────────────────────────────────

function writeStr(DDS, ptr, str) {
  for (let i = 0; i < str.length; i++)
    DDS.setValue(ptr + i, str.charCodeAt(i), 'i8');
  DDS.setValue(ptr + str.length, 0, 'i8');
}

// ── Hand data (from examples/hands.cpp) ──────────────────────────────────────

const SPADES = 0, NOTRUMP = 4;
const NORTH = 0, EAST = 1, SOUTH = 2;

const trump = [SPADES, NOTRUMP, SPADES];
const first = [NORTH,  EAST,   SOUTH ];

const PBN = [
  'N:QJ6.K652.J85.T98 873.J97.AT764.Q4 K5.T83.KQ9.A7652 AT942.AQ4.32.KJ3',
  'E:QJT5432.T.6.QJ82 .J97543.K7532.94 87.A62.QJT4.AT75 AK96.KQ8.A98.K63',
  'N:73.QJT.AQ54.T752 QT6.876.KJ9.AQ84 5.A95432.7632.K6 AKJ9842.K.T8.J93',
];

// Number of cards in the play sequence.
const playNo = [45, 52, 12];

// Play sequences: each pair of characters is one card (suit letter + rank letter).
const play = [
  'CTC4CACJH8H4HKH9D5DAD9D2S7S5S2SQD8D4DQD3H3HAH6H7C3C8CQC2S3SKSAS6HQH5HJHTCKC9D6C5S4SJS8C6DJ',
  'SQD2S8SAHKHTH3H2HQS2H4H6H8D6HJHAS7SKS4C4D8C2DKD4H9C5S6S3H7C7C3S5H5CTD9STD3DQDAC8S9SJC9DTCQD5CAC6DJCKCJD7',
  'HAHKHQH7D7D8DAD9C5CAC6C3',
];

// Expected number of trick-count results (cards played + 1 for the initial count).
const traceNo = [46, 49, 13];

// Expected double-dummy trick counts, indexed by play position.
const trace = [
  [8, 8,8,8,8, 8,8,8,8, 8,8,8,8, 8,8,8,8,
      8,8,8,8, 8,8,8,8, 8,8,8,8, 8,8,8,8,
      8,8,8,8, 8,8,8,8, 8,8,8,8, 8,0,0,0, 0,0,0,0],
  [9, 10,10,10,10, 10,10,10,10, 10,10,10,10, 10,10,10,10,
      10,10,10,10, 10,10,10,10, 10,10,10,10, 10,10,10,10,
      10,10,10,10,  9, 9, 9, 9,  9, 9, 9, 9,  9, 9, 9, 9, 0,0,0,0],
  [10, 10,10,10,10, 10,10,10,10, 10,10,10,10, 0,0,0,0,
       0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0,0,0,0,
       0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0,0,0,0, 0,0,0,0],
];

// ── AnalysePlayPBN wrapper ────────────────────────────────────────────────────

function analysePlayPBN(DDS, handno) {
  const dealPtr   = DDS._malloc(DEAL_PBN_SIZE);
  const playPtr   = DDS._malloc(PLAY_TRACE_PBN_SIZE);
  const solvedPtr = DDS._malloc(SOLVED_PLAY_SIZE);

  // Fill dealPBN
  DDS.setValue(dealPtr + DEAL_PBN_OFF_TRUMP, trump[handno], 'i32');
  DDS.setValue(dealPtr + DEAL_PBN_OFF_FIRST, first[handno], 'i32');
  for (let i = 0; i < 3; i++) {
    DDS.setValue(dealPtr + DEAL_PBN_OFF_TRICK_SUIT + i * 4, 0, 'i32');
    DDS.setValue(dealPtr + DEAL_PBN_OFF_TRICK_RANK + i * 4, 0, 'i32');
  }
  writeStr(DDS, dealPtr + DEAL_PBN_OFF_CARDS, PBN[handno]);

  // Fill playTracePBN
  DDS.setValue(playPtr + PLAY_TRACE_PBN_OFF_NUM, playNo[handno], 'i32');
  writeStr(DDS, playPtr + PLAY_TRACE_PBN_OFF_CARDS, play[handno]);

  const ret = DDS._AnalysePlayPBN(dealPtr, playPtr, solvedPtr, 0);

  let solved = null;
  if (ret === 1) {
    const number = DDS.getValue(solvedPtr + SOLVED_PLAY_OFF_NUM, 'i32');
    const tricks = [];
    for (let i = 0; i < number; i++)
      tricks.push(DDS.getValue(solvedPtr + SOLVED_PLAY_OFF_TRICKS + i * 4, 'i32'));
    solved = { number, tricks };
  }

  DDS._free(dealPtr);
  DDS._free(playPtr);
  DDS._free(solvedPtr);
  return { ret, solved };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const SUIT_CHAR = ['S', 'H', 'D', 'C', 'N'];
const TRUMP_NAME = ['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Notrump'];
const FIRST_NAME = ['North', 'East', 'South', 'West'];

function printTrace(handno, solved) {
  // Initial count (before opening lead)
  console.log(`  Play  0: -- (start) tricks = ${solved.tricks[0]}`);
  for (let i = 1; i < solved.number; i++) {
    const c1 = play[handno][2 * (i - 1)];
    const c2 = play[handno][2 * i - 1];
    console.log(`  Play ${String(i).padStart(2)}: ${c1}${c2}        tricks = ${solved.tricks[i]}`);
  }
}

// ── Verify results against golden data ───────────────────────────────────────

function comparePlay(handno, solved) {
  if (solved.number !== traceNo[handno]) {
    console.error(`  number mismatch: got ${solved.number}, want ${traceNo[handno]}`);
    return false;
  }
  for (let i = 0; i < solved.number; i++) {
    if (solved.tricks[i] !== trace[handno][i]) {
      console.error(`  tricks[${i}] mismatch: got ${solved.tricks[i]}, want ${trace[handno][i]}`);
      return false;
    }
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const DDS = await loadDDS();
  DDS._SetMaxThreads(1);

  let allOk = true;

  for (let handno = 0; handno < 3; handno++) {
    const trumpStr = TRUMP_NAME[trump[handno]];
    const firstStr = FIRST_NAME[first[handno]];
    console.log(`\nHand ${handno + 1}: trump=${trumpStr}, first=${firstStr}`);
    console.log(`  PBN: ${PBN[handno]}`);

    const { ret, solved } = analysePlayPBN(DDS, handno);

    if (ret !== 1) {
      const errBuf = DDS._malloc(80);
      DDS._ErrorMessage(ret, errBuf);
      let msg = '';
      for (let i = 0; i < 80; i++) {
        const c = DDS.getValue(errBuf + i, 'i8') & 0xff;
        if (c === 0) break;
        msg += String.fromCharCode(c);
      }
      DDS._free(errBuf);
      console.error(`  DDS error (${ret}): ${msg}`);
      allOk = false;
      continue;
    }

    printTrace(handno, solved);

    const ok = comparePlay(handno, solved);
    console.log(`  AnalysePlayPBN, hand ${handno + 1}: ${ok ? 'OK' : 'ERROR'}`);
    if (!ok) allOk = false;
  }

  console.log(`\nOverall: ${allOk ? 'OK' : 'FAILED'}`);
  if (!allOk) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
