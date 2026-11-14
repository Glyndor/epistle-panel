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
pull requests and on pushes to `develop` that touch anything the built server
ships or the scripts read: `internal/src/**`, `internal/next.config.ts`,
`internal/postcss.config.mjs`, `internal/tsconfig.json`, `internal/package.json`,
`internal/bun.lock`, `scripts/e2e/**`, `scripts/headers/**` or the workflow
itself. It does not run for a change that touches only test files
(`*.test.ts`, `*.test.tsx`), the test preload (`internal/src/test/**`) or a
`test-support` folder. The list was once the folders the first scenarios used,
and a change to `src/styles` or `src/lib/routes` alone slipped past it. Pull
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
| `scripts/e2e/scenarios/<name>.sh` | one scenario each: `headers`, `logout`, `limiter`, `limiter-global`, `noauth`, `degraded`, `rotation`, `idle`, `theme`, `theme-choice`, `profile-menu`, `body-limit`, `captcha`, `csrf`, `set-locale`, `unknown-variable`, `suppression`, `deliveries`, `account-detail`, `accounts`, `breadcrumbs`, `admin-id`, `mail`, `streaming`, `tables`, `overview` |

Every run generates its own admin id (a fresh UUID v4, `admin_id`, and `adm` for the
admin path) and passes it as `EPISTLE_PANEL_ADMIN_ID`; nothing in the repository
spells one. `lib/http.sh` has the helpers that compare a response with the 404 of a
missing path: `set_404_reference`, `assert_hidden` and `assert_action_hidden` (same
status, same headers and same body once the nonce is blanked).

A new scenario is a new file in `scenarios/`, a `source` line and a `case` entry
in `run.sh`, and a row in the table below.

Two small files are sourced by both scripts: `session-cookie.sh` holds the
session cookie name, and a test fails when it differs from `SESSION_COOKIE` in
`internal/src/lib/auth/session/index.ts`; `html-checks.sh` holds the check that
every `<script>` tag carries the nonce, whatever its attributes. A script that
sends a stale cookie name gets the 404 of a hidden path, and every header check
still passes on the 404, so `verify.sh` also asserts a 200 with an HTML
body before it checks anything else.

`scripts/e2e/stand-in-api/` answers the paths the panel calls, validated
against the panel's own zod schemas in its test. It knows the accounts `admin`
and `ops` (admins) and `user` (not an admin), keeps a queue
(`stand-in-api/queue.ts`, paged by `cursor`), a suppression list
(`stand-in-api/suppression.ts`, paged by `after`, seeded with a `/` and a `+`
address) and a delivery log (`stand-in-api/deliveries.ts`, filters and
limit as the API takes them, no cursor), logs every request without any
secret, and switches the data endpoints to `hang` or `huge` through
`POST /__control/mode`. `POST /__control/seed` with `{"accounts": n, "domains": m}`
(0 to 500 each) makes the accounts and domains lists long enough to page:
accounts `seed-001` onwards, every fourth one declared in the configuration
file, and domains `d001.example.test` onwards, every third one switched off;
the reset takes them away. The per-account endpoints (`stand-in-api/accounts/`)
follow epistle's OpenAPI document: the display name, the password policy, TOTP,
masked addresses with a cap of three, the archive (only `admin` has one, the
others answer `404` like a server with retention off) and mailboxes. It keeps
its state in memory, `GET /__control/accounts` reports it, and it never keeps a
secret: a password is only counted.

The seeds are a handful of records, enough for a table and too few for a chart.
`POST /__control/sample` with `{"name":"busy"}` switches the delivery log, the
queue and the suppression list to a data set with a spread
(`stand-in-api/sample.ts`): 67 delivery records in 24 hours, 87 in 7 days and
127 in 30 days, which is more than one answer holds and is cut where the real
API cuts it (the newest UTC day first, the oldest record first inside a day);
ten queued messages with version 7 ids of several ages; fourteen suppressed
addresses of seven domains. `quiet` empties the three, `edge` holds the cases a layout breaks on (one
record, an id with no time in it, a domain far longer than a card) and `log-off` makes the
delivery log answer `404`, as a server with a retention of 0 days does.
Three more hold the cases a chart can lie on. `exact100` has exactly the 100
records one answer of the log holds, and a queue and a suppression list of
exactly the 500 the overview reads: nothing is missing, and the log cannot say
so. `flood` has 300 records in 24 hours, 620 queued messages and 640
addresses, more of each than is read. `skew` has hours of 60, 5 (one of each
outcome), 12, 2 and 8 records, each group ten minutes into an hour of the UTC
clock, to compare the heights of the columns.
`POST /__control/reset` puts the seeds back, and `POST /__control/forget`
empties the request log without touching the data.

## What the script proves

| Scenario | Proves |
|---|---|
| `headers` | CSP with a fresh nonce per request, no `unsafe-inline`, the nonce on every script tag (with or without attributes), the other headers, the cookie flags, no inline style on every page and on the 404 page, `X-Robots-Tag` on the login page, the pages and a static asset, the robots meta tag and no canonical, Open Graph or Twitter tag |
| `logout` | a replayed cookie gets the 404 from the proxy and from an action after logout, and reaches no API endpoint; the mail area redirects it; another session survives; logout goes to `/` |
| `limiter` | three free tries, then the lock; locked attempts never reach the API; another name signs in; the lock ends; a failure and a success each take at least 1 s |
| `limiter-global` | 60 failing names fill the global window and the 61st unknown name is refused; the admin, who signed in before, is still admitted. The cap of 8 concurrent API calls is covered by the unit tests, since parallel curl processes cannot make the count deterministic |
| `noauth` | the admin area, with the right id and without a session, with a garbage or altered cookie, with another UUID, an upper-case or truncated id, `/app` itself and the old unprefixed paths (and `/login`), answers the very 404 of a path that does not exist (same status, headers and body but the nonce), never a redirect, for a page and for a Server Action, and the stand-in sees nothing; `/` is the sign-in page without a session and forwards to `/app/mail` with one; `/app/mail` without a session goes to `/`; `/robots.txt` answers 200 with `Disallow: /` and its look-alikes (`/robots.txtx`, `/robots.txt/queue`, `/x/robots.txt`, `/ROBOTS.TXT`, `/app/robots.txt`) and `/sitemap.xml` are the 404 |
| `degraded` | a hanging API degrades the page within the 10 s budget and the server keeps answering; a body over the cap degrades quickly with bounded memory |
| `rotation` | replacing a `_FILE` secret does not change a running process, in any bundle; a restart picks it up |
| `idle` | idle CPU, and a memory ceiling after 400 requests |
| `body-limit` | a Server Action body over the 16 KB `experimental.serverActions.bodySizeLimit` in `next.config.ts` is refused before the action runs (the API sees no call), while the widest sign-in the form can send (about 4.1 KB, also with a 4 KB CAPTCHA-sized token) and a normal action are accepted |
| `captcha` | with the stand-in CAPTCHA provider on (the `custom` provider): off by default; the page carries the widget box and the public site key, never the secret or the verification URL; the sign-in page's CSP gains exactly the provider's origin in `script-src`, `frame-src` and `connect-src` and nothing else, no other response does; no token and an unsolved token are refused and the API is never asked, a solved one signs in; the provider is asked before the API; a missing site key, an unreadable secret file or an unknown provider refuse every sign-in, name the variable in the log and widen nothing; no log holds a token or a secret |
| `csrf` | a Server Action post with a valid session and a foreign `Origin` (or `Origin: null`) is refused by Next and the API sees no `DELETE`; the panel's own `Origin` is accepted. It also pins a measured dependency: a foreign `Origin` together with the same foreign `X-Forwarded-Host` passes Next's check and the action runs (see below) |
| `set-locale` | the `set-locale` action with an unknown, path-like, wrong-case or very long language answers `false` and writes no `locale` cookie; each supported language (read from `internal/src/i18n/locales`) writes it, and the queue page then renders with `<html lang>` and the heading of that locale; without a session the proxy redirects and nothing is written |
| `theme-choice` | the `theme` cookie alone decides what the server paints: `light` and `dark` put `data-theme` on the `<html>` of the sign-in page, the admin pages and the mail page, with no inline style and the same CSP; `system`, no cookie and a tampered value (another case, a neighbour, markup, an attribute break-out, 3000 characters) put none, and the page with a tampered cookie is the page of no cookie byte for byte but the nonce; the framed body of a message takes its `color-scheme` from `?theme=` in its own address, only `light` or `dark`, never from the cookie, and is still denied without a session; the `set-theme` action answers `false` and writes nothing for anything that is not a choice, writes the cookie (Secure, SameSite=Lax, Path=/, a year) for each choice read from `features/theme/config/choices`, for an admin and for a user, and without a session is the answer of a missing path |
| `profile-menu` | both headers are served with the profile button named for the account of the session, its initials and no picture; for a browser without script the banner keeps sign out as a plain form and, for an admin session only, the way into the administration as a plain link built with the id; a session that is not an admin's gets no link and the id is nowhere in its page; the plain form signs out |
| `unknown-variable` | a misspelt `EPISTLE_PANEL_` name is warned about in the startup log by name, the value is never printed, a name the panel reads (and the `_FILE` form of a secret) is not warned about, and the panel still serves |
| `suppression` | `/app/{id}/suppression` and its Server Action are the 404 without a session and the stand-in sees nothing; the first page, the encoded `after` cursor and the next link; a hostile `?after=` (`../`, `%2e%2e%2f`, line breaks, a bidi override, 300 characters, an injected parameter) is dropped and the first page is fetched; hostile action arguments (the same, an extra field, an empty or non-object argument) reach no `DELETE`; a valid removal sends the address as one percent-encoded path segment (the stand-in's seed holds a `/` and a `+`) and the address leaves the page |
| `deliveries` | `/app/{id}/deliveries` is the 404 without a session and the stand-in sees nothing; the unfiltered page asks the API once for 100 records; a reply with markup is printed as text; filters (`outcome`, `since`, `recipient`) reach the API encoded and narrow the page; hostile parameters (an unknown outcome, `../`, `1e9d`, a line break, an injected parameter, a bidi override, 300 characters, `limit`, `account`) are dropped and the unfiltered log is fetched; nothing but `GET` reaches the API |
| `account-detail` | `/app/{id}/accounts/[name]` and its actions: without a session every route and action is the 404 and the stand-in sees nothing; with one the page is rendered from the API (list, mailboxes, masked addresses, archive, each asked once, for that account only), carries no inline style and is `no-store`; an archive the server does not keep is a plain notice and no logged failure; hostile and unknown names (`..`, `%2f`, an encoded `..`, CR/LF, a look-alike or accented letter, upper case, `%00`) show the not-found page and reach no per-account endpoint; actions refuse a hostile name, address, id, password or display name before the API; display name, password, two-factor, masked create and remove (with the address percent-encoded), the masked cap and archive restore work; the password and the TOTP secret appear in no log, the secret only in the one answer that is `no-store`, and not in the page afterwards |
| `accounts` | creating and deleting an account: without a session, and with the session of a user who is not an admin, both actions are the 404 of a missing path and the stand-in sees nothing; the page offers a new account and names the actions of each row, with no inline style; hostile or malformed input (a name with a path, upper case, a short or non-ASCII password, no address, a line break in an address or a name, an extra field) is `invalid` before the API; the server's refusals (a leaked password, an address outside the hosted domains, a name in use) come back as a category without its words; creating works once, is not cached, lists the account and opens its page; past the server's limit is a conflict; deleting needs the queue choice, refuses a hostile one before the API, answers not-found for an account of the configuration file and leaves it, leaves queued mail with `drain` and drops it with `discard`; no password is in the panel's log or the stand-in's |
| `breadcrumbs` | every admin page is served with the trail to itself, the same in its loading state, sent first, and in the page: the administration linked with the id, the page as the one current step and no other link; no page is served with another page's heading or trail first; the account page links the administration and the accounts list and ends at the account; a name that is no account gets no trail; without a session there is no page and so no trail |
| `admin-id` | one sign-in for an admin and a non-admin, both sent to `/app/mail`, one cookie; the mail page offers the admin area to an admin only (the link is built with the id), never to a user, and the id is in no page or header a user gets; a user session with the right id gets the same 404 on a page and on a Server Action and the API sees nothing; an admin session with another id, an upper-case id, `/app` or an old path gets it too; a token whose payload role was edited to `admin` fails its signature; the id is in no public page, header, `robots.txt`, 404, public static file or log line; the id read from `EPISTLE_PANEL_ADMIN_ID_FILE` works and the previous one stops; with no id the start logs it and the admin area is off even for an admin; a malformed id (not a UUID, upper case, v1, v7, one character too long) stops the start with a message that names the variable and not the value |
| `mail` | `/app/mail`, its framed body route and its attachment route are denied without a session (to the sign-in page) and reach no endpoint; with one the inbox, a folder, a page, the filters and the search render; hostile parameters fall back to the default view; a subject and addresses with line breaks and bidi controls are text; a text body keeps its markup as text; the framed body of a hostile message (script, svg onload, css `url()`, meta refresh, base, `javascript:`, handlers, iframe, form, mutation payloads) carries none of it, under a `default-src 'none'` policy that only the panel may frame; remote images are blocked and load only with `?images=1`; attachments are downloads with a forced type and a clean name, and only a part the message lists; hostile ids answer 404 and cost no JMAP call; the change action is redirected without a session, refuses a hostile id, operation or folder before JMAP, and read, star, unstar, archive (new id), trash, delete from the trash, move and spam change the stand-in's mailbox as epistle would; the composer page renders with no inline style, a reply and a forward are prefilled from cleaned text (a hostile message's code never reaches the quote), a hostile id opens it empty; the compose and upload routes are redirected without a session and refuse a foreign, missing or null origin, a body that is not JSON and every hostile body before any JMAP call; a draft is stored from the account's own address with its Bcc, saving again replaces it, a 12 MB attachment arrives whole and 27 MB is refused, sending delivers to To and Bcc with the attachment, keeps a copy in Sent and removes the draft, and a send the server refuses answers a category without the server's words and keeps the work as a draft |
| `streaming` | with the stand-in API taking two seconds per answer (`POST /__control/delay`), every admin list page answers 200, sends its first byte at least a second before its data, carries a loading placeholder in that first part and still has a nonce in its policy; the data arrives later in the same response; with the delay off the page is quick again. A page with no `Suspense` around its data and no `loading.tsx` above it fails the first-byte check. The webmail sends its frame the same way; its folders are asked of the server once for the whole page, however many panes read them, and a view whose address names its folder does not wait for the folder tree (the stand-in logs the method names of a JMAP request, never its arguments) |
| `tables` | with 132 accounts and 61 domains seeded: the page holds the 25 rows of the first page and not the 26th, the range ("1–25 of 132"), one empty live region and no other, a named filter field, a named landmark with one button per page, the current one marked, previous marked as having nowhere to go, the page in words for a narrow window, the size select on 25 with its four options, the Filters button, and the origin or the state of each row in words, with no inline style; the API was asked for the list once; the queue and the suppression list have the API's own page link and neither page controls nor a Filters menu; the delivery log, whose five records fit one page, has its range and page size, no page controls and no Filters menu; the seed leaves with the reset. Pressing the controls is not covered here: paging and the facets are state in the browser, which curl does not run |
| `overview` | `/app/{id}` with a period is the 404 without a session and the stand-in sees nothing; with the busy sample the page carries four charts, each one image with a name and a description, drawn with `svg` marks sized by attributes that have no child, and no inline style; the counts and shares of the sample are in the HTML (67 records, 48 delivered at 71.6 %), the description says them in words, an outcome links to the log filtered by it and by the period; the two delivery cards read the log once between them and the queue and the suppression list once each, a page of 100; the status is read once between the counters and the notice of the page; `?since=7d` and `?since=30d` reach the API and the full answer of 30 days says the period may hold more, never that it does, and fills the days it may not have returned with a band of its own colour; with the `skew` sample the columns are as high as their totals on the scale (160, 32 and 21.33 px for 60, 12 and 8 records, and parts of 2.67 px with no gap for 5 and 2) and a column names its split by outcome; a queue and a list of exactly 500 are whole, longer ones count what was read in every sentence; with the API failing every read the page gives one warning with a plain link to the same address and each card says it was not loaded; hostile periods (`1e9d`, a line break, `../`, markup, upper case, a period the log takes but no chart draws, an injected parameter) render the default period and never reach the API; with the API answering in 300 ms, twelve answers carry no style attribute (a chart drawn with `svg` children failed this in about half the answers, see `charts.md`); a log switched off, an empty queue, an empty list and a period with no record each say so in place of a chart; nothing but `GET` reaches the API |
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

**What a browser sends on a form it posts itself depends on the page's
`Referrer-Policy`.** Measured on 2026-11-13 in Chromium with script off: under
`no-referrer` the sign-in form went out with `Origin: null` and was refused
(500, the third row above), so the sign-in and the sign-out, which are written
to work without script, did not. The scenarios never saw it: they post with
curl, which sends no `Origin` unless told to (the first row). The panel's pages
now send `Referrer-Policy: same-origin`, under which the browser sends the
panel's own origin to the panel and still nothing to another site. The `csrf`
scenario posts the sign-in form both ways. The framed message body and the
attachment download keep `no-referrer`: what they hold came from outside.

A hostile account name answers the panel's not-found page with status 200, not
404. The admin shell is streamed before the page resolves (`loading.tsx`), so a
`notFound()` thrown by the page cannot change the status (measured on Next
16.4.6). The scenario tells it apart by the body and by the stand-in log.

## What it does not cover

- **A real browser.** Everything above is `curl` against the standalone
  server. Hydration, the console, CSP violations reported by the browser,
  tooltips, focus and the sheet's behaviour are the manual list below. The
  unit test `src/test/overlays-inject-no-style` only checks that opening the
  profile menu, the theme menu, the sheet and the remove confirmation adds no `<style>` to
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

1. Open `http://127.0.0.1:<port>/` and `http://localhost:<port>/` (the sign-in page).
   Sign in as `admin` / `correct-horse`. In Chromium both origins count as
   secure, so the `__Host-` cookie is stored (Secure, HttpOnly, Path=/,
   SameSite=Lax, no Domain). Over plain HTTP on any other host name the browser
   drops it and sign-in does not stick. Firefox and Safari were not checked here; Firefox is documented as accepting
   the cookie on `http://localhost` (see the README).
2. Visit `/` (it must land on `/app/mail`), follow the Administration link, then `accounts`, `domains`, `queue`, `suppression` and `deliveries` under `/app/{id}`: the console must show no CSP
   violation and no error, and the login form must be hydrated (a failed
   sign-in shows the alert without a page reload).
3. On `/app/{id}/queue` press Remove and accept the confirmation: the entry disappears
   and the stand-in log shows one `DELETE`.
4. Set the cookie `locale` to each language in turn (`es`, `pt`, `fr`, `de`, `it`) and
   reload: the headings are in that language and `<html lang>` matches.
5. Visit an unknown path while signed in, and `/app/<another UUID>/queue`: the
   panel's own 404 page, the same for both, with no inline-style violation.
6. Open the profile menu in the header and choose Sign out: the page goes to
   `/` and the session cookie is gone.
7. Theme: with the system on light, choose Dark from the theme button (the page
   turns dark with no reload), reload (no light frame first), choose System
   (it follows the browser again). Open a message with an HTML body: its frame
   is in the chosen theme. Repeat from the keyboard: Enter on the button puts
   the focus on the first item, the arrows move, Enter chooses, Escape closes
   and the focus returns to the button.
8. Sidebar: collapse it with the toggle or Ctrl+B and hover an icon (a tooltip
   names it); open the profile menu in the header and pick another language (the page re-renders in
   it); narrow the window below 768 px, open the sheet with the toggle,
   press Escape (focus returns to the toggle) and follow a link (the sheet
   closes). In every step the console must show no CSP violation. A violation
   listener (`document.addEventListener("securitypolicyviolation", ...)`
   installed before the page loads) catches the ones the console shows late.
8. Tables: `curl -X POST <stand-in>/__control/seed -d '{"accounts":129,"domains":60}'`,
   then on `accounts`: Next shows other rows and the range moves to 26–50 of
   132; a page number, the size select, a sort and the text filter each change
   the rows, and the last three go back to the first page; Enter on Next up to
   the last page keeps the focus on Next; Filters opens with Enter on its
   first box, Space ticks a box, the menu stays open and only matching rows are
   left, Escape returns the focus to the button; a text with no match offers
   "Clear filters", which brings the rows back and focuses the filter field.
   The unit tests do not run React Compiler, so this is where a part that
   shows stale rows would be seen.

## Measured on 2026-11-12 (Node 24, Next 16.4.6)

- Failed sign-in: 1.0 to 1.4 s.
- Idle: about 120 MiB resident, no CPU. After 1200 requests in a manual run
  resident memory peaked near 350 MiB and fell back to about 190 MiB once idle, so it is
  garbage-collector headroom, not growth. The container has no heap cap; set
  one (`NODE_OPTIONS=--max-old-space-size`) if its memory limit is tight.
- A 64 MiB streamed body is cut at the 5 MiB cap; memory grew by about 26 MiB.
