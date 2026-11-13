# Layouts and navigation

The panel is one Next.js app that hosts two products with their own areas, their
own layouts and their own bundles: the end-user mail client and the
administration panel. One sign-in serves both, and one session cookie carries the
role.

## Areas

| Area | Path | Who | Frame |
|---|---|---|---|
| Sign-in | `/` (`(auth)/page.tsx`) | anyone without a session; a visitor with one is sent to `/app/mail` | `(auth)/layout.tsx`: a bare `main`, no navigation |
| Mail | `/app/mail` (`app/app/mail`) | a session of any role | `mail/layout.tsx`: checks the session, then its own frame (header with the way into the admin for an admin session, one `main`, three named panes); `/app/mail/body/[id]` and `/app/mail/attachment/[id]/[part]` are its route handlers. See `mail.md` |
| Admin | `/app/{id}/...` (`app/app/[adminId]`) | a session with the admin role, and the installation's id | `[adminId]/layout.tsx`: checks the role and the id, then `AppShell` with the admin navigation |

`{id}` is a UUID v4 that belongs to the installation (`EPISTLE_PANEL_ADMIN_ID`).
It is one more layer of obscurity, not a secret: the session and the role are the
barrier. Without the variable the admin area is off. Everything that does not
answer is one 404 (see "How the 404 stays one" below).

The two areas never share a layout, so the admin shell does not load the mail
area's code and the reverse. The mail frame is its own (`app/app/mail/layout.tsx`, three panes, no sidebar) and
does not touch the admin tree. There is one session and no separate admin cookie: the role
(`admin` or `user`) is signed into the token at sign-in from the epistle API's
`/auth/verify` answer, and each admin page, each admin Server Action
(`lib/query/run-action`) and the proxy read it again from the token. A `user`
session never opens an admin page, and a token whose role was edited fails its
signature. The role is not asked again of the API, so a demoted account keeps it
until the session ends.

## Navigation is data

`features/navigation/config/items` builds the list of entries (path, icon name,
label key, group, roles) from the admin paths, `navItems(routes)`.
`queries/nav-for-role` returns the groups a role sees and drops every entry whose
roles do not include it. The sidebar knows no route: `AppShell` and `AppSidebar`
take the groups and the home link as props. To add a page, add an entry (and its
icon name and label keys to the schema and the `nav` messages) and the route; the
shell needs no change. An entry's href must be an absolute in-app path, which
`schemas/nav-item` enforces, and a route that exists in the app tree: `typedRoutes`
types it as `Route`, so an entry added before its page fails `bun run typecheck`
and `bun run build` (`typecheck` runs `next typegen` first, which writes the route
types in `.next/types`).

## Paths

`lib/routes` holds every path in one place and is pure, so a client component can
import it: `PUBLIC_ROUTES` (`/` and `/app/mail`), `adminRoutes(id)` (the admin
paths and `accountDetail(name)`, built from the id and refused for anything that
is not a UUID v4) and `classifyAppPath`, which the proxy uses. No link, redirect or
navigation entry spells a path out. Reading the configured id is a separate,
server-only module, `lib/config/admin-id`. A server component gets the paths from
`requireAdmin()`; a client component from `useAdminRoutes()`, whose provider the
admin layout mounts with the id it already checked, so the id reaches the browser
only inside pages served to an admin session. The sign-in form has no `next` or
return-to parameter: the destination after sign-in is always `/app/mail`, and an
admin follows the link there.

`/app/{id}/accounts/[name]` is reached from the accounts table and is not a
sidebar entry; the Accounts entry is marked on it, as the page of
`/app/{id}/accounts`. Its `not-found.tsx` in `[adminId]` renders inside the shell
without a second `main` landmark.

## How the 404 stays one

The proxy lets four things on to the router: `/`, `/app/mail` with a session,
`/app/{id}/**` with a session of the admin role and the right id, and the
assets its matcher skips. Everything else, which is a path no route has, `/app`,
the admin area for someone who may not see it and any other id, is rewritten to
one fixed path (`HIDDEN_PATH`) that no route has, so Next renders its 404 for it.
Since they all end up on that path, the bodies and the headers are equal apart
from the CSP nonce: a path that does not exist and the admin area seen from
outside cannot be told apart. (A rewrite to a different path per request would
not do: the page's own payload names the path it answered. A `notFound()` from a
layout would not do either: the shell streams first, so the status is 200.) The
id is compared in constant time, in the proxy and again in the admin layout, and
`requireAdmin` ends every admin page and Server Action in the same 404 when the
role is missing or the area is off. `scripts/e2e/scenarios/noauth.sh` compares the
bytes on a real server.

The proxy matcher stays wide so every page, public or not, gets the nonce-bearing
CSP; the decision is in the proxy function, not in the matcher, and the pages and
Server Actions still check the role themselves.

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
