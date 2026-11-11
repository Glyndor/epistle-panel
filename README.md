# epistle-panel

Admin panel for the [Epistle mail server](https://github.com/Glyndor/epistle) — domains, accounts, email security and queues on top of its management API.

[![CI](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml)

> 🚧 Early development. The foundation is in place; feature views are on the way.

## 🧱 Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [next-intl](https://next-intl.dev) — English and Spanish ship together
- Typed [Epistle API](https://github.com/Glyndor/epistle) client with [zod](https://zod.dev)-validated responses; the bearer token stays server-side
- Biome (lint + format), `bun test`

## 📦 Install

The panel ships in two forms. Neither is published yet: both are built in CI and
the release pipeline that publishes them is still to come.

- **apt package.** `epistle-panel` is a podup stack fragment, not the application.
  It depends on `epistle` and `podup`, and installs a `compose.yaml` under
  `/usr/share/glyndor/epistle-panel/` that pins the container image to the package
  version, plus the `glyndor-epistle-panel` account and the directories under
  `/etc/glyndor/epistle-panel/` and `/var/lib/glyndor/epistle-panel/`. It generates
  the session secret on first install. The epistle API token is not generated: put
  it in `/etc/glyndor/epistle-panel/secrets/epistle_api_token`. The panel listens on
  `127.0.0.1:7587` only. See `debian/README.Debian` for the details.
- **Container image.** `ghcr.io/glyndor/epistle-panel`, built from the `Containerfile`
  at the repository root. It runs as uid 65532 and listens on port 7587. It is the
  only place the application runs; the apt package contains no Node runtime.

TLS is not the panel's job: put your own proxy in front of port 7587.

## 🚀 Development

```sh
cd internal
bun install
bun run dev
```

Point the panel at a running Epistle server with:

```sh
export EPISTLE_API_URL="http://127.0.0.1:8025"
export EPISTLE_API_TOKEN="<token>"
export EPISTLE_PANEL_SESSION_SECRET="<random 32+ byte secret>"
```

Admins sign in with a mail account listed under `[api] admins` on the server;
the panel verifies credentials against Epistle and signs the session cookie with
`EPISTLE_PANEL_SESSION_SECRET`. Without that secret set, every route stays locked
(fail-closed).

Checks, from `internal/`: `bun run lint` · `bun run typecheck` · `bun test` · `bun run build`

## License

[MIT](LICENSE)
