# Data pages: Query, Table and Server Actions

The status, queue, domains and accounts pages share one shape. The API token and
the session stay on the server; the browser never calls the API.

## The flow

1. The page is a Server Component. It calls `requireSession`, reads its
   parameters, prefetches its query into the request's client
   (`lib/query/server-query-client`, one per request through `React.cache`) with
   `lib/query/prefetch`, and renders a `HydrationBoundary` around one client
   component. A failed prefetch is logged and the page still renders.
2. The client component calls `useQuery` with the same `queryOptions` the server
   used (`features/<f>/queries/<f>-query`), so the key and the data shape cannot
   drift. Hydrated data is fresh for 30 s, so the first render needs no request;
   measured: no Server Action call at load on any page.
3. The browser's `queryFn` is a Server Action (`features/<f>/actions`). Each runs
   through `lib/query/run-action`: it checks the session first (an action is a
   public POST endpoint), validates input with a strict zod schema when it takes
   any, calls the `lib/api` client, and returns an `ActionResult`: the data or a
   reason (`unauthenticated`, `unavailable`, `invalid`). It never returns a raw
   error; the detail goes to the server log under a fixed operation name.
4. The status counters and the queue refetch every 15 s while the tab is in
   view (`refetchIntervalInBackground: false`); a hidden tab makes no request.
   A query that finds the session ended sends the browser to `/login`.

Removing a queue entry is a mutation with an optimistic update: the row leaves
the cached page at once, the snapshot is restored on failure, and the queue and
status are refetched either way. Its outcome is a toast (`components/ui/toaster`).
The browser's own `confirm` stays: a modal Radix dialog injects a style element
that the CSP refuses.

## Tables

`components/data-table` wraps TanStack Table v9 with the two features the panel
uses, sorting and a text filter, and nothing else. Reads stay in the owner's
render (`table.state`, `getRowModel`): with React Compiler on, a child that read
table state through a method of a stable object would be memoised stale. The
queue pages through the API's cursor, as a link to `?cursor=`, so a page can be
bookmarked; sorting and filtering apply to the page on screen.

## Server Actions across instances

Next encrypts the closed-over values of a Server Action with a key generated at
build time and stored in the build's `server-reference-manifest.json`. Instances
of the same image share it, which is what the container deployment runs. If two
instances were ever built separately, or an image is rebuilt while old pages are
open, set the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (32 random bytes, base64)
on every instance and at build time so an open page does not send an action id
the other instance cannot decrypt. The panel's actions close over nothing, so
the key protects no secret today.

## Checks

The e2e scenarios `logout` and `noauth` post to the `remove-entry` action the
way the client does: they read its id from the build's reference manifest, since
the id is no longer in the HTML.
