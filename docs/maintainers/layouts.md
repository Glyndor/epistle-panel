# Layouts and navigation

The panel is one Next.js app that will host two products: the administration
panel and the end-user webmail. They are split by route and by role, and the
webmail can be added without reworking what is here.

## Route groups

| Group | Holds | Frame |
|---|---|---|
| `(auth)` | `/login` | `(auth)/layout.tsx`: a bare `main`, no navigation |
| `(admin)` | `/`, `/domains`, `/accounts`, `/queue` | `(admin)/layout.tsx`: checks the session, then `AppShell` with the admin navigation |
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
