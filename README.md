# epistle-panel

Admin panel for the [Epistle mail server](https://github.com/Glyndor/epistle): server status, domains, accounts and queues on top of its management API.

[![CI](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml)

> 🚧 Early development. The status, accounts, domains and queue views work; the rest of the management API is not covered yet.

## 🧱 Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [next-intl](https://next-intl.dev): English and Spanish ship together
- Typed [Epistle API](https://github.com/Glyndor/epistle) client with [zod](https://zod.dev)-validated responses; the bearer token stays server-side
- Biome (lint + format), `bun test`

## 📦 Install

The panel is meant to run only as a service of the stack that
[epistle](https://github.com/Glyndor/epistle) generates. There is no standalone
compose file. It ships in two forms, neither published yet: `.github/workflows/release.yml` builds both when a `v*` tag is
pushed, and no release exists so far. See [docs/maintainers/releasing.md](docs/maintainers/releasing.md).

- **Container image.** `ghcr.io/glyndor/epistle-panel`, built from the `Containerfile`
  at the repository root. It runs as uid 65532 and listens on port 7587. The
  application runs here and nowhere else.
- **apt package.** `epistle-panel` is a thin package with no Node runtime and no
  application code. It depends on `epistle`, `podup` and `glyndor-archive-keyring`
  and installs two files: `/usr/share/glyndor/epistle-panel/image`, naming the
  image tag that matches the package version, and
  `/usr/share/glyndor/epistle-panel/README`, saying what that file is for. The
  design is that epistle reads the image file to add the panel to its stack, but
  the epistle release that does so does not exist yet, so installing the package
  changes no running stack today; see `debian/README.Debian`. The package
  creates no account, no directory outside `/usr/share` and no secret.

TLS is not the panel's job: put your own proxy in front of it.

### Reverse proxy requirements

The panel sets its own security headers (a Content-Security-Policy with a
per-request nonce and `frame-ancestors 'none'`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), so the
proxy in front of it has nothing to add and should not strip them. It does not
set `Strict-Transport-Security`: that header belongs to the proxy that
terminates TLS.

Your proxy must **overwrite** `X-Forwarded-Host` and `X-Forwarded-Proto` with
the values it saw, never pass through what the client sent. Next derives the
request's origin from them, and its Server Action origin check compares the
`Origin` header against that same host. Set `Host` to the public name too, and
send both headers on every request, for example in nginx:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

`scripts/headers/verify.sh` (the port is `PORT`, default 7598) starts the built standalone server and asserts the
headers, and that a hostile `Host` or `X-Forwarded-Host` never reaches the
redirect's `Location`, against real HTTP. Run it after `bun run build` in
`internal/`.

## 🚀 Development

```sh
cd internal
bun install
bun run dev
```

The dev server listens on `http://localhost:3000`. Point the panel at a running
Epistle server with (`EPISTLE_API_URL` defaults to `http://127.0.0.1:8025`):

```sh
export EPISTLE_API_URL="http://127.0.0.1:8025"
export EPISTLE_API_TOKEN="<token>"
export EPISTLE_PANEL_SESSION_SECRET="<random 32+ byte secret>"
```

Admins sign in with a mail account that the Epistle server reports as an admin.
The panel verifies the credentials against Epistle and signs the session cookie
with `EPISTLE_PANEL_SESSION_SECRET`. Without that secret set, every route stays locked
(fail-closed).

### Secrets from files

`EPISTLE_API_TOKEN` and `EPISTLE_PANEL_SESSION_SECRET` also have a `_FILE` form
that points at a file holding the secret, which is how container secrets are
mounted (for example under `/run/secrets/`):

```sh
export EPISTLE_API_TOKEN_FILE="/run/secrets/epistle_api_token"
export EPISTLE_PANEL_SESSION_SECRET_FILE="/run/secrets/epistle_panel_session_secret"
```

- When both forms are set, the `_FILE` form wins.
- Trailing whitespace, such as the final newline, is stripped from the file content.
- A `_FILE` variable that is set but points at a missing, unreadable or empty
  file is an error. The panel never falls back to the plain variable in that
  case: a missing session secret locks every route and a missing API token
  fails every API call.
- Error messages name the variable, never the path or the content.
- The path must be absolute and name a regular file of at most 64 KiB; a symlink
  is refused. The value is read once per process, so rotate a secret by
  restarting the service.

### API address

`EPISTLE_API_URL` must be a bare `http` or `https` origin: no credentials, path,
query or fragment. Link-local and metadata addresses (`169.254.0.0/16`,
`fe80::/10`) are refused. Plain `http` is accepted for a loopback host only; for
another host use `https`, or list the host in `EPISTLE_API_ALLOW_HTTP_HOSTS`
(comma separated) when the link is already private, for example over WireGuard.
An invalid value makes every API call fail without sending a request.

### Sessions and sign-in limits

- The session cookie is named `__Host-epistle_admin_session` and is always
  `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` with no `Domain`. The `__Host-`
  prefix requires `Secure`, so the cookie does not depend on `NODE_ENV`. Serve
  the panel over HTTPS, normally terminated by your reverse proxy. Chrome and
  Firefox are documented as accepting it on `http://localhost`, which keeps
  `bun run dev` working; over plain HTTP on any other host the browser drops the
  cookie and sign-in does not stick. Only Chromium was checked here (see
  [docs/maintainers/e2e.md](docs/maintainers/e2e.md)); Safari and Firefox were not.
- Sessions last 8 hours. Signing out revokes the token on the server, not only
  in the browser. The revocation list lives in the memory of one panel process:
  it is lost on restart and not shared between replicas, so run a single
  instance. After a restart a token revoked earlier is accepted again until it
  expires. The list holds at most 10,000 entries; past that, the entry that
  expires first is dropped, so the revocations with the most life left are the
  last to go. Reaching the cap takes 10,000 sign-outs inside one session
  lifetime, after which a dropped token verifies again until it expires.
- Sign-in attempts are limited in memory, per process, before the API is called,
  and the limiter does not read forwarded client-address headers. The Epistle API
  has its own failed-authentication limiter, which currently sees one address for
  all panel traffic; forwarding the admin's address to it is a separate change in
  Epistle. Three limits apply:
  - Per account name, in chains. Three free tries, then a lock that doubles
    (2 seconds and up). A chain starts with the first attempt and lasts 15
    minutes: no lock ends later than the chain, a lock is never renewed, and
    afterwards the name starts from a clean count. The right password is refused
    while a lock holds, and the lock ends. About a dozen attempts per name pass
    in each chain.
  - Globally, 60 failed attempts per minute across all names. Only failures
    count. Once the ceiling is hit, names that signed in during this process in
    the last 8 hours still get through, subject to their own lock.
  - At most 8 attempts wait on the API at once, for every name.
  What an attacker can still do: keep 60 failing attempts per minute going to
  refuse every name that has not signed in during this process, for example the
  first sign-in after a restart, for as long as the flood lasts; fail one name
  enough times to lock it for the rest of its chain (up to 15 minutes); and,
  by sending a request the moment a name's chain restarts, keep that name locked
  across chains. A limiter keyed by name cannot rule that last case out; closing
  it takes a second factor or a client address from a trusted proxy.
- Every sign-in takes at least one second, whatever the outcome, so an unknown
  account, a wrong password and a success look alike by time. That only holds
  while the API answers within the floor, and the real API's password hash time
  was not measured. Set `EPISTLE_PANEL_LOGIN_MIN_MS` (whole milliseconds, 0 to
  30000) to raise or lower it; a value that does not parse, or one above 30000, keeps the default.
- A render error shows the panel's own error page (translated, no inline
  styles), not Next's built-in one, which the Content Security Policy would
  leave unstyled.

## Contributing

Branch from `develop` and open the pull request against `develop`. The
Next.js project lives in `internal/`, so every command runs from there:

```sh
cd internal
bun run lint
bun run typecheck
bun test
bun run build
```

The Debian package has its own checks, run by the `Debian package` workflow:
`scripts/debian/build.sh <output-dir>` builds and lints the `.deb` in a Debian
container, and `scripts/debian/smoke.sh <path-to-.deb>` installs it there.
Both need podman or docker. `BUILD_IMAGE` and `SMOKE_IMAGE` replace the Debian
image they use, `docker.io/library/debian:trixie` by default.

`scripts/e2e/run.sh` checks the built server against a stand-in API
(see [docs/maintainers/e2e.md](docs/maintainers/e2e.md)); the `End-to-end` workflow
runs it, and `scripts/headers/verify.sh`, on pull requests that touch the code it
exercises.

Other workflows run only when their answer can change: `Container` (the image
inputs), `Debian package` (the package inputs), `Dependency audit` (lockfile or
manifest, plus weekly), `actionlint` (workflow files), `Bun version` (one Bun
release across the workflows and the Containerfile) and `Dependabot security
watch`. `Line limit` runs when a `.ts` or `.tsx` file changes. `DCO` runs on
every pull request into `main` or `develop`, and `guard` on every pull request
into `main`. `Release` runs on a `v*` tag.

## License

[MIT](LICENSE)
