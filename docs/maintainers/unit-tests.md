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
that loads it; `bun test --coverage` will not point at the gap. Every page,
action and client component has its own test today, and a new one keeps that.

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
- `next/navigation` and `next/headers` are under the same wrapper
  (`src/test/next-navigation/`, registered by the preload with
  `registerStandIn`). A file that mocked `next/navigation` with the two exports
  it used left every file after it without `notFound`; now its own exports win
  and the rest come from the stand-in. A module that several files mock goes
  through `registerStandIn` too.
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

## A failed assertion must be cheap

`waitFor` polls an assertion for one second. That only works if a failed poll
costs almost nothing, and on a DOM node it did not: Bun printed the whole
happy-dom object behind the node into the message. A failed
`expect(node).toBeNull()` built 248 MB of text in about four seconds, and a
failed jest-dom matcher took about seven (measured on a Radix dialog). One
failed poll was longer than the whole wait, so a test whose first poll came a
moment too early failed instead of polling again. Fifty-seven assertions in
eighteen files were of that shape, and the tests that failed "at random" were
among them.

The preload installs a one-line print for every node
(`src/test/short-node-print/`): tag, id, role, accessible name, the start of
its text. A failed assertion on a node now takes about a millisecond and says
which node. Its test fails, in seconds, if the print is not installed.

Do not raise a timeout to cure a test that fails now and then. Look for what a
failed poll costs, or for a test that ends while its action is still on its way
to the stubbed `fetch` (the next section).

## A request that outlives its case

A request that outlives its case lands in the next case's `fetch` stub, with
whatever the next case set: the API token is read when the call is made, so
even a case that counts only requests carrying its own token counted one it
did not make. Of 40 random orders of the mail page's file, 8 failed that way.
It comes from a component that asks for data as it mounts, a reader that marks
a message as read when it opens, or a mutation that reads the list again once
it settles.

Whether a case ends with a request on its way depends on the moment it ends:
the same case leaves one in one run and none in the next. So it is not held as
a rule after the case (a check there failed now and then in files nobody had
touched). It is contained before the next one. The preload's `beforeEach` runs
ahead of the file's own (measured), when the next stub is not in place yet, and
waits there for the clients of the case before to have nothing on its way
(`betweenCases` in `src/test/query-wrapper`). What was left finishes against
whatever the last case left behind and reaches no stub that counts. With that
alone the mail page's file fails in 0 of 40 orders; without it, in 5.

It covers the clients made by `testQueryClient`, which is every one
`withQuery` makes. Two things a file still does itself:

- to have a request counted by the case that made it, end the file's
  `afterEach` with `await settled()` **before** `fetch` is put back
  (`useActionEnvironment` does it for the files that use it);
- a request held open on purpose, to look at a pending state, is answered by
  the case once it has looked: keep the promise's `resolve`, call it, then
  `await settled()`. One left open for ever costs the next case a quarter of a
  second.

## A script left in the head

Test files share one document. A component that loads a script (the CAPTCHA
widget) adds a `<script>` to the head, and unmounting it does not take the
script away. The sign-in page's file left two there, and the form's "no script
when the CAPTCHA is off" case counted them when it ran right after: one seed in
several failed. The preload removes the scripts in the head before every case
(`src/test/left-in-head`), so a case sees only its own.

A request held open on purpose is made **before** the `fetch` stub, and the
stub hands it out. Taking the promise's `resolve` from inside the stub makes it
exist only once `fetch` has been called, and the button is already disabled
before the action reaches `fetch` (it checks the session first): a case that
answered in that gap answered nothing, and the request never ended.

## Pinning limits

A limit is tested against a literal written in the test (`28_800` for the
session, `60` for the failure ceiling), never against the constant the module
exports. A test that imports the constant it checks agrees with any change to it.
