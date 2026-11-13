# UI components (shadcn/ui)

The panel's UI is composed from shadcn/ui components that live in this repository
as source: `internal/src/components/ui/<name>/index.tsx`. Nothing UI-related is a
runtime library except the Radix primitive a component imports and the small
helpers (`class-variance-authority`, `clsx`, `tailwind-merge`).

## Rules a component must keep

- **No inline style.** The panel serves `style-src 'self'` with no
  `'unsafe-inline'` and no `style-src-attr`. Many Radix components (Dialog,
  Select, Popover, Tooltip, DropdownMenu) position themselves with a `style`
  attribute and would be blocked. Before a component is used, run it in the built
  standalone server (see `e2e.md`) and read the browser console: a CSP violation
  means the component is not used until it can run without a violation. A `style`
  set from script (the CSSOM, which is how Radix and floating-ui place a popper)
  is not a violation; a `style` attribute in the server-rendered HTML and a
  `<style>` element are.
- **A modal Radix overlay needs the request's nonce.** A modal Dialog or
  AlertDialog locks page scroll through react-remove-scroll, which injects one
  `<style>` element. The policy accepts a style element only with the request's
  nonce (`style-src-elem 'self' 'nonce-...'`; no `'unsafe-inline'`, and `style-src`
  stays `'self'`, so style attributes are still refused). `StyleNonce`
  (`components/layout/style-nonce`, mounted in the app shell) passes the nonce of
  Next's own scripts to the library with `setNonce` from `get-nonce`. Measured in
  the built server: without it the dialog logs one `style-src-elem` violation,
  with it none. The non-modal dropdown and the native-`<dialog>` Sheet inject
  nothing. Every overlay that is added needs a test in
  `src/test/overlays-inject-no-style`; the unit tests of the policy
  (`lib/security-headers`) and the e2e `headers` scenario fail if the directive
  loses its nonce.
- **Compact on a fine pointer, 44 px on a coarse one.** The panel is an
  administration surface, so controls are 32 px (`min-h-8`) and menu rows 32 px.
  Every interactive component adds `pointer-coarse:min-h-11` (or `size-11`), and
  the tests assert the class; the rendered size is measured in a browser with
  touch emulation.
- **Width variables are classes.** The shadcn `SidebarProvider` writes
  `--sidebar-width` in a `style` attribute, which `style-src 'self'` blocks, so
  ours sets `[--sidebar-width:14rem]` as a class.
- **Theme tokens, no `dark:`.** Components read `bg-primary`, `text-muted-foreground`
  and the other roles. The values flip with `prefers-color-scheme` in
  `internal/src/styles/theme.css`, so a component needs no `dark:` utility.
- **No lines between things.** Hierarchy is tone and space: `bg-background`
  (canvas), `bg-surface` / `bg-card` (a card or a table), `bg-surface-sunken` (a
  stripe, a quiet callout), `bg-surface-raised` plus `shadow-raised` (a menu, a
  toast, a dialog, a sheet: the only shadows). Radii come from `--radius`
  (`rounded-lg` controls, `rounded-xl` cards, `rounded-2xl` dialogs). Do not add
  `border`, `divide-*` or a separator; the panel sets no default border colour.
  A form field is `bg-field` (`FIELD_CLASS` in `components/ui/input`) with a
  transparent border at rest, the focus ring on keyboard focus and a destructive
  border only when `aria-invalid`.
- **Variants over extra state.** Prefer `hover:`, `focus-visible:`, `aria-*`,
  `data-*`, `group-*` and `has-*`, and container queries (`@container` with
  `@xl:`, `@2xl:`) over window breakpoints for a block that lives in a column of
  unknown width (the status cards and the delivery filters do).
- **Focus ring is an outline.** `focus-visible:outline-2 outline-offset-2
  outline-ring`. Do not add `outline-none` next to it: in Tailwind 4 it sets
  `--tw-outline-style: none` and the focus outline never draws.
- **Leaf folder, 300 code lines.** Each component has its own folder with
  `index.tsx` and `index.test.tsx` beside it.

## Adding a component

```sh
cd internal
bunx --bun shadcn@latest add <name>
```

The CLI writes a flat `src/components/ui/<name>.tsx`. Then:

1. Move it to `src/components/ui/<name>/index.tsx` and add `index.test.tsx`.
2. Replace its `cn` import with `@/lib/class-names` (the helper lives in
   `src/lib/class-names/index.ts`; `components.json` points the `utils` alias
   there, but the CLI does not always honour it).
3. Import Radix from the single `@radix-ui/react-<name>` package it needs, not the
   `radix-ui` umbrella, which installs every primitive. Delete any `cn` package
   the CLI adds to `package.json`: it is not the helper.
4. Drop `dark:` utilities, replace the focus ring with the outline above, and make
   every size 32 px on a fine pointer and at least 44 px on a coarse one.
5. `bun add` turns the exact pins of `next`, `react` and `react-dom` into carets:
   restore them in `package.json`.
6. Check it against the strict compiler flags in `internal/tsconfig.json`
   (`exactOptionalPropertyTypes`, `noUnusedParameters`, `noUnusedLocals`,
   `noImplicitReturns`, `noPropertyAccessFromIndexSignature`,
   `verbatimModuleSyntax`, `erasableSyntaxOnly`). Every component in the tree
   passes them without edits beyond the ones in steps 1 to 4; if a freshly
   generated file does not (an unused parameter or an optional prop passed
   `undefined`), fix the file, not the flag. The CLI could not be run offline
   when the flags went in, so this is checked against the existing files only.
7. Run `bun run lint`, `bun run typecheck`, `bun test --coverage`, `bun run build`,
   then the end-to-end run and read the console for CSP violations on a page that
   renders the component.

New runtime packages join the `ui` group of `.github/dependabot.yml`. Icons
follow `icons.md`.

The generated Sidebar exceeded 300 code lines, so it lives in leaf folders under
`components/ui/sidebar/` (`context`, `provider`, `sidebar`, `trigger`,
`regions`, `group`, `menu`, `use-is-mobile`), imported by path, with no barrel.
Parts the panel does not use (rail, input, skeleton, sub-menus, badges, separator) were not
kept.

## In use

| Component | Where | CSP (built server, console read) |
|---|---|---|
| Button | sign-in, nav, Remove, error and 404 pages | no violation, no `style` attribute |
| Input, Label | sign-in form | no violation |
| Alert | `warning` for the unreachable notice on four pages, `destructive` for the sign-in error | no violation |
| Card | status counters | no violation |
| Table | queue, deliveries, suppression, domains, accounts | no violation; rows striped by tone, no lines |
| AlertDialog (`ConfirmAction`) | the five confirmations: remove queue entry, suppressed address, masked address, enrol and turn off two-factor | **needs the nonce**: one `style-src-elem` violation without `StyleNonce`, none with it (built server, light and dark). Focus lands on Cancel, Tab cycles inside, Escape closes, the focus returns to the control, page scroll is locked and released |
| Badge | delivery outcome | no violation; static, the label always says the outcome |
| Empty | empty tables and the empty sections of the account page | no violation; static |
| Breadcrumb | account page | no violation; static |
| Sidebar (provider, rail, menu, trigger) | every signed-in page | none at first paint, after hydration, collapsed or expanded; width variables are classes |
| Sidebar tooltip (own, no popper) | collapsed sidebar icons | none after hover or keyboard focus (placed through the CSSOM); Escape dismisses it |
| DropdownMenu, non-modal, loaded on demand | language menu | none after opening; the modal default injects a style element and was replaced. Its code loads on hover, focus or press of a placeholder button |
| Sheet, native `<dialog>` | sidebar below 768 px | none after opening; Radix Dialog violated and was replaced |
| Form (react-hook-form) | sign-in | no violation; classes only |
| Toaster (own) | mutation outcomes, one region in the shell | none; classes only |
| Native `<select>` | delivery log filters | no violation. Radix Select was measured and kept out: its `SelectValue` puts `style="pointer-events:none"` in the server HTML (a `style-src` violation, and a nonce cannot cover an attribute), its viewport injects a `<style>` element with no nonce prop wired, and the filter form is a plain GET form that works without script |
| Skeleton | loading states | no violation; static, never pulses |

Measured in the built server and not used: Radix Dialog (same result as AlertDialog, with the nonce: no violation, but no screen needs it), Popover and Tooltip (no violation, no screen needs them; the sidebar keeps its own tooltip), Select (above). Sonner (it injects a `<style>` element with no nonce when it loads, 16 violations in one page view with version 2.0.8; the panel's own `components/ui/toaster` replaces it). From the shadcn catalogue nothing else is installed: a component joins the tree when a screen uses it, so Spinner (a looping animation, against the no-decoration rule), InputOTP (the panel never takes a one-time code, it shows a secret), Kbd (no shortcut exists), Pagination, ToggleGroup, Checkbox and Switch (no such control in any screen) wait for the screen that needs them. `Field` is not used because the forms already compose `Form` (react-hook-form); the two do not mix.

## Semantic roles of the Alert

An unreachable API is a warning, not a destructive state, so the Alert has three
variants: `default`, `warning` (amber, `--warning` and `--warning-foreground`) and
`destructive` (a soft red fill, `--destructive-soft`, for a failure the person caused or
can retry, such as a refused sign-in). Do not borrow `destructive` for a state that
only needs attention. The alerts have no border: the fill is the boundary. Both
themes' values live in `styles/theme.css` and were measured: warning text on its
fill 8.44 (light) and 12.05 (dark), destructive text on its fill 5.52 and 7.84.
