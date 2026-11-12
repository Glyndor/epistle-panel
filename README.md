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

The panel runs only as a service of the stack that [epistle](https://github.com/Glyndor/epistle)
generates. There is no standalone compose file. It ships in two forms, neither
published yet: both are built in CI and the release pipeline is still to come.

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
