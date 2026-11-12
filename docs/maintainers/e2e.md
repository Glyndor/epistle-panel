# End-to-end checks

Unit tests run the proxy, the pages and the actions as separate modules in one
test process. The built standalone server bundles them separately, so some
behaviour only shows on the real thing. `scripts/e2e/` checks it.

## Running

```sh
cd internal && bun run build && cd ..
scripts/e2e/run.sh              # every scenario, about 40 s
scripts/e2e/run.sh noauth idle  # some of them
scripts/headers/verify.sh       # headers, nonce and redirects, one server
bun test scripts/e2e            # the stand-in API's and the shared checks' tests
```

It needs bash, node, bun and curl, uses only 127.0.0.1 and picks free ports
(`PANEL_PORT` and `STAND_IN_PORT` override them).

The `End-to-end` workflow (`.github/workflows/e2e.yml`) builds the panel and runs
`bun test scripts/e2e`, `scripts/e2e/run.sh` and `scripts/headers/verify.sh` on
pull requests and on pushes to `develop` that touch `internal/src/lib/auth/**`,
`internal/src/lib/security-headers/**`, `internal/src/lib/api/**`,
`internal/src/lib/config/**`, `internal/src/proxy.ts`, `internal/next.config.ts`,
`internal/src/app/**`, `internal/src/components/**`, `internal/src/features/**`,
`internal/src/i18n/**`, `internal/package.json`, `internal/bun.lock`,
`scripts/e2e/**`, `scripts/headers/**` or the workflow itself, except for
changes that touch only `internal/**/*.test.ts` or `*.test.tsx` files. Pull
requests are built only when they target `develop`. It is not a required check, so a docs-only change neither runs nor waits
on it. Its `timeout-minutes: 15` is an estimate with a margin: runs on 2026-11-12
finished between about 1 and 8 minutes. A red run means a real server behaved differently from the unit
tests, so read its log before merging anyway.

`run.sh` is a thin runner: argument parsing, the stand-in and panel start and
stop, and the dispatch. The rest is sourced from two folders, so no file nears
the line limit:

| Path | Holds |
|---|---|
| `scripts/e2e/lib/reporting.sh` | the pass and fail counters and the `assert_*` helpers |
| `scripts/e2e/lib/processes.sh` | secrets, start and restart of the stand-in and the panel, its control calls |
| `scripts/e2e/lib/http.sh` | `fetch`, `login`, the form-field readers, memory and CPU counters |
| `scripts/e2e/scenarios/<name>.sh` | one scenario each: `headers`, `logout`, `limiter`, `limiter-global`, `noauth`, `degraded`, `rotation`, `idle` |

A new scenario is a new file in `scenarios/`, a `source` line and a `case` entry
in `run.sh`, and a row in the table below.

Two small files are sourced by both scripts: `session-cookie.sh` holds the
session cookie name, and a test fails when it differs from `SESSION_COOKIE` in
`internal/src/lib/auth/session/index.ts`; `html-checks.sh` holds the check that
every `<script>` tag carries the nonce, whatever its attributes. A script that
sends a stale cookie name is redirected to `/login`, and every header check
still passes on the redirect, so `verify.sh` also asserts a 200 with an HTML
body before it checks anything else.

`scripts/e2e/stand-in-api/` answers the paths the panel calls, validated
against the panel's own zod schemas in its test. It knows the accounts `admin`
and `ops` (admins) and `user` (not an admin), logs every request without any
secret, and switches the data endpoints to `hang` or `huge` through
`POST /__control/mode`.

## What the script proves

| Scenario | Proves |
|---|---|
| `headers` | CSP with a fresh nonce per request, no `unsafe-inline`, the nonce on every script tag (with or without attributes), the other headers, the cookie flags, no inline style on every page and on the 404 page, `X-Robots-Tag` on the login page, the pages and a static asset, the robots meta tag and no canonical, Open Graph or Twitter tag |
| `logout` | a replayed cookie is refused by the proxy and by an action after logout, and reaches no API endpoint; another session survives |
| `limiter` | three free tries, then the lock; locked attempts never reach the API; another name signs in; the lock ends; a failure and a success each take at least 1 s |
| `limiter-global` | 60 failing names fill the global window and the 61st unknown name is refused; the admin, who signed in before, is still admitted. The cap of 8 concurrent API calls is covered by the unit tests, since parallel curl processes cannot make the count deterministic |
| `noauth` | every route and Server Action is redirected without a session, with a garbage or altered cookie, and the stand-in sees nothing; `/robots.txt` answers `Disallow: /` without a session and its look-alikes (`/robots.txtx`, `/robots.txt/queue`, `/x/robots.txt`, `/ROBOTS.TXT`) and `/sitemap.xml` stay behind the gate |
| `degraded` | a hanging API degrades the page within the 10 s budget and the server keeps answering; a body over the cap degrades quickly with bounded memory |
| `rotation` | replacing a `_FILE` secret does not change a running process, in any bundle; a restart picks it up |
| `idle` | idle CPU, and a memory ceiling after 400 requests |

## Browser checks (manual)

Start the stand-in and the standalone server by hand (`STAND_IN_TOKEN` is
required by the stand-in, `STAND_IN_PORT` and `PANEL_PORT` set the ports, and
`lib/processes.sh` shows the variables the panel needs), then use a Chromium-based browser with
the console open.

1. Open `http://127.0.0.1:<port>/login` and `http://localhost:<port>/login`.
   Sign in as `admin` / `correct-horse`. In Chromium both origins count as
   secure, so the `__Host-` cookie is stored (Secure, HttpOnly, Path=/,
   SameSite=Lax, no Domain). Over plain HTTP on any other host name the browser
   drops it and sign-in does not stick. Firefox and Safari were not checked here; Firefox is documented as accepting
   the cookie on `http://localhost` (see the README).
2. Visit `/`, `/accounts`, `/domains`, `/queue`: the console must show no CSP
   violation and no error, and the login form must be hydrated (a failed
   sign-in shows the alert without a page reload).
3. On `/queue` press Remove and accept the confirmation: the entry disappears
   and the stand-in log shows one `DELETE`.
4. Set the cookie `locale=es` and reload: the headings are Spanish and
   `<html lang="es">`.
5. Visit an unknown path while signed in: the panel's own 404 page, with no
   inline-style violation.
6. Press Sign out: the page goes to `/login` and the session cookie is gone.
7. Sidebar: collapse it with the toggle or Ctrl+B and hover an icon (a tooltip
   names it); open the Language menu and pick Español (the page re-renders in
   Spanish); narrow the window below 768 px, open the sheet with the toggle,
   press Escape (focus returns to the toggle) and follow a link (the sheet
   closes). In every step the console must show no CSP violation. A violation
   listener (`document.addEventListener("securitypolicyviolation", ...)`
   installed before the page loads) catches the ones the console shows late.

## Measured on 2026-11-12 (Node 24, Next 16.4.6)

- Failed sign-in: 1.0 to 1.4 s.
- Idle: about 120 MiB resident, no CPU. After 1200 requests in a manual run
  resident memory peaked near 350 MiB and fell back to about 190 MiB once idle, so it is
  garbage-collector headroom, not growth. The container has no heap cap; set
  one (`NODE_OPTIONS=--max-old-space-size`) if its memory limit is tight.
- A 64 MiB streamed body is cut at the 5 MiB cap; memory grew by about 26 MiB.
