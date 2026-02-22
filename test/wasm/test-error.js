'use strict';

// Sanity-tests for ErrorMessage() and error-return-code paths.

const {
  loadDDS, errorMessage, writeStr, TestRunner,
  DEAL_PBN_SIZE, DEAL_PBN_OFF_TRUMP, DEAL_PBN_OFF_FIRST,
  DEAL_PBN_OFF_TRICK_SUIT, DEAL_PBN_OFF_CARDS,
  FUT_SIZE,
} = require('./helpers.js');

// Every (code, text) pair defined in dll.h.
const ERROR_TABLE = [
  [    1, 'Success'                                              ],
  [   -1, 'General error'                                        ],
  [   -2, 'Zero cards'                                           ],
  [   -3, 'Target exceeds number of tricks'                      ],
  [   -4, 'Cards duplicated'                                     ],
  [   -5, 'Target is less than -1'                               ],
  [   -7, 'Target is higher than 13'                             ],
  [   -8, 'Solutions parameter is less than 1'                   ],
  [   -9, 'Solutions parameter is higher than 3'                 ],
  [  -10, 'Too many cards'                                       ],
  [  -12, 'currentTrickSuit or currentTrickRank has wrong data'  ],
  [  -13, 'Played card also remains in a hand'                   ],
  [  -14, 'Wrong number of remaining cards in a hand'            ],
  [  -15, 'Thread index is not 0 .. maximum'                     ],
  [  -16, 'Mode parameter is less than 0'                        ],
  [  -17, 'Mode parameter is higher than 2'                      ],
  [  -18, 'Trump is not in 0 .. 4'                               ],
  [  -19, 'First is not in 0 .. 2'                               ],
  [  -98, 'AnalysePlay input error'                              ],
  [  -99, 'PBN string error'                                     ],
  [ -101, 'Too many boards requested'                            ],
  [ -102, 'Could not create threads'                             ],
  [ -103, 'Something failed waiting for thread to end'           ],
  [ -104, 'Multi-threading system not present'                   ],
  [ -201, 'Denomination filter vector has no entries'            ],
  [ -202, 'Too many DD tables requested'                         ],
  [ -301, 'Chunk size is less than 1'                            ],
];

// Valid PBN used when we need a real deal to exercise parameter checks.
const VALID_PBN =
  'N:QJ6.K652.J85.T98 873.J97.AT764.Q4 K5.T83.KQ9.A7652 AT942.AQ4.32.KJ3';

async function main() {
  const DDS = await loadDDS();
  const t   = new TestRunner('error-messages');

  DDS._SetMaxThreads(1);

  // ── ErrorMessage: every defined code ─────────────────────────────────────
  for (const [code, expected] of ERROR_TABLE)
    t.eq(errorMessage(DDS, code), expected, `ErrorMessage(${code})`);

  // Unknown code returns a fallback, not empty.
  const unknown = errorMessage(DDS, -9999);
  t.ok(unknown.length > 0, 'ErrorMessage(unknown) returns non-empty string');

  // ── SolveBoardPBN: invalid parameter codes ────────────────────────────────
  const dealPtr = DDS._malloc(DEAL_PBN_SIZE);
  const ftPtr   = DDS._malloc(FUT_SIZE);

  // Helper: fill with a valid deal, then override one field.
  function fillValid() {
    DDS.setValue(dealPtr + DEAL_PBN_OFF_TRUMP, 0, 'i32');
    DDS.setValue(dealPtr + DEAL_PBN_OFF_FIRST, 0, 'i32');
    for (let i = 0; i < 6; i++)
      DDS.setValue(dealPtr + DEAL_PBN_OFF_TRICK_SUIT + i * 4, 0, 'i32');
    writeStr(DDS, dealPtr + DEAL_PBN_OFF_CARDS, VALID_PBN);
  }

  fillValid();
  DDS.setValue(dealPtr + DEAL_PBN_OFF_TRUMP, 99, 'i32');  // bad trump
  t.eq(DDS._SolveBoardPBN(dealPtr, -1, 3, 1, ftPtr, 0), -18,
    'bad trump (99) => RETURN_TRUMP_WRONG (-18)');

  fillValid();
  DDS.setValue(dealPtr + DEAL_PBN_OFF_FIRST, 99, 'i32');  // bad first
  t.eq(DDS._SolveBoardPBN(dealPtr, -1, 3, 1, ftPtr, 0), -19,
    'bad first (99) => RETURN_FIRST_WRONG (-19)');

  fillValid();
  t.eq(DDS._SolveBoardPBN(dealPtr, -1, 0, 1, ftPtr, 0), -8,
    'solutions=0 => RETURN_SOLNS_WRONG_LO (-8)');

  fillValid();
  t.eq(DDS._SolveBoardPBN(dealPtr, -1, 4, 1, ftPtr, 0), -9,
    'solutions=4 => RETURN_SOLNS_WRONG_HI (-9)');

  fillValid();
  t.eq(DDS._SolveBoardPBN(dealPtr, -1, 3, -1, ftPtr, 0), -16,
    'mode=-1 => RETURN_MODE_WRONG_LO (-16)');

  fillValid();
  t.eq(DDS._SolveBoardPBN(dealPtr, -1, 3, 3, ftPtr, 0), -17,
    'mode=3 => RETURN_MODE_WRONG_HI (-17)');

  DDS._free(dealPtr);
  DDS._free(ftPtr);

  if (!t.summary()) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
