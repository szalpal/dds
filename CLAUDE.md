# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

DDS is a C++ library (v2.9.0) for solving Contract Bridge hands using alpha-beta search with transposition tables. It supports parallel solving across 5 threading backends and exposes 31 public functions via `include/dll.h`.

## Build Commands

### CMake (preferred on this branch)

```bash
# Configure (Linux defaults: OpenMP + STL threading)
cmake -B build -DDDS_BUILD_TESTS=ON -DDDS_BUILD_EXAMPLES=ON

# Build
cmake --build build -j$(nproc)

# Run dtest against a small hand file
./build/test/dtest -f hands/list10.txt -s solve

# Run a specific solver mode
./build/test/dtest -f hands/list100.txt -s calc -n 4
./build/test/dtest -f hands/list10.txt -s play
./build/test/dtest -f hands/list10.txt -s par

# Run an example
./build/examples/SolveBoard
./build/examples/CalcDDtable
```

Key CMake options:
- `BUILD_SHARED_LIBS` (default ON) — shared vs static
- `DDS_THREADS_OPENMP/STL/BOOST/GCD/WINAPI` — threading backends (platform defaults apply if none set)
- `DDS_SMALL_MEMORY` — trade speed for lower memory use
- `DDS_ENABLE_DEBUG`, `DDS_ENABLE_TIMING`, `DDS_ENABLE_SCHEDULER` — debug/profiling output
- `DDS_BUILD_TESTS`, `DDS_BUILD_EXAMPLES`

### Legacy Makefiles

```bash
# Library (Linux example)
cd src && cp Makefiles/Makefile_linux_shared Makefile && make linux && make install

# Test
cd test && cp Makefiles/Makefile_linux Makefile && make linux

# Examples
cd examples && cp Makefiles/Makefile_linux Makefile && make linux
```

`make install` in src/ copies the library into `../test/` and `../examples/` so they can link against it.

## dtest Options

```
-f, --file <path>       Hand file to solve (required)
-s, --solver <mode>     solve | calc | play | par | dealerpar
-t, --threading <sys>   none | OpenMP | STL | GCD | Boost | WinAPI | default
-n, --numthr <N>        Thread count
-m, --memory <MB>       Memory limit
```

**Hand files** in `hands/` range from `list1.txt` (1 hand) to `masterDD.txt` (83,691 hands). Use `list10.txt` for fast iteration, `list100.txt` for broader coverage.

## Architecture

### Solving Pipeline

`SolveBoard()` / `SolveBoardPBN()` (public API, `include/dll.h`)
→ `SolverIF.cpp` — batch orchestration, thread dispatch
→ `Scheduler.cpp` — task scheduling across threads
→ `ABsearch.cpp` — alpha-beta search with move ordering
→ `Moves.cpp` — card move generation (largest file, 68 KB)
→ `QuickTricks.cpp` / `LaterTricks.cpp` — fast cutoff evaluations
→ `TransTableS.cpp` / `TransTableL.cpp` — transposition tables (small/large per thread)

### Key Subsystems

- **`System.cpp`** — runtime threading backend selection (priority: WinAPI > OpenMP > GCD > Boost > STL); reads compile-time `DDS_THREADS_*` defines
- **`Memory.cpp`** — memory pool per thread; each thread gets its own transposition tables (~20–160 MB)
- **`CalcTables.cpp`** — calculates all 20 trick counts (5 strains × 4 declarers) by calling the solver 20 times
- **`PlayAnalyser.cpp`** — re-solves at each trick to evaluate played card sequences
- **`Par.cpp`** / **`DealerPar.cpp`** — par score/contract calculation (uses DD table results, does not search)
- **`PBN.cpp`** — converts between PBN text format and binary card holdings

### Card Encoding

Cards are bit-encoded: bits 2–14 of an `unsigned int` represent ranks 2–Ace. Each `deal.remainCards[hand][suit]` is one such bitmask. PBN format is the text string `"N:QJ6.K652.J85.T98 ..."` with suits separated by `.` and hands by space.

### Lookup Tables (`Init.cpp`)

~440 KB of precomputed tables built at library init: `highestRank[]`, `lowestRank[]`, `counttable[]`, `winRanks[][]`, `groupData[]` — all indexed by 13-bit card holding bitmasks. These drive fast move generation in `Moves.cpp`.

### Threading

`parallel.h` provides a uniform interface over all backends. `ThreadMgr.cpp` wraps thread lifecycle. The library auto-detects thread count from CPU cores, then limits it based on available memory (targets ~95 MB preferred / 160 MB max per thread, capped at 70% of free RAM).

### Windows DLL Entry

`src/dds.cpp` contains `DllMain` on Windows and a global constructor (`__attribute__((constructor))`) on Unix/macOS — both call `InitStart()` to build lookup tables and initialise the thread system.

## Source Layout

```
include/dll.h          — Public API (31 functions + structs)
include/portab.h       — Platform portability macros
src/                   — 27 .cpp / 28 .h files (library)
src/Exports.def        — Windows DLL export list
src/Makefiles/         — Platform-specific Makefiles
test/                  — dtest program + Makefiles/
examples/              — 13 example programs + Makefiles/
hands/                 — Test hand files (list1 … masterDD)
doc/dll-description.md — Detailed API documentation
cmake/                 — CMake package config template
```
