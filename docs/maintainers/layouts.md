# Layouts and navigation

The panel is one Next.js app that will host two products: the administration
panel and the end-user webmail. They are split by route and by role, and the
webmail can be added without reworking what is here.

## Route groups

| Group | Holds | Frame |
|---|---|---|
| `(auth)` | `/login` | `(auth)/layout.tsx`: a bare `main`, no navigation |
| `(admin)` | `/app`, `/app/domains`, `/app/accounts`, `/app/queue`, `/app/deliveries`, `/app/suppression`, `/app/accounts/[name]` | `(admin)/layout.tsx`: checks the session, then `AppShell` with the admin navigation |
| `(mail)` | not built yet | will bring its own layout; see below |

Group names are not part of a URL, so adding `(mail)` changes no existing
address. Do not add empty routes in advance. The webmail's prefix is `/m`
(`/m/user` in English, `/m/usuario` in Spanish); an admin session and a user
session are different, and a user surface never reaches an admin route: every
page and Server Action checks its own session, whatever the navigation lists.

## Navigation is data

`features/navigation/config/items` is the list of entries (path, icon name,
label key, group, roles). `queries/nav-for-role` returns the groups a role sees
and drops every entry whose roles do not include it. The sidebar knows no
route: `AppShell` and `AppSidebar` take the groups as props. To add a page,
add an entry (and its icon name and label keys to the schema and the `nav`
messages) and the route; the shell needs no change. An entry's href must be an
absolute in-app path, which `schemas/nav-item` enforces, and a route that exists
in the app tree: `typedRoutes` types it as `Route`, so an entry added before its
page fails `bun run typecheck` and `bun run build` (`typecheck` runs
`next typegen` first, which writes the route types in `.next/types`).

Everything that needs a session lives under `/app` (owner decision); outside it
only `/login`, `/robots.txt` and the operator's public assets answer without one.
`/` is the one path outside that forwards to `/app` (`app/page.tsx`), where the
proxy asks for the session. `lib/routes` holds the paths in one place:
`ROUTES` for the signed-in pages, `PUBLIC_ROUTES` for `/` and `/login`, and
`isSessionPath`, which the proxy uses to decide what needs a session (`/app`
and everything under it, read as a router might read it: decoded, any case,
repeated or backslash separators). No link, redirect or navigation entry spells
a path out; they all take it from there. The sign-in form has no `next` or
return-to parameter, so the destination after sign-in is always `ROUTES.home`.
`/app/accounts/[name]` is reached from the accounts table and is not a sidebar
entry; the Accounts entry is marked on it, as the page of `/app/accounts`. Its
`not-found.tsx` in the `(admin)` group renders inside the shell without a second
`main` landmark. The proxy matcher stays wide so every page, public or not,
gets the nonce-bearing CSP; the session check is not in the matcher but in the
proxy function, and the Server Actions still check the session themselves.

## The shell and its contract

`components/layout/app-shell` draws the skip link, the sidebar, the header and
the single `main` landmark. A surface that needs a different frame, such as the
webmail's folder tree, message list and reader, does not extend it. It renders
its own layout from the parts in `components/ui/sidebar` (the provider, the
rail and its regions are separate leaves) and keeps the same rules:

- one `main` landmark, and the skip link is the first focusable element;
- each region is a named landmark, so no control sits outside one;
- no inline `style`: widths and positions are classes, CSS variables are set
  with Tailwind's `[--name:value]`, and an overlay is measured in the built
  server for CSP violations (see `shadcn.md`);
- 32 px controls on a fine pointer, 44 px on a coarse one.
