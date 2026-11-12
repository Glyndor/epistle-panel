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

## License

[MIT](LICENSE)
