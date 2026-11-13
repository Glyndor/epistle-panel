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
  and the other roles. The values flip in `internal/src/styles/theme.css`, with
  `prefers-color-scheme` or with the theme the person chose (`data-theme` on
  `<html>`, see `layouts.md`), so a component needs no `dark:` utility.
- **No lines between things.** Hierarchy is tone and space: `bg-background`
  (canvas), `bg-surface` / `bg-card` (a card or a table), `bg-surface-sunken` (a
  stripe, a quiet callout), `bg-surface-raised` plus `shadow-raised` (a menu, a
  toast, a dialog, a sheet: the only shadows). Radii come from `--radius`
  (`rounded-lg` controls, `rounded-xl` cards, `rounded-2xl` dialogs). Do not add
  `border`, `divide-*` or a separator; the panel sets no default border colour.
  A form field is `bg-field` (`FIELD_CLASS` in `components/ui/input`) with a
  2px bottom line in `--field-edge` (3:1 against the surface and the fill, the
  boundary WCAG 1.4.11 asks for), the focus ring on keyboard focus and a
  destructive line and outline when `aria-invalid`. Every field wears it: the
  input, the composer's text area and the native `select`s.
- **Variants over extra state.** Prefer `hover:`, `focus-visible:`, `aria-*`,
  `data-*`, `group-*` and `has-*`, and container queries (`@container` with
  `@xl:`, `@2xl:`) over window breakpoints for a block that lives in a column of
  unknown width (the status cards and the delivery filters do).
- **Focus ring is an outline.** `focus-visible:outline-2 outline-offset-2
  outline-ring`. Do not add `outline-none` next to it: in Tailwind 4 it sets
  `--tw-outline-style: none` and the focus outline never draws.
- **Leaf folder, 300 code lines.** Each component has its own folder with
  `index.tsx` and `index.test.tsx` beside it.

## A component, not an element

A screen is composed from `components/ui`. It does not write by hand a control
the panel has a component for: a `select`, a `textarea`, a `details`, a
`dialog`, a `table`, a `kbd`, a radio input, the browser's `confirm`. The
components are on the panel's tokens, sized for both pointers and measured
against the policy; a hand-made control is none of that.
`src/test/shadcn-over-html` reads every screen and fails with the file and the
component to use. A file excused there says why, and leaves the list when it is
changed.

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

What the CLI did when `pagination` was added on 2026-11-13, so the next run is
no surprise: it wrote `ui/pagination.tsx` and a second, flat `ui/button.tsx`
beside the existing `ui/button/`, and added `cn` and the `radix-ui` umbrella
to `package.json` and `bun.lock`. The flat button was deleted, `package.json`
and the lockfile were restored (the component needs no new package) and
`node_modules` reinstalled from the lockfile. The generated file drew links
with hard-coded English names; ours draws buttons, since the tables change
page in place, takes its names from the caller and marks the ends with
`aria-disabled`.

## In use

| Component | Where | CSP (built server, console read) |
|---|---|---|
| Button | sign-in, nav, Remove, error and 404 pages | no violation, no `style` attribute |
| Input, Label | sign-in form | no violation |
| Alert | `warning` for the unreachable notice on four pages, `destructive` for the sign-in error | no violation |
| Card | status counters | no violation |
| Table | queue, deliveries, suppression, domains, accounts | no violation; rows striped by tone, no lines |
| AlertDialog (`ConfirmAction`) | the six confirmations: remove queue entry, suppressed address, masked address, enrol and turn off two-factor, delete a message for good from the trash (the button, or the Delete and # keys through `open` and `onOpenChange`) | **needs the nonce**: one `style-src-elem` violation without `StyleNonce`, none with it (built server, light and dark). Focus lands on Cancel, Tab cycles inside, Escape closes, the focus returns to the control, page scroll is locked and released |
| Dialog | the new-account form | **needs the nonce**, like AlertDialog, and is hosted by the shell that mounts `StyleNonce`. Measured in the built server at 1280 px light and 360 px dark: no console error, axe clean with it open, it fits a 360 px window and scrolls inside; Escape and the close button close it and the focus returns to the button. Its form is loaded when it first opens (`next/dynamic`) |
| Textarea | addresses of a new account, the composer's body | no violation; the shared field look, taller |
| RadioGroup | what to do with queued mail when an account is deleted | no violation, no style attribute. One tab stop; an arrow key moves the focus and takes the choice it lands on while the key is held (a script that releases the key in the same instant moves only the focus: press with a delay when testing in a browser), Space takes the focused choice, a click on the label takes it too. 16 px, 24 px on a coarse pointer |
| Collapsible | all headers of a message, the keyboard shortcuts of the list | no violation; the served page has no style attribute (Radix sets the content's size from script once it opens). Closed to start with: the content is not in the page until the button is used, and the button says so (`aria-expanded`) |
| NativeSelect | delivery log filters, the page size of a table | no violation. A real `select` on the shared field look with the panel's arrow: it works before any script loads and in a plain `GET` form, which is where Radix Select cannot be used |
| Pagination | the foot of the accounts, domains and delivery tables (`components/data-table/pagination`) | no violation, no style attribute (built server, 360, 768 and 1280 px, light and dark; axe clean). Buttons, not links. 32 px, 44 px on a coarse pointer. Enter on Next up to the last page keeps the focus on it. At an end the control dims its icon and its text, not itself: dimmed whole, its focus ring measured 1.89:1 (light) and 2.75:1 (dark); now 4.28:1 and 7.87:1 |
| DropdownMenu tick boxes, rendered in `main` | the Filters menu of the accounts and domains tables | no violation with the menu open and after a tick. Non-modal like the others; a tick leaves it open, Escape returns the focus to the button. The box is drawn ticked and unticked, with the field's edge line (3.4:1 or more against the row and its own fill, measured in both themes) |
| Kbd | the keys in the shortcuts list | no violation; static |
| Badge | delivery outcome | no violation; static, the label always says the outcome |
| Empty | empty tables and the empty sections of the account page | no violation; static |
| Breadcrumb | every admin page, above its heading (`features/navigation/components/admin-breadcrumbs`) | no violation; static, a server component with links |
| Sidebar (provider, rail, menu, trigger) | every signed-in page | none at first paint, after hydration, collapsed or expanded; width variables are classes |
| Sidebar tooltip (own, no popper) | collapsed sidebar icons | none after hover or keyboard focus (placed through the CSSOM); Escape dismisses it |
| DropdownMenu item, rendered in `main` | the actions of an account row (open, delete) | no violation. A table scrolls sideways, which clips what leaves it, so the list is rendered in the page's `main` (`container`), found when the menu opens: inside a landmark, never on `body`. Measured on the last row at 1280 and 360 px: whole, on top, focus on the first item, Escape returns it to the button |
| DropdownMenu, non-modal, loaded on demand | profile menu and theme menu of both headers | none after opening; the modal default injects a style element and was replaced. Its code loads on hover, focus or press of a placeholder button, through `components/layout/lazy-panel` and not `React.lazy`: when the download fails the button stays, a toast says so and the next press tries again (with `lazy` the failure replaced the whole page). Radix moves the focus to the first item only for a key press it saw itself, so a menu that the placeholder opens from the keyboard focuses its first item on its own (`lib/first-item-focus`). The profile menu is as tall as the window allows and scrolls inside (`--radix-dropdown-menu-content-available-height`, set through the CSSOM) |
| Avatar, initials only | the profile button of both headers | no violation, no `style` attribute in the server HTML. The image part was not kept: the panel loads no picture. The initials are decoration (`aria-hidden`); the button's name says the account |
| Sheet, native `<dialog>` | sidebar below 768 px | none after opening; Radix Dialog violated and was replaced |
| Form (react-hook-form) | sign-in, the account forms; `FormDescription` for a help text | no violation; classes only |
| Toaster (own) | mutation outcomes, one region in the shell | none; classes only |
| Native `<select>` | delivery log filters | no violation. Radix Select was measured and kept out: its `SelectValue` puts `style="pointer-events:none"` in the server HTML (a `style-src` violation, and a nonce cannot cover an attribute), its viewport injects a `<style>` element with no nonce prop wired, and the filter form is a plain GET form that works without script |
| Skeleton | loading states | no violation; static, never pulses |

Measured in the built server and not used: Radix Dialog (same result as AlertDialog, with the nonce: no violation, but no screen needs it), Popover and Tooltip (no violation, no screen needs them; the sidebar keeps its own tooltip), Select (above). Sonner (it injects a `<style>` element with no nonce when it loads, 16 violations in one page view with version 2.0.8; the panel's own `components/ui/toaster` replaces it). From the shadcn catalogue nothing else is installed: a component joins the tree when a screen uses it, so Spinner (a looping animation, against the no-decoration rule), InputOTP (the panel never takes a one-time code, it shows a secret), Kbd (no shortcut exists), ToggleGroup, Checkbox and Switch (no such control in any screen) wait for the screen that needs them. The tick boxes of the Filters menu are menu items of the DropdownMenu, not the Checkbox component. `Field` is not used because the forms already compose `Form` (react-hook-form); the two do not mix.

## The focus ring and a filled control

Decided 2026-11-13, with the numbers measured in the built panel. The focus
ring is an outline 2 px away from the control (`outline-offset-2`), so it is
painted on the surface around the control and never on the control's own
fill. It is held to 3:1 against that surface: 4.28:1 in the light theme and
7.87:1 in the dark one. Against the fill of a primary control (the current
page of a table, a primary button) the same ring measures 3.67:1 in the light
theme and 2.27:1 in the dark one. That second pair is accepted as it is: the
two colours do not touch, and the gap between them is the surface the ring
does contrast with. Do not "fix" it by moving the ring onto the control.

A menu item draws its ring inside itself (`-outline-offset-2`), in the ring
colour from the start (`outline-ring` with no `focus:`): the items have a
colour transition, and with the colour set only on focus the ring faded in
from the text colour over its first 150 ms. The item under the pointer shows
the ring too, since in a Radix menu the pointer moves the focus.

The tick box of a menu item has a 2 px line on its four sides
(`inset-ring-2 inset-ring-field-edge`) and a small corner (`rounded-xs`, a
third of `--radius`, defined with the other radii in the theme). The line is
what makes an unticked box visible at 3:1; it stays.

## Semantic roles of the Alert

An unreachable API is a warning, not a destructive state, so the Alert has three
variants: `default`, `warning` (amber, `--warning` and `--warning-foreground`) and
`destructive` (a soft red fill, `--destructive-soft`, for a failure the person caused or
can retry, such as a refused sign-in). Do not borrow `destructive` for a state that
only needs attention. The alerts have no border: the fill is the boundary. Both
themes' values live in `styles/theme.css` and were measured: warning text on its
fill 8.44 (light) and 12.05 (dark), destructive text on its fill 5.52 and 7.84.
