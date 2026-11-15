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
or the system's. A chosen theme is `data-theme="light"` or `data-theme="dark"`
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

The original copyright notice stays in the sidebar and on the sign-in page. It is
a constant in `features/branding/copyright`, not configuration.

## What runtime configuration can change (no rebuild)

The look is not the only thing an operator can change without a rebuild: the
length of a session and the language the panel starts in are read from the
environment when the process starts.

| Variable | Effect |
|---|---|
| `EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES` | Absolute lifetime of a user's session, in whole minutes (1 to 43200). Unset or empty keeps eight hours (480). |
| `EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES` | The same for an admin's session. Unset or empty keeps eight hours (480). |
| `EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES` | Optional, in whole minutes (1 to 43200): a session nobody used for that long is refused and the person goes to the sign-in page. Unset or empty leaves it off. |
| `EPISTLE_PANEL_DEFAULT_LOCALE` | The language the panel falls back to when the person chose none and the browser asked for none of the six: `en`, `es`, `pt`, `fr`, `de` or `it`. Unset or empty keeps `en`. |

Every one of them is checked when the server starts: a value that cannot be
used stops the start with a message that names the variable and never the
value, because a server that kept running would apply a policy nobody chose.
The session lifetimes travel in the signed token and in the cookie, and the
idle timeout travels in the token as the moment of the last use, so the server
alone judges a session; the browser cannot extend one. Renewal changes only
`act`: `iat`, `exp`, role and `jti` stay fixed, and cookie Max-Age is the exact
remaining absolute lifetime. Static assets, prefetches, HEAD, proxy redirects
and hidden rewrites do not count as activity. Reducing a role's configured
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

## What needs a rebuild

Anything that changes the stylesheet's source or the markup:

- the Tailwind configuration or a new utility the panel does not use yet;
- a component, a page, a layout, a message string or a new route;
- the navigation entries (`features/navigation/config/items`);
- a font file to bundle, or any change to the CSP.

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
