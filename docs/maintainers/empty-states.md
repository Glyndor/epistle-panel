# Empty states

A list or a pane with nothing in it says so the same way everywhere: a drawing,
a title, one sentence and the next step as a real link or button. The text
carries the meaning; the drawing is decoration.

| Part | Folder | What it is |
|---|---|---|
| `EmptyState` | `components/empty-state` | the drawing, the title (`EmptyTitle`), the sentence and the action, on `components/ui/empty`. Presentational: no `"use client"`, so a server page and a client table draw it alike. Props of the wrapper (`role="status"` for a list that empties after a navigation, a class) pass through |
| `Illustration` | `components/illustration` | an empty `span` that wears one drawing as a CSS mask and paints it in `bg-muted-foreground` |
| the drawings | `styles/illustrations/*.svg`, `styles/illustrations.css` | one file each, 96 px grid, black shapes with an alpha for the second tone |

## Where each one is used

| State | Drawing | Title and sentence | Next step |
|---|---|---|---|
| An empty mail folder | `tray` | `mail.emptyFolder`, `mail.emptyFolderHint` | Write |
| A search or filter that matched nothing | `search` | `mail.emptyMatches`, `mail.emptyHint` | Clear all (a link to the folder with no condition) |
| No message open in the reader | `letter` | `mail.readerEmptyTitle`, `mail.readerEmpty` | Write |
| No accounts | `people` | `accounts.empty`, `accounts.emptyHint` | New account (the dialog of the page's heading) |
| An empty queue | `tray` | `queue.empty`, `queue.emptyHint` | Open the delivery log |
| An empty suppression list | `shield` | `suppression.empty`, `suppression.emptyHint` | Open the delivery log |
| No domains | `globe` | `domains.empty`, `domains.emptyHint` | none: domains are set on the mail server, and the panel has nothing to press |
| An empty delivery log | `tray` | `deliveries.empty`, `deliveries.emptyHint` | none: the filters are on the page |
| A table whose filters left no row (every table) | `search` | `table.noMatches`, `table.noMatchesHint` | Clear filters |

`DataTable` takes the title as `emptyLabel` and the rest as `empty`
(`DataTableEmpty`: `illustration`, `description`, `action`); a table with a
filter that left no row ignores `empty` and says `table.noMatches`.

## Why a mask and not an `svg`

An `svg` with children rendered inside a streamed part can be cut by React into a
hidden holder that carries an inline `style`, which the policy refuses
([charts.md](charts.md)). A mask is a class on an empty `span`: the file is
served by the stylesheet (`img-src 'self' data:` covers both the file and an
inlined copy) and there is no markup of the drawing in the page at all.
The span paints the colour, so the drawing follows the light and dark themes and
an operator's theme (`--muted-foreground`) without a rule of its own.

In forced colours a mask on a forced background would paint a solid block, so the
span is `forced-colors:hidden`: the words are what is left, and they say all of
it.

## Adding a drawing

1. Draw it on a 96 px grid in one line of an `svg` file in `styles/illustrations/`:
   shapes only, black, `fill-opacity` for a second tone. No `<style>`, script,
   link, `<image>` or `style` attribute. Keep it under 700 bytes.
2. Add its rule to `styles/illustrations.css` (both `mask-image` and the
   `-webkit-` one) and its name to `ILLUSTRATIONS` in `components/illustration`.
3. `components/illustration/index.test.tsx` reads the list, the stylesheet and
   the folder and fails when one of the three drifts, or when a file holds more
   than shapes.

Text goes in the six locales (`internal/src/i18n/messages/*/`): a title and one
sentence, written like the copy around it, with the step named in the sentence.
