# Customising the panel

The container image is immutable, so what an operator can change without
rebuilding is what the image reads at run time: environment variables and files
mounted into the container. Everything else is a change to the repository and a
new image.

## What runtime theming can change (no rebuild)

| Want | How |
|---|---|
| Colours, light and dark | Redefine the semantic variables in a stylesheet and point `EPISTLE_PANEL_THEME_CSS_FILE` at it |
| Corner radius | `--radius` (the small and medium radii derive from it) |
| Fonts | `--font-sans`, `--font-mono`; a face must come from the panel's own origin because the CSP is `default-src 'self'`, and the panel serves no font files itself, so in practice a system stack |
| Spacing density | `--spacing` (the unit every padding, gap and size multiplies; the default is `0.25rem`) |
| Product name | `EPISTLE_PANEL_BRAND_NAME` |
| Logo, favicon | `EPISTLE_PANEL_BRAND_LOGO_FILE`, `EPISTLE_PANEL_BRAND_FAVICON_FILE` |

All the variables live in one file, `internal/src/styles/theme.css`: the colour
roles (`--background`, `--foreground`, `--primary`, `--muted`, `--accent`,
`--destructive`, `--destructive-soft`, `--warning`, `--field`, `--ring`,
`--overlay`, and the `--sidebar-*` family), the four surface roles
(`--background` the canvas, `--surface` a card or table, `--surface-sunken` a
stripe or quiet callout, `--surface-raised` a menu, toast or dialog, with its
shadow `--elevation`; `--card` and `--popover` follow them), `--radius`, the
fonts and `--spacing`. The panel draws no line between things, so there is no
border token: the tone steps between surfaces and the field fill are what the
operator tunes. A component reads a role (`bg-primary`, `rounded-md`) and never a
palette value, which is what makes the override work.

Example override, mounted read-only and named in the environment:

```css
:root {
	--primary: oklch(0.45 0.18 260);
	--primary-foreground: #ffffff;
	--radius: 0.25rem;
}
@media (prefers-color-scheme: dark) {
	:root {
		--primary: oklch(0.75 0.14 260);
		--primary-foreground: oklch(0.2 0.03 260);
	}
}
```

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
Check label, ring and field pairs in light and dark after a change. The field boundary is a tonal step, not a line: its contrast against the surface is low by design and the focus ring carries the state, so keep the ring at 3:1 or more against every surface.

The original copyright notice stays in the sidebar and on the sign-in page. It is
a constant in `features/branding/copyright`, not configuration.

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
