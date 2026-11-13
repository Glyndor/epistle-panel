# Data pages: Query, Table and Server Actions

The status, queue, deliveries, suppression, domains and accounts pages share one shape. The API token and
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
   through `lib/query/run-action`: it checks the admin session first (an action is a
   public POST endpoint, and a session of another role is no session here), validates input with a strict zod schema when it takes
   any, calls the `lib/api` client, and returns an `ActionResult`: the data or a
   reason (`unauthenticated`, `unavailable`, `invalid`). It never returns a raw
   error; the detail goes to the server log under a fixed operation name.
4. The status counters and the queue refetch every 15 s while the tab is in
   view (`refetchIntervalInBackground: false`); a hidden tab makes no request.
   A query that finds the session ended sends the browser to the sign-in page at `/`.

Removing a queue entry is a mutation with an optimistic update: the row leaves
the cached page at once, the snapshot is restored on failure, and the queue and
status are refetched either way. Its outcome is a toast (`components/ui/toaster`).
The browser's own `confirm` stays: a modal Radix dialog injects a style element
that the CSP refuses.

## The suppression list

`/app/{id}/suppression` reads `GET /api/v1/suppression` and removes with
`DELETE /api/v1/suppression/{address}` (scopes `read` and `write`; the panel's
token is unconfined, which the global list requires). Measured against the API's
handler and its OpenAPI file:

- **Paging** is a keyset cursor: `limit` (default 50, cut to 100, 0 refused with
  `400 invalid_input`) and `after`, which is the last address of the previous
  page; the answer carries `next_cursor` only when more remain. The panel links to
  `?after=` with the cursor percent-encoded, like the queue's `?cursor=`.
- **There is no endpoint to add an address.** The routes are the list and the
  removal only; adding is the `epistle suppression` command on the server, and
  bounces add addresses on their own. The page therefore lists and removes, and
  it polls every 30 s while the tab is in view because bounces add entries.
- **The address is validated before it leaves the panel**, in `lib/mail-address`:
  one `@`, no whitespace, no control or format character, at most 254
  characters, non-ASCII allowed. The cursor and the removal go through it in the
  actions, and a bad `?after=` is dropped. In the path the address goes through
  `encodeURIComponent`, so a `/`, `?`, `#` or `%` in it cannot change the route.
  Removing an address that is not on the list answers 200, so a second click is
  harmless. The API's per-account lists (`?account=`) are not shown.

## The delivery log

`/app/{id}/deliveries` reads `GET /api/v1/deliveries` (scope `read`), read only. Measured
against the handler and the OpenAPI file:

- **It does not page.** There is no cursor: the answer is at most `limit` records
  (default 50, cut to 1 to 100) and `{"entries": [...]}` only. The panel asks for
  100 and says so when the page comes back full, since older records may exist.
  Narrowing is by `outcome`, `since` and `recipient`, which are in the URL as a
  plain GET form (`?outcome=failed&since=24h&recipient=...`), so a view can be
  bookmarked and the form works without script. `account` is a filter of the API
  that the panel does not offer.
- **Order.** The API reads the newest day first but, inside a day, oldest first, so
  `loadDeliveries` sorts the page by time, newest first. With a full page that
  came from a busy day, the 100 returned are the first 100 of the newest day, not
  necessarily the 100 newest; the notice says to narrow with the filters.
- **Values.** `outcome` is one of `delivered`, `deferred`, `failed`, `suppressed`,
  `canceled` (an unknown one is `400 invalid_input`); `since` is a duration or an
  RFC 3339 timestamp and the panel offers `15m`, `1h`, `24h`, `7d`, `30d` only. The
  filters are read from the URL with one schema that the action enforces too, each
  field on its own, so a bad value is dropped and the others stay. The recipient
  goes through the address schema of `lib/mail-address`.
- **Log off.** With `[storage] delivery_log_days = 0` the API answers `404`; the
  panel shows that as a notice, not as an unreachable API. A key bound to one
  account sees only its own records; the panel's token is unconfined.
- **Display.** Times are printed in UTC (`YYYY-MM-DD HH:MM:SS`), not in the
  viewer's zone, so the server render and the browser agree. A remote reply is
  text from another server (the API keeps its first 200 bytes) and is rendered as
  text. The `extra` map of a record is not read. The refresh is every 30 s while
  the tab is in view.

## The account page and what it must not keep

`/app/{id}/accounts/[name]` (`features/account-detail`) follows the same flow, with
differences that matter:

- The name in the URL is parsed with `accountNameSchema` (lowercase ASCII
  letters, digits and hyphens, at most 64) after `requireSession`; anything else
  is a 404 page before the API is asked. Every action takes the same branded
  name in a strict schema, and `lib/api/account-client` checks it again before it
  builds a path, because `encodeURIComponent("..")` is still `..`. A name that
  is not on the accounts list is a 404 page too, and no per-account call is made.
- The API has no read of one account, so the page uses the accounts list
  (`display_name`, `dynamic`, addresses). An account declared in the
  configuration file (`dynamic: false`) is shown without the password,
  two-factor and name controls the API would answer 404 for.
- An action reports a refusal the person can act on as a closed category
  (`rejected` for a 400, `notFound`, `conflict` for a 409) in `Outcome`, never
  with the API's message, which can quote what was sent. Anything else is
  `unavailable` and logged under a fixed name.
- The password goes from the field to the Server Action without TanStack
  Query, which would keep mutation variables in its cache; the field is
  emptied when the answer arrives and the answer is only a category.
- The TOTP secret is returned by one action, once, and lives in the state of
  `totp-section` until it is hidden or the page is left. It is not in the
  query cache, a toast, the URL or a log, and the answer is `no-store`. There
  is no QR code: drawing one needs a library, and the secret and URI are shown
  as text.
- Destructive actions (turning two-factor off, enrolling a new secret, removing
  a masked address) use the browser's `confirm`.
- The archive answers 404 when the server keeps no deleted mail; that is a
  state of the section, not an error, and it is not logged.

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
