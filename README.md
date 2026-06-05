# mail-panel

Admin panel for the [Glyndor mail server](https://github.com/Glyndor/mail) — domains, accounts, email security and queues on top of its management API.

[![CI](https://github.com/Glyndor/mail-panel/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/Glyndor/mail-panel/actions/workflows/ci.yml)

> 🚧 Early development. The foundation is in place; feature views are on the way.

## 🧱 Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [next-intl](https://next-intl.dev) — English and Spanish ship together
- Typed [mail API](https://github.com/Glyndor/mail) client with [zod](https://zod.dev)-validated responses; the bearer token stays server-side
- Biome (lint + format), vitest

## 🚀 Development

```sh
npm ci
npm run dev
```

Point the panel at a running mail server with:

```sh
export MAIL_API_URL="http://127.0.0.1:8025"
export MAIL_API_TOKEN="<token>"
```

Checks: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

## License

[Apache-2.0](LICENSE)
