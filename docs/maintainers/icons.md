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

## One size and one stroke for each role

An icon takes its size from the component that holds it and its stroke from the
icon set (2 px on the 24 px grid), so two entries, two actions or two rows
never differ by the weight of their icon. A screen passes neither a size class
nor a `strokeWidth` to an icon of a control; `src/test/icon-roles` reads the
source and fails when one does.

| Role | Size | Set by |
|---|---|---|
| An entry of the sidebar's navigation, in both areas | 16 px | `SidebarMenuButton` (`[&>svg]:size-4`) |
| An action of a bar: a button with an icon, alone or beside its name | 16 px | `Button` (`[&_svg:not([class*='size-'])]:size-4`) |
| A row of a menu and the heading of a run of rows | 16 px | `DropdownMenuItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel` (`[&_svg]:size-4`) |
| The mark between two steps of a trail | 14 px | `BreadcrumbSeparator` |
| The arrow that says how a column is sorted, the marks of a message's state in its row | 14 px | the mark itself; they are not the icon of a control |
| The tick inside a 16 px box | 12 px | `DropdownMenuCheckboxItem` |

A control that is an icon alone has an accessible name (text of the control
that is not drawn, or `aria-label`) and is the child of a `Tooltip`
(`components/ui/tooltip`), which shows that name, and the control's key when it
has one, on hover and on keyboard focus. `src/test/icon-only-has-tooltip` holds
it for every button of the icon size.

Every row of a menu that is an action carries an icon. A row that is one of a
set of choices carries the mark of the set (a dot, a tick); the theme's choices
carry their own icon as well, the one the theme button shows. A language is
told by its name: the icon is on the heading of the run.

## Inventory

| Icon | Where | Source | Licence |
|---|---|---|---|
| `EpistleMark` | sidebar header | drawn for this panel, `components/icons/epistle-mark` | the repository's own (MIT) |
| Lucide: `LayoutDashboardIcon`, `GlobeIcon`, `UsersIcon`, `InboxIcon`, `BanIcon`, `HistoryIcon`, `ShieldIcon`, `LogOutIcon`, `SunIcon`, `MoonIcon`, `MonitorIcon`, `PanelLeftIcon`, `XIcon`, `ChevronRightIcon`, `InboxIcon` | navigation, the administration entry and sign out of the profile menu, the theme button, sidebar toggle, sheet close, breadcrumb mark, empty tables | `lucide-react` | ISC |
| `ImportantMark` | the important mark of a message row | drawn for this panel, `components/icons/important-mark`: Lucide has no importance mark that can be filled | the repository's own (MIT) |
| Lucide: `StarIcon`, `PaperclipIcon`, `ReplyIcon`, `ForwardIcon`, `Rows2Icon`, `Rows4Icon` | the star, the clip of an attachment and the answered and forwarded icons of a message row, the density switch of the list | `lucide-react` | ISC |
| Lucide: `ListFilterIcon`, `CheckIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `MoreHorizontalIcon` | the Filters button of a table, the tick of a menu box, previous and next page, the gap between page numbers | `lucide-react` | ISC |
| Lucide: `ChevronDownIcon`, `PenLineIcon`, `InboxIcon`, `FileEditIcon`, `SendIcon`, `ArchiveIcon`, `ShieldAlertIcon`, `Trash2Icon`, `FolderIcon` | the heading of a navigation group, the composer and the folders of the mail area's sidebar | `lucide-react` | ISC |
| Lucide: `PaletteIcon`, `LanguagesIcon`, `UserCogIcon`, `Trash2Icon` | the headings of the theme and language runs of the profile menu, the two actions of an account's row | `lucide-react` | ISC |

The custom component's test asserts the properties above: decorative, 24 px
`viewBox`, `currentColor`, and no script, style or external reference.
