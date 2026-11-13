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

## Breadcrumbs

Every admin page draws the trail to itself above its heading, with
`AdminBreadcrumbs` (`features/navigation/components/admin-breadcrumbs`): the
administration, the page and, on a page about one thing (an account), that
thing. `queries/admin-trail` builds it from the admin routes and the key of the
page's navigation label, so a trail cannot name a path the panel does not have
and the name of the thing is never part of an address. The last step is the
current page (`aria-current="page"`, not a link).

A page passes the routes it got from `requireAdmin()`. Its `loading.tsx` is
given no parameters, so it takes them from `queries/loading-routes` and renders
the same call: the trail is in the first paint and does not move when the page
arrives. The account page's loading state does not know the account, so a bar
holds the place of the last step. To add a page, add its navigation entry (the
trail reads the same label) and render `AdminBreadcrumbs` in the page and in
its `loading.tsx`; `streaming.test.tsx` compares the two.

A `loading.tsx` is the first paint of every page in the folders below it, not
only of the page beside it. So a page that has other pages below it (the status
page at the root of the area, the accounts list above the account page) lives
in a route group, `(status)` and `accounts/(list)`, with its own `loading.tsx`.
Before that, measured in Chromium against the built server, a load of the
domains page painted the Status heading first. `streaming.test.tsx` fails when
a loading state sits above a page that is not its own.

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

## The header's far end

`components/layout/header-actions` is the far end of both headers, the admin
shell's and the webmail's: the theme button and the profile menu. It is one
component, so the two areas cannot drift. The profile menu
(`components/layout/user-menu`, its Radix code loaded on the first press) shows
what the layout read from the session and nothing else: the account's name,
its initials and its role, then the language, the theme, the way into the
administration and sign out. The address of the administration is built on the
server and handed down only for an admin session in an installation whose
admin area is on; the menu never derives it from the role.

One choice is stored at a time: while the language or the theme is on its way
to the server the button is marked busy and looks it, and the items wait.

The menu needs script. Sign out and the way into the administration are also
in the served page as a plain form and a plain link, inside a `noscript`, so a
browser without script keeps both.

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

## Theme

Light, dark or the system's, chosen from the theme button of each header
(`features/theme/components/theme-switcher`). The choice lives in the `theme`
cookie and nowhere else:

- `features/theme/config/choices` is the one list (`system`, `light`, `dark`).
- The root layout is the only reader of the cookie (`queries/theme-choice`).
  It writes `data-theme="light"` or `data-theme="dark"` on `<html>`; for
  `system`, no cookie or a value that is not exactly a choice there is no
  attribute. The server paints it because the policy allows no inline script
  that could set it before the first frame: a reload shows no other theme
  first.
- `styles/theme.css` holds the dark values for both ways of getting them (the
  browser prefers dark and light was not chosen, or dark was chosen) and a test
  keeps the two lists equal. It also sets `color-scheme`, so the list of a
  native select and the scrollbars follow. The framed body of a message is
  another document: the frame's address carries the pinned theme (`?theme=`,
  parsed again by the route) and the body writes it into its own
  `color-scheme`, so a change of theme loads the frame again in the new one.
- The button changes the attribute at once and calls the `set-theme` Server
  Action, which checks the session, parses the value with the same schema and
  writes the cookie (Secure, SameSite=Lax, a year; not HttpOnly, so
  `global-error`, which replaces the document, can read it in the browser).
  When the action refuses, the previous theme comes back and a toast says so.
- Every control that shows the theme reads the attribute
  (`hooks/use-theme-choice`), so two of them on one page cannot disagree. While
  a client component is rendered on the server there is no document to read:
  the root layout hands the choice down through `ThemeChoiceProvider`.

## Server first, streamed

A page is a Server Component. It checks the session, paints its heading and
puts the part that waits for the API inside `Suspense` with a skeleton of the
same shape as the view that is coming (`components/skeletons/`, and one per
feature where the view has its own shape), so the frame and the heading leave
before the API answers. Each route also has a `loading.tsx` with that skeleton
for the navigation between pages. `PrefetchBoundary` is the part that waits: it
runs the page's queries on the server and hands the result to the client
components below it.

`"use client"` goes on the smallest component that needs state, an effect, an
event handler or a browser API, never on a page or a layout. A table's rows, a
section's text and a skeleton stay server components; the button, the form and
the menu inside them are the client leaves.

The account page is the one exception to "paint first": it reads the accounts
list before it sends anything, so an account that does not exist is a 404 and
costs no per-account call.

The `streaming` end-to-end scenario measures this against the built server with
a slow API.
