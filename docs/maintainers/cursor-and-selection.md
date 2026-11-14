# The cursor and what can be selected

Two things the panel used to do unevenly: which text can be selected, and which
cursor a control shows. One rule covers both, and every component follows it.

## What can be selected

The chrome of the panel is not selectable. The content of the panel is.

| Chrome, not selectable | Where it lives |
|---|---|
| a button, and the label of an icon button | `components/ui/button` |
| an entry of the sidebar | `components/ui/sidebar/menu` (`SidebarMenuButton`) |
| a tab | a `Tabs` component, when the panel has one |
| a filter | the pills of the list (`features/mail/components/list-toolbar`) |
| a chip | `components/ui/badge`, `features/mail/components/label-chip` |
| the heading of a date group | `features/mail/components/message-groups` |
| the marks of a row | `features/mail/components/row-actions` |
| a tooltip | `components/ui/tooltip` |
| a button that opens and closes a part | `components/ui/collapsible` |

| Content, selectable | Where it lives |
|---|---|
| the subject, the sender and the body of a message | the reader |
| an address | the reader's headers (`features/mail/components/reader-header`) |
| an id, a value in a table of the administration | the tables |
| an error message | `components/error-notice` |

The chrome says it in the shared part that draws it, so a component inherits it
instead of saying it again: `select-none` on the button, the badge, the entry
of the sidebar, the tooltip, the chip and the disclosure. A component that
draws its own chrome says it in its own class.

A row of the list is a link, so it is chrome: `select-none` on the link of the
row (`features/mail/components/message-row`). A double click on a row does not
leave half the list selected, and the subject, the sender and the body of a
message are copied from the reader, where the message is open.

## The cursor

| What | Cursor |
|---|---|
| what navigates or acts on a press: a link, a button, a menu item | `pointer` |
| what does nothing | `default` |
| a control that is off | `not-allowed` |
| what is busy and still takes a press | `progress` |
| what is busy and takes no press | `wait` |
| a field | `text` |
| what is dragged | `grab`, and `grabbing` while it is dragged |
| the line between two panes | `col-resize` |
| where a press explains something | `help` |

The map is one block in `internal/src/app/globals.css`, in `@layer base`. Every
rule there is wrapped in `:where()`, so it carries no specificity of its own:
the order of the rules is the order of the map, and the last one that matches
is the one that paints. A utility (`cursor-*`) still wins over all of it, since
the utilities come after the base layer.

What the block decides by what the element is:

- a control that is off (`:disabled` or `aria-disabled="true"`) is
  `not-allowed`. A busy control that is also off is `wait` instead: what it
  waits for is the work, not the press.
- a busy control (`aria-busy="true"`) that still takes a press is `progress`;
  a busy region that takes no press (a skeleton, a loading notice) is `wait`.
- a field is `text`, and the controls that take no text but act on a press (a
  checkbox, a radio, a file) are `pointer`.

A control that is off does not take the pointer (the panel's
`disabled:pointer-events-none`): what the person sees over it is the cursor of
the surface under it, and the control itself computes `not-allowed`.

Two cases no element can be asked about, so the component that has them says
them: what is dragged (`cursor-grab`, `cursor-grabbing`) and where a press
explains something (`cursor-help`). The panel has none of them today.

One exception, kept where it was: the label of a field that is off is
`not-allowed` (`peer-disabled:cursor-not-allowed`, `components/ui/label`).
