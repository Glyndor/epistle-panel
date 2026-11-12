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
| `scripts/e2e/scenarios/<name>.sh` | one scenario each: `headers`, `logout`, `limiter`, `limiter-global`, `noauth`, `degraded`, `rotation`, `idle`, `theme`, `body-limit`, `captcha`, `csrf`, `set-locale`, `unknown-variable` |

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
| `body-limit` | a Server Action body over the 16 KB `experimental.serverActions.bodySizeLimit` in `next.config.ts` is refused before the action runs (the API sees no call), while the widest sign-in the form can send (about 4.1 KB, also with a 4 KB CAPTCHA-sized token) and a normal action are accepted |
| `captcha` | with the stand-in CAPTCHA provider on (the `custom` provider): off by default; the page carries the widget box and the public site key, never the secret or the verification URL; the sign-in page's CSP gains exactly the provider's origin in `script-src`, `frame-src` and `connect-src` and nothing else, no other response does; no token and an unsolved token are refused and the API is never asked, a solved one signs in; the provider is asked before the API; a missing site key, an unreadable secret file or an unknown provider refuse every sign-in, name the variable in the log and widen nothing; no log holds a token or a secret |
| `csrf` | a Server Action post with a valid session and a foreign `Origin` (or `Origin: null`) is refused by Next and the API sees no `DELETE`; the panel's own `Origin` is accepted. It also pins a measured dependency: a foreign `Origin` together with the same foreign `X-Forwarded-Host` passes Next's check and the action runs (see below) |
| `set-locale` | the `set-locale` action with an unknown or path-like language answers `false` and writes no `locale` cookie; a supported language writes it; without a session the proxy redirects and nothing is written |
| `unknown-variable` | a misspelt `EPISTLE_PANEL_` name is warned about in the startup log by name, the value is never printed, a name the panel reads (and the `_FILE` form of a secret) is not warned about, and the panel still serves |
| `theme` | `/theme.css`, `/brand/logo` and `/brand/favicon` answer without a session when configured and 404 when not; the sign-in page links the stylesheet and shows the name, the logo and the original copyright notice; the CSP is the same with and without a theme; look-alike paths stay behind the gate; a symlink, an oversized or a missing file is a 404 and a log line with no path, and a symlink or a FIFO as the logo is refused the same way; an SVG with script is refused, also when `javascript:` is written with numeric character references |

## Origin check of Server Actions, measured

Measured on 2026-11-12 against the built server (Next 16.4.6), posting
`remove-entry` with a valid session:

| Request headers | Result | `DELETE` at the API |
|---|---|---|
| no `Origin` | 200, runs (not a browser: a browser always sends `Origin` on a cross-site POST) | 1 |
| `Origin: https://evil.test` | 500, `Invalid Server Actions request` | 0 |
| `Origin: null` | 500, same | 0 |
| `Origin` = the panel's own | 200, runs | 1 |
| `Origin: https://evil.test` and `X-Forwarded-Host: evil.test` | 200, runs | 1 |
| `Origin: null` and `X-Forwarded-Host: null` | 200, runs | 1 |

Next reads the host to compare with from `X-Forwarded-Host` when the request
carries one. The panel adds no check of its own (`run-action` only looks at the
session cookie, and `allowedOrigins` is not set), so the only thing between a
cross-site post and the action is that the proxy overwrites
`X-Forwarded-Host`, which the README asks of the operator. The session cookie
is `SameSite=Lax`: a different site does not send it on a POST, but a sibling
subdomain is the same site and does. That is the case this dependency decides.
The `csrf` scenario pins the foreign `Origin`, `Origin: null`, own `Origin` and
foreign `Origin` with `X-Forwarded-Host` rows, so a change in Next or in the
panel shows up as a failing check rather than as a surprise. The other two
rows were only measured.

## What it does not cover

- **A real browser.** Everything above is `curl` against the standalone
  server. Hydration, the console, CSP violations reported by the browser,
  tooltips, focus and the sheet's behaviour are the manual list below. The
  unit test `src/test/overlays-inject-no-style` only checks that opening the
  language menu, the sheet and the remove confirmation adds no `<style>` to
  `document.head` in the test DOM; it does not see an inline `style`
  attribute, and Select and Popover are not measured in any browser yet.
- **The proxy.** Whether the operator's proxy overwrites `X-Forwarded-Host`
  and `X-Forwarded-Proto` is not tested here, only what the panel does when it
  does not (`scripts/headers/verify.sh` covers the redirect, `csrf` the
  Server Action). TLS, HSTS and the container image are outside it.
- **The real API.** The stand-in answers what the panel's schemas accept; a
  change on the epistle side that the stand-in does not mirror passes here.
  The wiring through pasta is not exercised either.
- **More than one process.** The sign-in limiter lives in the memory of one
  process, so the scenarios cannot say anything about several replicas.
- **A real CAPTCHA provider, Firefox and Safari, load beyond the idle and
  burst checks, and accessibility.** The `custom` stand-in provider stands for
  the first; the rest has no automated check in this script.

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
