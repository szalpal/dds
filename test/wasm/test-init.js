'use strict';

// Sanity-tests for library initialisation and GetDDSInfo.

const {
  loadDDS, readStr, TestRunner,
  DDSINFO_SIZE, DDSINFO_OFF_MAJOR, DDSINFO_OFF_MINOR,
  DDSINFO_OFF_PATCH, DDSINFO_OFF_VSTR,
} = require('./helpers.js');

async function main() {
  const DDS = await loadDDS();
  const t   = new TestRunner('init');

  // ── SetMaxThreads must not crash ──────────────────────────────────────────
  t.ok(true, 'module loaded successfully');
  DDS._SetMaxThreads(1);
  t.ok(true, 'SetMaxThreads(1) did not crash');

  // ── GetDDSInfo: version fields ────────────────────────────────────────────
  const infoPtr = DDS._malloc(DDSINFO_SIZE);
  DDS._GetDDSInfo(infoPtr);

  const major = DDS.getValue(infoPtr + DDSINFO_OFF_MAJOR, 'i32');
  const minor = DDS.getValue(infoPtr + DDSINFO_OFF_MINOR, 'i32');
  const patch = DDS.getValue(infoPtr + DDSINFO_OFF_PATCH, 'i32');

  t.eq(major, 2,     'GetDDSInfo: major == 2');
  t.eq(minor, 9,     'GetDDSInfo: minor == 9');
  t.eq(patch, 0,     'GetDDSInfo: patch == 0');

  const vstr = readStr(DDS, infoPtr + DDSINFO_OFF_VSTR, 10);
  t.eq(vstr, '2.9.0', 'GetDDSInfo: versionString == "2.9.0"');

  DDS._free(infoPtr);

  // ── FreeMemory must not crash ─────────────────────────────────────────────
  DDS._FreeMemory();
  t.ok(true, 'FreeMemory() did not crash');

  // Re-init so subsequent calls (if any) work.
  DDS._SetMaxThreads(1);

  if (!t.summary()) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
