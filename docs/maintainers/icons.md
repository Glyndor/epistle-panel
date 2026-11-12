# Icons

Every icon in the panel is an inline SVG React component. No `<img>`, no icon font
and no URL to an external file: the CSP is `default-src 'self'` and a request to
another host would be blocked.

## Order of preference

1. **`lucide-react`** (ISC licence). Import each icon by name
   (`import { GlobeIcon } from "lucide-react"`), never the whole namespace, so
   the bundler keeps only the icons used. Give each one `aria-hidden="true"`
   when a visible label sits beside it, and let the label name the control.
2. **A custom component** when Lucide has no fitting icon:
   `internal/src/components/icons/<name>/index.tsx`, with its test beside it.
   It draws on the 24 px grid with a 2 px round stroke (`strokeWidth="2"`,
   `strokeLinecap="round"`, `strokeLinejoin="round"`, `fill="none"`) so it sits
   next to a Lucide icon without a visible difference, uses `currentColor`, is
   `aria-hidden="true"` and takes `React.ComponentProps<"svg">`.
3. **A downloaded icon**, only from a permissive collection: Tabler or Phosphor
   (MIT) for general icons, Simple Icons for brands. Read the SVG before it goes
   in: no `<script>`, no `style` attribute or `<style>` element, no `<use>` or
   `<image>` pointing elsewhere, no event attributes. Redraw it as a component
   with `currentColor` and the stroke above, and add a row to the table below
   with its source and licence.

## Inventory

| Icon | Where | Source | Licence |
|---|---|---|---|
| `EpistleMark` | sidebar header | drawn for this panel, `components/icons/epistle-mark` | the repository's own (MIT) |
| Lucide: `LayoutDashboardIcon`, `GlobeIcon`, `UsersIcon`, `InboxIcon`, `LanguagesIcon`, `LogOutIcon`, `PanelLeftIcon`, `XIcon` | navigation, language menu, sign out, sidebar toggle, sheet close | `lucide-react` | ISC |

The custom component's test asserts the properties above: decorative, 24 px
`viewBox`, `currentColor`, and no script, style or external reference.
