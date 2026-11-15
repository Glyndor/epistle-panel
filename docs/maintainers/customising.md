# Customising the panel

The container image is immutable, so what an operator can change without
rebuilding is what the image reads at run time: environment variables and files
mounted into the container. Everything else is a change to the repository and a
new image.

## What runtime theming can change (no rebuild)

| Want | How |
|---|---|
| Colours, light and dark | Redefine the semantic variables in a stylesheet and point `EPISTLE_PANEL_THEME_CSS_FILE` at it; see "The theme a person chooses" for the dark values |
| Corner radius | `--radius` (the small and medium radii derive from it) |
| Fonts | `--font-sans`, `--font-mono`; a face must come from the panel's own origin because the CSP is `default-src 'self'`, and the panel serves no font files itself, so in practice a system stack |
| Spacing density | `--spacing` (the unit every padding, gap and size multiplies; the default is `0.25rem`) |
| Product name | `EPISTLE_PANEL_BRAND_NAME` |
| Logo, favicon | `EPISTLE_PANEL_BRAND_LOGO_FILE`, `EPISTLE_PANEL_BRAND_FAVICON_FILE` |
| Where the browser fetches the logo and the favicon from | `EPISTLE_PANEL_BRAND_ORIGIN`, see "Serving the files from a CDN" |
| The line at the foot of the pages | `EPISTLE_PANEL_COPYRIGHT_NOTICE` |

All the variables live in one file, `internal/src/styles/theme.css`: the colour
roles (`--background`, `--foreground`, `--primary`, `--muted`, `--accent`,
`--destructive`, `--destructive-soft`, `--warning`, `--field`, `--field-edge` (the
2px line under a field), `--ring`,
`--overlay`, the `--sidebar-*` family, `--header` (the bar above the content),
`--chart-1` to `--chart-5`, the series
colours of the charts, checked pair by pair, and `--chart-missing`, the band of
a column the server may not have returned (see `charts.md`), `--label-1` to
`--label-8`, the tones of a message's labels (see "The label tones" in
`mail-list.md`)), the four surface roles
(`--background` the canvas, `--surface` a card or table, `--surface-sunken` a
stripe or quiet callout, `--surface-raised` a menu, toast or dialog, with its
shadow `--elevation`; `--card` and `--popover` follow them), `--radius`, the
fonts and `--spacing`. The panel draws no box around things, so there is no
border token: the tone steps between surfaces, the field fill and the field's
bottom line are what the operator tunes. The shell has three zones told apart
by tone alone, the rail (`--sidebar`), the bar (`--header`) and the canvas
(`--background`): an override that brings two of them to the same tone merges
them, since no line stands between them. The panel's own values keep every
pair at a luminance ratio of 1.1 or more, in the light list and in both dark
ones, and `styles/theme.test.ts` computes it. A component reads a role (`bg-primary`, `rounded-md`) and never a
palette value, which is what makes the override work.

Example override, mounted read-only and named in the environment:

```css
:root {
	--primary: oklch(0.45 0.18 260);
	--primary-foreground: #ffffff;
	--radius: 0.25rem;
}
/* Dark, when the browser prefers it and the person did not choose light... */
@media (prefers-color-scheme: dark) {
	:root:not([data-theme="light"]) {
		--primary: oklch(0.75 0.14 260);
		--primary-foreground: oklch(0.2 0.03 260);
	}
}
/* ...and when the person chose dark. */
:root[data-theme="dark"] {
	--primary: oklch(0.75 0.14 260);
	--primary-foreground: oklch(0.2 0.03 260);
}
```

### The theme a person chooses

The header of the admin area and of the webmail has a theme button: light, dark
or the system's. The same choice is a field of the person's own page,
`/app/me` (see `preferences.md`), which a person with no script can use too. It
is the person's only say over how the panel looks: there is no accent to pick, so
the operator's palette and logos, and the contrasts measured on them, hold. A chosen theme is `data-theme="light"` or `data-theme="dark"`
on `<html>`; with the system's there is no attribute and the tokens follow
`prefers-color-scheme`. So a dark override names both ways of getting dark, as
above. The panel's own rules weigh the same as a plain `:root` (the attribute
sits inside `:where()`), and your stylesheet loads after them: any selector you
write wins.

Where every browser you serve has `light-dark()` (those of 2024 and later), one
declaration does the same, because the panel sets `color-scheme` on `<html>`
for each choice:

```css
:root {
	--primary: light-dark(oklch(0.45 0.18 260), oklch(0.75 0.14 260));
}
```

A stylesheet written before the theme button existed, with its dark values in
`@media (prefers-color-scheme: dark) { :root { ... } }`, keeps working for
everyone who leaves the theme on the system's. For someone who chooses a theme
that the browser does not prefer, its dark values still follow the browser:
add the two selectors above to make them follow the choice.

How it is served: `GET /theme.css` returns the file with `Content-Type:
text/css` and `Cache-Control: public, max-age=60`, linked in the page head after
the panel's own stylesheet. It is a same-origin link, so it works under
`style-src 'self'` with no inline style, and the CSP does not change. The route
is public (the sign-in page needs it) through an exact exception in the proxy
matcher, as are `/brand/logo` and `/brand/favicon`; each opens only itself, and
the look-alikes are plain 404s (the unit tests and the `theme` e2e
scenario assert it). The file is read on every request, so an edit shows within
a minute.

You own the contrast: the panel's own pairs were measured, an override is not.
Check label, ring and field pairs in light and dark after a change.

### The field boundary

A field is a tonal well (`--field`) whose fill is only 1.01 to 1.27:1 against
the surface it sits on, so the fill alone does not identify it (WCAG 1.4.11
asks 3:1 for the boundary of a control). The boundary is a 2px line along the
bottom edge, drawn as an inset shadow (`shadow-[inset_0_-2px_0_0_var(--field-edge)]`
in `FIELD_CLASS`, so it follows the rounded corners and adds no height), in
`--field-edge`. When the value is invalid the line and a 1px inset outline turn
`--destructive`, so the state is not colour alone. If you override `--field`,
`--accent` (the hover fill) or `--field-edge`, keep the line at 3:1 or more
against the surface, the well and the hover fill.

Measured in the built panel on 2026-11-13 (Chromium, 33 fields per theme: the
sign-in excluded, the composer, the deliveries filters and the account page, at
360, 768 and 1280 px; real keyboard for focus, real pointer for hover; colours
read from painted pixels, so they include 8-bit quantisation). Smallest ratio:

| Pair | Before (field with a transparent border; 1.19 and 1.17 are the figures reported for the previous release) | After |
|---|---|---|
| Field fill against surface, light / dark | 1.19 / 1.17 | 1.02 / 1.03 (unchanged by design) |
| Boundary against surface, rest, light / dark | none painted | 3.55 / 4.53 |
| Boundary against the field fill, rest, light / dark | none painted | 3.62 / 4.64 |
| Boundary against the hover fill, light / dark | none painted | 3.46 / 3.62 |
| Invalid line against surface, light / dark | 1px destructive border, not measured | 5.34 / 7.9 |
| Focus outline against surface and fill, light / dark | not measured | 4.03 / 6.11 |
| Disabled (exempt from the floor; opacity 0.5 on the control) | | 1.72 / 2.15 |

The dark `--surface` rose from a lightness of 0.2 to 0.21 on 2026-11-14, so
that a panel stands 1.11 from the canvas, as the zones of the shell do (it
stood 1.09). The dark figures against the surface in the table are from the
day before. Read again from the computed colours of the built panel, the same
way before and after the change: the boundary against the surface 5.36 then
and 5.26 now, the focus outline against the surface 7.23 and 7.09, and the
well against the surface 1.17 and 1.15. `theme.test.ts` holds `--surface` to
1.1 from `--background`, and what is drawn on it to its floor, in every list.

Two shapes were compared on the same fields before choosing, both in
`--field-edge`: a 1px inset outline all round, and the 2px bottom line. Both
reach 3:1 (outline: 3.55 / 4.53 against the surface). The outline reads as a
frame around the control, which is the box the panel avoids, so the bottom line
was kept. The lightness of `--field-edge` (0.58 light, 0.64 dark, OKLCH) is the
smallest step that holds 3:1 against the hover fill with a margin of 0.4; it is
a measured choice for this palette, not a rule for another one.

The line at the foot of the sidebar and of the sign-in page is the panel's own
notice by default, and the operator's when it sets one:
`EPISTLE_PANEL_COPYRIGHT_NOTICE`. Unset or empty keeps `© 2026 Glyndor`; a text
is that text, at most 200 characters and without a control character, shown as
text and never as markup; and the word `none`, in lower case and alone, says no
line at all, for a white label. A value that cannot be shown stops the start
with a message that names the variable and never the value, because a server
that kept running would show a notice nobody chose.

## What runtime configuration can change (no rebuild)

The look is not the only thing an operator can change without a rebuild: the
length of a session, the language the panel starts in and the remote-image
policy are read from the environment when the process starts.

| Variable | Effect |
|---|---|
| `EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES` | Absolute lifetime of a user's session, in whole minutes (1 to 43200). Unset or empty keeps eight hours (480). |
| `EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES` | The same for an admin's session. Unset or empty keeps eight hours (480). |
| `EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES` | Optional, in whole minutes (1 to 43200): a session nobody used for that long is refused and the person goes to the sign-in page. Unset or empty leaves it off. |
| `EPISTLE_PANEL_DEFAULT_LOCALE` | The language the panel falls back to when the person chose none and the browser asked for none of the six: `en`, `es`, `pt`, `fr`, `de` or `it`. Unset or empty keeps `en`. |
| `EPISTLE_PANEL_COPYRIGHT_NOTICE` | The line at the foot of the pages: the operator's own text, or `none` for no line at all. Unset or empty keeps `© 2026 Glyndor`. At most 200 characters, no control character. |
| `EPISTLE_PANEL_REMOTE_IMAGES` | Fixes how messages may load remote images for everyone: `ask`, `always` or `never`. Unset or empty leaves the choice to each person. |
| `EPISTLE_PANEL_TIME_ZONE` | The time zone every date of the panel is printed in: `UTC` or the name of an IANA zone (`America/Bogota`). Unset or empty leaves the choice to each person. |
| `EPISTLE_PANEL_PAGE_SIZE` | How many messages one page of the message list holds for everyone: `25`, `50` or `100`. Unset or empty leaves the choice to each person (50 until they choose). |
| `EPISTLE_PANEL_REFRESH` | How fast the lists refresh by themselves for everyone: `normal`, `slow` or `fast`. Unset or empty leaves the choice to each person (`normal` until they choose). There is no way to turn it off. |

### Remote images

`EPISTLE_PANEL_REMOTE_IMAGES` is unset when each person chooses through
`/app/me`. The choice is kept in the `remote-images` cookie under `/app` and
has one of three modes: `ask` blocks remote images until the reader asks for
that message and visit, `always` loads them, and `never` blocks them without
offering the button.

When the variable holds one of those modes, it wins over the person's cookie
for every request. `/app/me` shows the mode as read-only text and its Server
Action refuses a posted attempt to change it. The body route and the reader
use the same effective mode. `always` uses the existing `?images=1` path;
`never` ignores that parameter; `ask` keeps today's behaviour. The sanitiser's
link and URL policy does not change in any mode, and the framed body's
`img-src` widens only through the same response path that already handled
`?images=1`.

The issue's trusted-sender mode is not available: the panel has no address
book or trusted-sender list from which to decide it.

### The time zone

`EPISTLE_PANEL_TIME_ZONE` is unset when each person chooses through
`/app/me`. The choice is kept in the `time-zone` cookie under `/app` and holds
`UTC` or the name of an IANA zone, one of the names the running Node knows
(`Intl.supportedValuesOf("timeZone")`), and nothing else: a value is believed
when it is exactly one of those names, never because `Intl` accepted it.

When the variable holds one of those names, it wins over the person's cookie
for every request. `/app/me` shows the zone as read-only text and its Server
Action refuses a posted attempt to change it. Every date the panel prints for
display is then in that zone: the rows and the reader of the mail, the groups
the rows stand under, the delivery log, the moments of an account and the
labels of the charts.

The dates that are not for the person are not changed: the dates inside a
message (its body, its headers and the `Date` header it travels with), the
range of days a search keeps (the API counts its days in Greenwich) and the
columns of the timeline (the API counts its records in days of Greenwich, so
the columns stay there; their labels say the same instants in the zone of the
person).

A value that is not a zone stops the start with a message that names the
variable and never the value.

### The page size of the message list

`EPISTLE_PANEL_PAGE_SIZE` is unset when each person chooses through `/app/me`.
The choice is kept in the `page-size` cookie under `/app` and is one of `25`,
`50` or `100`, written exactly so (`050` and `50.0` are not choices); anything
else in the cookie reads as 50, which is what the list held before the person
could choose. When the variable holds one of the three, it wins over the cookie
for every request, `/app/me` shows it as read-only text and its Server Action
refuses a posted attempt to change it.

It is the size of the page of the message list, read on the server by the one
function that cuts the page (`features/mail/queries/load-message-list`), so the
prefetch and the browser's own request cut it the same way, and the "next page"
flag and the page numbers follow it. It is not the size of the other lists:
the tables of the administration page by themselves in the browser (25 rows a
page, with their own control for 10, 25, 50 or 100), the API's fixed limits
(the overview reads at most 100 records per call, up to 5 calls; the delivery
log reads the API's own limit) and the batch sizes of the label and the
message-get calls are not pages of a list, and a person's choice does not move
them. A search or filter reads at most the newest 1000 messages of a folder
whatever the page size.

### The pace of the refreshes

`EPISTLE_PANEL_REFRESH` is unset when each person chooses through `/app/me`.
The choice is kept in the `refresh` cookie under `/app` and is one of
`normal`, `slow` or `fast`; there is no `off`, in the variable, the form or the
cookie, and a cookie that says anything else reads as `normal`. The pace
multiplies the interval every list that refreshes by itself already had, in one
function (`features/refresh/config/pace`, `refreshInterval`):

| List | `normal` (today's) | `slow` (2x) | `fast` (0.5x, never under 15 s) |
|---|---|---|---|
| The message list and the folders (and the counters in them) | 30 s | 60 s | 15 s |
| The suppression list and the delivery log | 30 s | 60 s | 15 s |
| The status counters and the queue | 15 s | 30 s | 15 s |

(`slow` runs as `normal` when the idle timeout is 2 minutes or less.)

The status counters and the queue are already at the floor, so `fast` leaves
them at 15 s. Lists refresh only while the tab is in view, as before.

A page left open and visible keeps the session alive because it refreshes its
lists, and an idle timeout (`EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES`)
counts that refresh as use. The keepalive therefore runs on the effective
interval, never on the normal one. An open page must refresh at least twice
inside the idle timeout, and at `slow` the longest gap between two requests is a
minute while the idle timeout accepts as little as one minute (measured: with 1
minute and `slow`, the first refresh at 63 s met an expired session). So the
effective pace is not always the chosen one: when the idle timeout is 2 minutes
or less, `slow` runs as `normal`. The rule is one function
(`effectiveRefreshPace` in `features/refresh/config/pace`), read from the
session policy by `features/refresh/queries/refresh-pace`, and the layouts (the
`RefreshProvider`) and `/app/me` both take it from there. `normal` (30 s at
most) and `fast` always fit. `/app/me` keeps showing what was chosen, or the
operator's value as read-only text, with a short note under it that `slow` is
used as `normal` while the idle timeout is that short.

The layout of each area (the mail and the administration) reads the effective
pace on the server and hands it to its whole frame, the sidebar and the search
included, which poll too; the browser never reads the cookie, which is
`HttpOnly`. A list read without that frame refreshes at the normal interval.

Every one of them is checked when the server starts: a value that cannot be
used stops the start with a message that names the variable and never the
value, because a server that kept running would apply a policy nobody chose.
The session lifetimes travel in the signed token and in the cookie, and the
idle timeout travels in the token as the moment of the last use, so the server
alone judges a session; the browser cannot extend one. Renewal changes only
`act`: `iat`, `exp`, role and `jti` stay fixed, and cookie Max-Age is the exact
remaining absolute lifetime. Only a GET (a navigation) or a POST (a server
action) renews it; static assets, prefetches, HEAD, every other method, proxy
redirects and hidden rewrites do not count as activity. Reducing a role's configured
lifetime rejects sessions issued for longer, even if they would expire soon;
increasing it never extends an existing session. Older tokens without the new
issuance and canonical identity claims require signing in again.

Roles remain snapshots from authenticated sign-in: upstream demotion takes
effect on a new sign-in, logout or absolute expiry. For immediate invalidation,
rotate the session secret (ending all sessions). Revocations remain local to
one process; run one instance. At 10,000 live revocations, it fails closed
until any unrecorded revocation has expired, rather than allowing replay. To
clear overflow early, restart with a new session secret; restarting alone loses
revocations.

The order in which the language of a page is settled: the person's own choice
(the `locale` cookie, checked against the six languages before it is believed),
then what the browser asked for in `Accept-Language`, then the operator's
default, then English. The header is read up to 4096 characters and 64 ranges,
and a range with a quality value nobody can read is not wanted at all, so a
hostile header costs no more than an ordinary one.

## Serving the files from a CDN (optional)

Two variables, each one `https` origin, both unset by default. Unset, the panel
serves its own files and its policy is the one it always was, with no network
beyond the panel and the API.

| Variable | What moves | When it is read |
|---|---|---|
| `EPISTLE_PANEL_BRAND_ORIGIN` | The logo and the favicon: the page asks `<origin>/brand/logo` and `<origin>/brand/favicon` instead of the panel's own paths | at start, no rebuild |
| `EPISTLE_PANEL_STATIC_ORIGIN` | Everything under `/_next/static`: the scripts, the stylesheet and the icons the stylesheet draws | **when the image is built**, and again at start as a check |

A value is one exact origin: `https`, a host, an optional port, at most one
trailing `/`. No wildcard, no path, no query or fragment, no credentials, no
space, no IP literal in brackets, no `http` (not even for loopback), and a name
outside ASCII is written in its `xn--` form. The host is lowercased and a port
of 443 dropped. A value that is not one stops the start (the build, for the
static origin) with a message that names the variable and never the value.

**What the policy gains.** Only `img-src`, and only the origins that are set
(`img-src 'self' data: https://static.example.com https://brand.example.com`).
It was measured in Chromium (Playwright build 1243) with the `securitypolicyviolation` event, a
panel built with `assetPrefix` on `https://cdn.example.test:48443` and a second
server on that origin, over the sign-in page, the overview, the accounts, the
deliveries and the mail pages and twelve client-side navigations:

- With the policy unchanged, the only violations were `img-src` ones: the
  icons are drawn by the stylesheet as `mask-image: url(../media/x.svg)`, which
  resolves against the stylesheet, so they come from the static origin. Eight to
  fifteen per page.
- Scripts and the stylesheet loaded with no violation and no change: the
  server stamps its nonce on every `<script>` and `<link rel="stylesheet">`, the
  chunks the runtime adds are the trusted scripts' (`'strict-dynamic'`), and the
  `style-src-elem` nonce covers the link. Adding the origin to `script-src`
  would do nothing in a browser that honours `'strict-dynamic'`, so it is not
  added. A browser that ignores `'strict-dynamic'` would refuse the chunks from
  another origin; none was measured.
- `font-src`, `connect-src` and `style-src` saw nothing: the build has no font
  file and the panel asks the CDN for no data.
- With `img-src` widened: zero violations on every page, and the brand images
  came from the second origin.

**What the CDN must serve.** The files under `/_next/static/` of the image, at
the same paths (`<origin>/_next/static/...`), and `/brand/logo` and
`/brand/favicon` for the brand origin, the same bytes the panel serves from its
disk. The icons are fetched in CORS mode (a CSS mask is), so the CDN must send
`Access-Control-Allow-Origin` for `/_next/static/media/*`: without it Chromium
refused all of them (`net::ERR_FAILED`, no policy violation) and every icon
vanished. `Cache-Control` is the CDN's to set; the file names carry a hash.

**The brand files stay on the disk.** `EPISTLE_PANEL_BRAND_LOGO_FILE` and
`EPISTLE_PANEL_BRAND_FAVICON_FILE` still say whether there is a logo and a
favicon, and the panel still serves them at `/brand/logo` and `/brand/favicon`;
the origin only changes where the browser asks.

**Why the static origin is a build setting.** Next fixes `assetPrefix` while it
builds: it is written into the markup, and Turbopack's chunk loader carries it
as a literal (`TURBOPACK_CHUNK_BASE_PATH ... "https://cdn.example.test:48443/_next/"`
in `_next/static/chunks/turbopack-*.js`). The loader's literal cannot be
changed without rebuilding, and the markup takes its prefix from the same
build, so a run-time value would leave a loader that asks where the markup no
longer points (read in the build output, not run). There is no run-time form.
`next.config.ts` reads `EPISTLE_PANEL_STATIC_ORIGIN` while building and writes
the value back as `PANEL_BUILT_STATIC_ORIGIN`, which Next compiles in; the policy
follows that compiled value, so it always matches the markup. At start the
variable must be set to the same origin: a different one, none on an image that
was built for one, or one on an image that was built without it (the published
image) stops the start and says so.

```sh
podman build --build-arg EPISTLE_PANEL_STATIC_ORIGIN=https://static.example.com \
  -t panel-with-cdn .
# and run it with EPISTLE_PANEL_STATIC_ORIGIN=https://static.example.com
```

Built without the variable, the client files (`.next/static`) are byte-identical
to a build before this existed; only the server code differs. The published
image is built that way, so an operator who wants the static origin builds
their own image.

## What needs a rebuild

Anything that changes the stylesheet's source or the markup:

- the Tailwind configuration or a new utility the panel does not use yet;
- a component, a page, a layout, a message string or a new route;
- the navigation entries (`features/navigation/config/items`);
- a font file to bundle, the static origin (`EPISTLE_PANEL_STATIC_ORIGIN`, a
  build argument as well as a variable) or any change to the CSP.

Build the image from the repository's `Containerfile` after editing the source;
the maintainer docs ([shadcn.md](shadcn.md), [layouts.md](layouts.md),
[icons.md](icons.md)) describe the rules a change keeps. Runtime theming is the
supported way to restyle; a fork that edits components carries the cost of
rebuilding and merging.

## Adding a configuration variable

A new `EPISTLE_PANEL_` variable goes in `PANEL_VARIABLES` in
`internal/src/lib/config/panel-variables/index.ts` (and in
`PANEL_SECRET_VARIABLES` when it is read through `readSecret`). The server logs a
warning at start for any `EPISTLE_PANEL_` name that is not listed, so a
misspelling is not silent; a test fails when the source mentions a name that is
missing from the list.
