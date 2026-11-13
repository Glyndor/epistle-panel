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
  means the component is not used until it can run without a `style` attribute.
  Static components (Button, Input, Label, Table, Card, Alert, Separator) set
  none.
- **Radix overlays that lock page scroll are out.** A modal Radix Dialog or
  DropdownMenu injects a `<style>` element (react-remove-scroll), a
  `style-src-elem` violation. The dropdown is non-modal (`modal={false}`) and the
  Sheet is a native `<dialog>`; see the table below. Every Radix overlay that is
  added needs a test that asserts `document.head.querySelectorAll("style").length`
  does not grow when it opens; `components/ui/dropdown-menu/index.test.tsx` is the
  pattern to copy. Reading the console in the built server is not enough on its
  own, because nothing forces anyone to do it.
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
  `internal/src/app/globals.css`, so a component needs no `dark:` utility.
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
Parts the panel does not use (rail, input, skeleton, sub-menus, badges) were not
kept.

## In use

| Component | Where | CSP (built server, console read) |
|---|---|---|
| Button | sign-in, nav, Remove, error and 404 pages | no violation, no `style` attribute |
| Input, Label | sign-in form | no violation |
| Alert | `warning` for the unreachable notice on four pages, `destructive` for the sign-in error | no violation |
| Card | status counters | no violation |
| Table | queue, deliveries, suppression, domains, accounts | no violation |
| Sidebar (provider, rail, menu, trigger) | every signed-in page | none at first paint, after hydration, collapsed or expanded; width variables are classes |
| Sidebar tooltip (own, no popper) | collapsed sidebar icons | none after hover or keyboard focus (placed through the CSSOM); Escape dismisses it |
| DropdownMenu, non-modal, loaded on demand | language menu | none after opening; the modal default injects a style element and was replaced. Its code loads on hover, focus or press of a placeholder button |
| Sheet, native `<dialog>` | sidebar below 768 px | none after opening; Radix Dialog violated and was replaced |
| Separator | header, sidebar | no violation |
| Form (react-hook-form) | sign-in | no violation; classes only |
| Toaster (own) | mutation outcomes, one region in the shell | none; classes only |
| Native `<select>` | delivery log filters | no violation (the browser draws it; no `style` attribute) |
| Skeleton | loading states | no violation; static, never pulses |

Not used on purpose: Sonner (measured: it injects a `<style>` element when it loads, a `style-src-elem` violation 16 times in one page view with version 2.0.8, and offers no switch to stop it; the panel's own `components/ui/toaster` replaces it), Radix Dialog and AlertDialog (modal, so they inject the
scroll-lock style), Select and Popover (not measured yet). The Remove
confirmation stays the native `confirm`.

## Semantic roles of the Alert

An unreachable API is a warning, not a destructive state, so the Alert has three
variants: `default`, `warning` (amber, `--warning` and `--warning-foreground`) and
`destructive` (red, for a failure the person caused or can retry, such as a refused
sign-in). Do not borrow `destructive` for a state that only needs attention. Both
themes' values live in `globals.css` and were measured: text on the alert 8.73
(light) and 12.05 (dark), border against the page 4.23 and 7.95, border against the
alert 4.08 and 6.02.
