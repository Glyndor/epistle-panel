# Unit tests

Run everything from `internal/`: `bun test` for the suite, `bun test --coverage`
for the report the CI gate reads (90% of lines).

`bunfig.toml` also holds the gate and the per-test limit: `coverageThreshold`
(0.9 of lines and of functions) and `timeout` (10 s; the slowest test measures
about 0.5 s). Bun reads the threshold as a fraction, so `90` is out of range and
makes every run exit 1. Bun prints nothing when the threshold fails, so
`scripts/test/coverage.sh` runs the same command and prints the measured lines
and functions next to the threshold, naming the one that is short.

## What the coverage number counts

`bunfig.toml` lists `coveragePathIgnorePatterns`, so test helpers
(`src/test/**`, every `test-support/` folder) and the `*.test.*` files are out of
the report. The number describes production code only. A production file that no
test imports is not in the report at all, so a new page or action needs a test
that loads it; `bun test --coverage` will not point at the gap. The login page
and the login form had none when this was written.

## Order independence

`mock.module` is process-global and Bun links a module against whichever mock
exists when it is first imported. Two files that mock `next-intl/server` with
different exports pass in one order and fail in another. So:

- `src/test/next-intl/` holds the stand-ins for `next-intl` and
  `next-intl/server`, with every export the panel imports, and the preload
  installs them. It also wraps `mock.module`, so a test that still mocks one of
  those two modules keeps its own exports and loses none of the others. Prefer
  the stand-ins: a test in that folder fails when one lacks a name the panel
  imports.
- Stores kept on `globalThis` (revocations, the login limiter) are emptied
  before each case that counts their entries.

Check it locally before pushing a change that touches mocks or shared state:

```sh
scripts/test/randomized.sh        # seeds 1 to 10, prints any failing seed
bun test --randomize --seed=9     # replay one
```

The required CI check runs the default order only, because the workflow it calls
is shared with other repositories. The `Randomized tests` workflow
(`.github/workflows/randomized-tests.yml`) runs `scripts/test/randomized.sh 1`,
seed 1, on pull requests into `develop` that touch `internal/**`. It is not a
required check; a failing run prints the tail of the suite's output and the seed
to replay.

## Time

Code that waits (the login response floor) is tested with `src/test/fake-clock`:
`useFakeClock`, then `timeIt(() => work())` returns the fake milliseconds the
work waited, so a test asserts `300` and not "at least 280". The limiter takes a
`now` argument for the same reason. Do not assert a bound on `Date.now()` or
`performance.now()` measured around real timers.

## Generated inputs

Generated-input tests draw from a seeded generator (`src/test/prng`). The
default seed is fixed, so CI replays the same cases. To explore others:

```sh
GENERATED_SEED=$RANDOM bun test src/lib src/proxy-generated-inputs.test.ts
```

Every failure prints `seed=<n> case=<i>`; run again with `GENERATED_SEED=<n>`
to replay the whole run, or call `replayCase` for that one case. A value that is
not a non-negative integer stops the run instead of falling back to the default.

## Pinning limits

A limit is tested against a literal written in the test (`28_800` for the
session, `60` for the failure ceiling), never against the constant the module
exports. A test that imports the constant it checks agrees with any change to it.
