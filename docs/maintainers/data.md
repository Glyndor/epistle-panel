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
It asks first with `ConfirmAction` (an alert dialog; its style element carries
the request's nonce, see shadcn.md).

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
  a masked address) ask with `ConfirmAction`.
- The archive answers 404 when the server keeps no deleted mail; that is a
  state of the section, not an error, and it is not logged.

## Tables

`components/data-table` wraps TanStack Table v9 with the features the panel
uses: sorting, a text filter, a filter by column for the facets, and pages.
Nothing else is registered, so nothing else is bundled.

| Folder | Holds |
|---|---|
| `data-table/` | `DataTable`, the owner of the table and of its state |
| `data-table/features` | the registered features, `columnHelper`, the facet filter, the column `meta` type |
| `data-table/toolbar` | the bar: text filter, Filters menu, count, the page's own content |
| `data-table/header` | the header row and its sort buttons |
| `data-table/filters-menu` | the Filters button and its menu of tick boxes |
| `data-table/announcer` | the one live region that tells a screen reader the rows changed |
| `data-table/pagination` | the foot: range, page size, previous, next, page numbers |
| `data-table/no-rows` | the empty row, with the way back when the filters caused it |
| `data-table/paging`, `data-table/facets` | the arithmetic of pages and of the selection, as plain functions |

Reads stay in the owner's render (`table.state`, `getRowModel`): with React
Compiler on, a child that read table state through a method of a stable object
would be memoised stale. So the parts take plain values and callbacks, never
the table, a header or a column. The unit tests do not run the compiler; a
stale part shows only in the built panel, which is why the browser checks in
`e2e.md` press the controls and read the rows.

### Where the state lives

Order, text filter, ticked facets, page and page size are React state of
`DataTable`, in the browser. They are not in the URL: a reload, or a link sent
to someone, opens the first page with no filter. The lists the API pages (the
queue with `?cursor=`, the suppression list with `?after=`) and the delivery
log's own filter form are in the URL, as before.

### Pages

Paging is over the rows the query returned: 10, 25, 50 or 100 a page, 25 to
start with. The foot shows the range ("1–25 of 132") and the page size. When
the rows take more than one page it also has previous and next at every
width; the page numbers join them once the foot is at least 28rem wide, and
below that "Page 2 of 6" stands between the two. A list that fits one page has
no page controls. Previous and next are marked `aria-disabled` at the ends
instead of being disabled, so the focus is not lost when the page under it
becomes the last; there they dim what they hold and not themselves, so the
focus ring keeps its contrast (see shadcn.md).

A change of the rows is said to a screen reader by one live region
(`data-table/announcer`), not by the sentences on screen: the range of a paged
table, the count of one that is not, or that no row matches. It waits until
the rows have been still for half a second, so a word typed in the filter is
one announcement and not one per letter, and it is emptied 2.5 s later, so at
rest each sentence is in the page once. The two times are a choice, not yet
checked with a screen reader.

- The page goes back to the first when the order, the text filter or a facet
  changes, and `DataTable` does that itself. The table is given no way to
  write the page (no `onPaginationChange`) and its own reset is off
  (`autoResetPageIndex: false`), because that reset also fires when the data
  changes, which would throw the viewer off their page on every refresh.
  Measured in the unit test of the refresh: with the callback wired and the
  reset left on, the table writes page 1 a moment after the data changes; with
  the reset off it writes nothing. Do not wire the one without keeping the
  other.
- When a refresh makes the list shorter than the page on screen, the last page
  that still has rows is shown.
- A new size keeps the row that was first on screen.
- `pagination={false}` turns it off. The queue and the suppression list pass
  it: the API already pages them and their links are in `toolbar`, so they are
  not paged twice. Sorting and filtering apply to the page on screen there.

### Facets

A facet narrows the table by a column whose values are a closed set the API
really reports. Today: where an account is defined (made through the API, or
declared in the configuration file) and whether a domain takes mail or is
switched off (`disabled` in `GET /api/v1/domains`). The queue and the
suppression list have no such field in the API (an entry is an id, a sender
and recipients; a suppressed address is only the address), so they have no
Filters menu. The delivery log narrows through its own form, on the server.

To add one:

1. Give the table a column whose accessor returns the raw value, a short key
   such as `"api"` or `"file"`, with an `id`. Set `enableGlobalFilter: false`
   on it, or the text filter would match the keys instead of what the row
   shows. Draw the value as words in `cell` (a `Badge`).
2. Pass `facets` to `DataTable`: the column's id, the group's label and one
   `{ value, label }` per value, together with
   `filtersMenu={DataTableFiltersMenu}` (imported from
   `components/data-table/filters-menu`; the types ask for the two together).
   That is all; every column filter of the panel
   uses `filterFn_oneOf`, which keeps a row whose value is exactly one of the
   ticked options (not a substring: `active` does not bring `inactive`).
3. Add the labels to the six locales and a test that ticks the box and reads
   the rows.

Ticking leaves the menu open; the button counts the ticked boxes; "Deselect
all" in the menu unticks them and leaves the text filter alone. When the
filters leave no row, the empty row offers "Clear filters", which takes the
text and the facets off and sends the focus to the filter field. The two have
different names because they do different things.

Who brings the menu's code is decided on purpose. The table that has facets
imports `DataTableFiltersMenu` and hands it to `DataTable` as `filtersMenu`;
`DataTable` itself does not import it. Two things were measured on the build
(first-load JavaScript of a route, compressed, from the build manifest):

- Loaded apart with `next/dynamic`, the button was drawn by the server and
  looked ready, and a press on it while its code was still on the way was
  lost. So it is not loaded apart.
- Imported by `DataTable`, it put the Radix menu and its popper (19.1 kB) in
  every table's page: the queue and the suppression list went from 251.5 to
  270.3 kB, the delivery log from 237.2 to 266.3 kB, for a menu they never
  draw. So `DataTable` does not import it.

With each table that has facets importing it, the queue and the suppression
list are at 250.2 and 250.1 kB and the delivery log at 235.9 kB, with no Radix
menu in their first load; the domains page, which now draws the menu, went
from 236.1 to 265.4 kB.

A test reads the sources and fails if `DataTable` imports the menu, if a table
without facets does, or if anything loads it apart.

### Focus and long values

- A sort button the keyboard reaches is scrolled into the table's box
  (`scrollIntoView` with `nearest`), since a wide table scrolls sideways and a
  header that was tabbed to could stay almost outside it. A pointer does not
  trigger it: moving the button during a click would lose the click.
- The delete dialog is controlled (the row's menu opens it), so it has no
  trigger of its own to return the focus to and left it on the page's body.
  The row tells it which button opened it: closing without deleting (Cancel,
  Escape, a refusal) gives the focus back to that button. When the account is
  deleted its row leaves, so the focus goes to the table's filter field, or
  to the page's heading when no table is drawn.
- Addresses and names wrap with `wrap-anywhere` (`overflow-wrap: anywhere`):
  a break at a hyphen or a space first, and inside a word only when nothing
  else fits. `break-all` cut every address mid-word.

### A column that leaves a narrow table

`DataTable` is a size container. A column can give classes to its header and
its cells through `meta.className`, such as `hidden @md:table-cell`, and show
the same value inside another cell below that width. The accounts table does
it with the origin, which sits under the account name at 360 px so the row
actions stay on screen. Under the name the label may wrap between its words:
on one line the longer translations made the table wider than the window
(measured at 360 px in the six languages: the table is 328 px in a 328 px box).
It does not break inside a word, so at 320 px, which the panel does not
target, the longest words still make the table a few pixels wider than its
box and it scrolls sideways.

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
