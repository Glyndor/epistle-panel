# epistle-panel

Admin panel for the [Epistle mail server](https://github.com/Glyndor/epistle): domains, accounts, email security and queues on top of its management API.

[![CI](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml)

> 🚧 Early development. The foundation is in place; feature views are on the way.

## 🧱 Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [next-intl](https://next-intl.dev): English and Spanish ship together
- Typed [Epistle API](https://github.com/Glyndor/epistle) client with [zod](https://zod.dev)-validated responses; the bearer token stays server-side
- Biome (lint + format), `bun test`

## 📦 Install

The panel runs only as a service of the stack that [epistle](https://github.com/Glyndor/epistle)
generates. There is no standalone compose file. It ships in two forms, neither
published yet: `.github/workflows/release.yml` builds both when a `v*` tag is
pushed, and no release exists so far. See [docs/maintainers/releasing.md](docs/maintainers/releasing.md).

- **Container image.** `ghcr.io/glyndor/epistle-panel`, built from the `Containerfile`
  at the repository root. It runs as uid 65532 and listens on port 7587. The
  application runs here and nowhere else.
- **apt package.** `epistle-panel` is a thin package with no Node runtime and no
  application code. It depends on `epistle` and `podup` and installs one file,
  `/usr/share/glyndor/epistle-panel/image`, naming the image tag that matches the
  package version. epistle reads it to add the panel to its stack. The package
  creates no account, directory or secret. Adding the service to a running stack
  needs an epistle release that reads that file; see `debian/README.Debian`.

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

`scripts/headers/verify.sh` starts the built standalone server and asserts the
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
Both need podman or docker.

Other workflows run only when their answer can change: `Dependency audit`
(lockfile or manifest, plus weekly), `actionlint` (workflow files), `Bun
version` (one Bun release across the workflows and the Containerfile) and
`Dependabot security watch`. None of them is a required check.

## License

[MIT](LICENSE)
