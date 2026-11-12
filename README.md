# epistle-panel

Admin panel for the [Epistle mail server](https://github.com/Glyndor/epistle) — domains, accounts, email security and queues on top of its management API.

[![CI](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Glyndor/epistle-panel/actions/workflows/ci.yml)

> 🚧 Early development. The foundation is in place; feature views are on the way.

## 🧱 Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [next-intl](https://next-intl.dev) — English and Spanish ship together
- Typed [Epistle API](https://github.com/Glyndor/epistle) client with [zod](https://zod.dev)-validated responses; the bearer token stays server-side
- Biome (lint + format), `bun test`

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

Checks, from `internal/`: `bun run lint` · `bun run typecheck` · `bun test` · `bun run build`

## License

[MIT](LICENSE)
