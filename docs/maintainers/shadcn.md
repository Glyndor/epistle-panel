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
  Static components (Button, Input, Label, Table, Card, Alert, Badge, Separator,
  Skeleton) set none.
- **44 px touch targets.** shadcn's `h-9` is too small. Every size variant of an
  interactive component sets `min-h-11` or more, and the tests assert it.
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
   every size at least 44 px.
5. `bun add` turns the exact pins of `next`, `react` and `react-dom` into carets:
   restore them in `package.json`.
6. Run `bun run lint`, `bun run typecheck`, `bun test --coverage`, `bun run build`,
   then the end-to-end run and read the console for CSP violations on a page that
   renders the component.

New runtime packages join the `ui` group of `.github/dependabot.yml`.

## In use

| Component | Where | CSP (built server, console read) |
|---|---|---|
| Button | sign-in, nav, Remove, error and 404 pages | no violation, no `style` attribute |
| Input, Label | sign-in form | no violation |
| Alert | unreachable notice on four pages, sign-in error | no violation |
| Card | status counters | no violation |
| Table | queue, domains, accounts | no violation |

Not used on purpose: Dialog, AlertDialog, Select, Popover, Tooltip and DropdownMenu,
which position with inline styles. The Remove confirmation stays the native
`confirm` until the owner decides how to allow a modal under this policy.
