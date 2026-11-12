# End-to-end checks

Unit tests run the proxy, the pages and the actions as separate modules in one
test process. The built standalone server bundles them separately, so some
behaviour only shows on the real thing. `scripts/e2e/` checks it.

## Running

```sh
cd internal && bun run build && cd ..
scripts/e2e/run.sh              # every scenario, about 40 s
scripts/e2e/run.sh noauth idle  # some of them
bun test scripts/e2e            # the stand-in API's own tests
```

It needs bash, node, bun and curl, uses only 127.0.0.1 and picks free ports
(`PANEL_PORT` and `STAND_IN_PORT` override them). It is not part of the default
CI. A workflow that fits it would run on pull requests that touch
`internal/src/lib/auth/**`, `internal/src/proxy.ts`, `internal/next.config.ts`,
`internal/src/lib/config/**` or `scripts/e2e/**`, build the panel and call the
script.

`scripts/e2e/stand-in-api/` answers the paths the panel calls, validated
against the panel's own zod schemas in its test. It knows the accounts `admin`
and `ops` (admins) and `user` (not an admin), logs every request without any
secret, and switches the data endpoints to `hang` or `huge` through
`POST /__control/mode`.

## What the script proves

| Scenario | Proves |
|---|---|
| `headers` | CSP with a fresh nonce per request, no `unsafe-inline`, the nonce on every script, the other headers, the cookie flags, no inline style on every page and on the 404 page |
| `logout` | a replayed cookie is refused by the proxy and by an action after logout, and reaches no API endpoint; another session survives |
| `limiter` | three free tries, then the lock; locked attempts never reach the API; another name signs in; a failure takes 1 s |
| `limiter-global` | 70 parallel attempts with 70 names: exactly 60 reach the API |
| `noauth` | every route and Server Action is redirected without a session, with a garbage or altered cookie, and the stand-in sees nothing |
| `degraded` | a hanging API degrades the page within the 10 s budget and the server keeps answering; a body over the cap degrades quickly with bounded memory |
| `rotation` | replacing a `_FILE` secret does not change a running process, in any bundle; a restart picks it up |
| `idle` | idle CPU and memory after 200 requests |

## Browser checks (manual)

Start the stand-in and the standalone server by hand (see the top of
`scripts/e2e/run.sh` for the variables), then use a Chromium-based browser with
the console open.

1. Open `http://127.0.0.1:<port>/login` and `http://localhost:<port>/login`.
   Sign in as `admin` / `correct-horse`. In Chromium both origins count as
   secure, so the `__Host-` cookie is stored (Secure, HttpOnly, Path=/,
   SameSite=Lax, no Domain). Over plain HTTP on any other host name the browser
   drops it and sign-in does not stick. Safari and Firefox were not checked.
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

## Measured on 2026-11-12 (Node 24, Next 16.4.6)

- Failed sign-in: 1.0 to 1.4 s.
- Idle: about 120 MiB resident, no CPU. After 1200 requests resident memory
  peaked near 350 MiB and fell back to about 190 MiB once idle, so it is
  garbage-collector headroom, not growth. The container has no heap cap; set
  one (`NODE_OPTIONS=--max-old-space-size`) if its memory limit is tight.
- A 64 MiB streamed body is cut at the 5 MiB cap; memory grew by about 26 MiB.
