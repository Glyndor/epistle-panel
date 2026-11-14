# The message list of the webmail

Part of [`mail.md`](mail.md): how a row of the list is drawn, what the list
does with the changes made from it and what it remembers for the page.

## Rows, date groups and density

A row (`components/message-row`) is a list item that holds the link to the
message and, after it, the two buttons of `components/row-actions` as siblings:
a button inside a link is not valid HTML. The keyboard goes link, important,
star, and nothing sets a `tabindex`. Every state has a sign that is not a
colour, and none changes the row's height:

| State | Sign |
|---|---|
| unread | heavier sender and subject, and a dot in the row's start margin. It stands on the pane like a read one: the pane has one surface |
| starred, important | the mark filled beside the date, always in view; not set, its outline shows with the pointer on the row, with the focus in it, and always on a coarse pointer |
| answered, forwarded | the reply or the forward icon before the subject |
| draft | the word, before the name |
| attachment | a clip before the date |
| labels | chips or a count after the subject (`components/label-chips`, below) |
| open in the reader | the accent surface and a mark at the start edge, inside the focus ring, which keeps its four sides. Under the pointer and pressed the surface steps toward the pane's (the accent at 50% and at 25%) and the subject is underlined |

All of it is said once in words to assistive technology, in one sentence at the
start of the link; the icons, the chips and the draft badge are hidden from it.
Every text taken from a message stands in `<bdi>`: the sender, the subject, the
preview, the initials, each label's name in the chip, in that sentence and in
the tooltip of a count.

- **Height.** 72 px comfortable (two lines and the preview), 40 px compact,
  44 px compact on a coarse pointer. The lines inside have fixed heights, so a
  badge, an icon or a chip never makes a row taller. The skeleton
  (`components/list-skeleton`) has the same heights, margins and gaps, and its
  toolbar bars are as tall as the search field and the filters: nothing moves
  when the messages arrive (compared by position at 1280, 1024, 768 and 360 px).
  The loading state of the route (`app/app/mail/(places)/loading.tsx`) also
  holds the place of the link to the composer that the page draws over the
  list below 768 px.
- **Compact is two short lines, and one line only from 42rem of row.** One
  line cannot hold a row's parts at the widths the panes have: at 360 px with a
  coarse pointer the margin, the two buttons, the state icons, a 6rem subject,
  a count, the clip and the date add up to 364 px of a 328 px row before any
  sender. So a compact row keeps its height and puts the sender, the clip and
  the date over the subject and the labels, in 12 px text. Where the row is
  42rem or more it is one line: sender (8rem), subject, date.
- **The subject comes first.** It has a least width and everything else on
  its line gives way before it: 6rem, and 10rem with a fine pointer from 24rem
  of row; compact, 5rem under 20rem, 6rem from there, 10rem from 24rem (12rem
  with a fine pointer), 8rem on one line. The sender gives way down to 3rem
  before the clip and the date, which keep their width. The initials are left
  out of a row too narrow for them (under 20rem; under 24rem when compact).
  The row is the container these ask (`@container/row`), since its width
  follows the pane and the sidebar, not the window.
- **The filters stay on one line** in every language
  (`components/filter-strip`): a second line put the list a line lower than
  its skeleton. They do not wrap; what does not fit is out of view at an end
  and is reached three ways. By the keyboard: a filter that takes the focus
  from a key is brought into view with its ring whole; the chevrons stay
  hidden while a filter has keyboard focus (a browser did not bring a link
  cut by this box into view: `scrollLeft` stayed 0). Not for a press, which gives the focus on its way down: the
  strip moving then would put another filter under the pointer. By a pointer:
  a chevron on the pane's surface at each end that hides more than 8 px moves
  the strip and is the sign that there is more; it is not in the tab order
  nor in the accessibility tree. By touch or a wheel. Each filter has
  three fills: at rest, darker under the pointer and darker under a press,
  and the one in use has its own three. Their side padding is 10 px with a
  fine pointer: with 12 the four did not fit 360 px in Italian and Portuguese.
- **A chip is never drawn without a readable name.** Its least width is four
  characters of name, its dot and its padding; a name of four characters or
  fewer is never cut and its pill is as wide as it. Where a row's line cannot hold
  that beside the subject's least width, no chip is drawn and the labels are
  a count of all of them (`+N`); they are never left out. Comfortable: a count
  under 24rem, one chip and a count from 24rem, three from 32rem. Compact: a
  count under 32rem, one chip and a count from there. The names behind a count
  show under the pointer, and the reader of the open message lists every label
  as a chip (`components/reader-header`), for whoever has no pointer.
- **Density** is the reader's choice, kept in the `mail-density` cookie (a
  year, `HttpOnly`, only under `/app/mail`) and read on the server
  (`queries/list-density`): the list pane carries `data-density` and the class
  `group/list`, and the rows, the headings and the skeleton read it with
  `group-data-[density=compact]/list:`. The first frame is already right,
  `loading.tsx` included. The switch (`components/density-toggle`) is at the
  end of the search's line: beside the filters it pushed them onto a second
  line at 360 px. It sets the attribute at once and then calls
  `setListDensity`, which checks the session and the value again; a refusal
  puts the attribute back and says so.
- **No press is lost.** epistle replaces a message's whole keyword set, so the
  changes to one message are written one after the other, each on what the one
  before left (`useMessageChange` gives its mutation a scope by message, which
  also orders a change from the reader's toolbar and one from the row). Each
  shows at once. `patchFlags` keeps, for each flag of a message with a change
  on its way, the value the server last confirmed: a refused change leaves the
  flag at the value of the last change still waiting on it or, with none
  left, at the confirmed one, and a toast says so. The opposite operation
  would not do: with a star and its removal both refused it left a star the
  server did not have. A change that worked says nothing from a row, which
  already shows it. The lists are read again once, after the last change that
  waits on any message: read between two, a list came back without the mark
  that still waited. A message that left its folder is the exception: the
  lists are read at once, and a change that waited behind the move is dropped
  without asking the server, since the message has another id by then.
  While a change is on its way the buttons say so without moving anything
  (`components/busy-mark`): `aria-busy`, the progress cursor and a dot on the
  button's corner. So do the star and the read mark of the reader's toolbar,
  which stay open to a press meanwhile; a move shuts the toolbar until it is
  answered.
- **No transform above a control with a tooltip.** The tooltip is
  `position: fixed`, and a transformed ancestor becomes the frame it is placed
  in. The box of the row's buttons is centred with its own height.
- **A run of rows keeps its key** (`message-groups`): its date group and which
  run of that group it is. Keyed by its first message, the whole run was drawn
  again when that message left, and a control with the focus in it was lost.
- **The ring of a row's mark is inside the button on a coarse pointer**, where
  the button is as tall as a compact row: outside, the heading that sticks
  over the first row of a group covered one side of it.
- **Date groups** (`components/message-groups`): a real `h3` over each run
  (today, yesterday, last few days, then the month and year through `Intl`, in
  UTC like the grouping), under the list's `h2`, which `MessageList` draws for
  assistive technology around every state of the list. Each run's `ul` is
  named by its heading. The heading sticks to the top of the pane while its run
  scrolls, and the pane's `scroll-pt-8` is the heading's height, so a row the
  keyboard reaches is not left under it. A row prints the hour under today and
  yesterday and the day under the rest; its `time` element holds the whole
  date.
- **A tone class is written out** (`bg-label-1` to `bg-label-8` in
  `components/label-chip`): Tailwind keeps only the classes it finds as text,
  so one built from the number would paint nothing.

## What the list remembers for the page

Opening a message, moving to the next one and going back to the list are
different pages of the same place, so the list is drawn anew each time: a new
element, at the top, with no focus. Whatever one drawing knew goes with it. So
what the list has to know across them is kept for the page, in one module
(`message-list/list-memory`), and only these rules write it and read it. It is
never read while a component renders.

**What it holds**

| Entry | What |
|---|---|
| `scroll` | how far the list is scrolled, by the list's address (folder, page, filter, search) |
| `held` | the control of a row that has the focus, or had it when the focus was lost |
| `acted` | the row the person's last action concerns |
| `shown` | the messages last drawn, in order, and the address they are of |
| `heirs` | the 100 rows that left last, each pointing to its current successor; a successor that leaves hands over again, so a reader can return after several refreshes |

**Who writes**

| Entry | Who | When |
|---|---|---|
| `scroll` | the list | each scroll of its box, once it has its messages |
| `held` | the list | a control of a row takes the focus |
| `acted` | the list | a press in a row, which is also what Enter, Space, `j` and `k` send |
| `held` and `acted` | the reader (`handFocusToList`) | the open message leaves through the reader (archive, spam, delete), or the person goes back to the list. Only when the focus is the reader's to give: on the page, in the reader, or in a dialog opened from it |
| `shown` | the list | each time it is drawn with its messages |

**Who reads**, each time the list is drawn with its messages (a list still on
its way reads nothing and uses nothing up):

1. Drawn anew, it puts the scroll of its address back before the first paint.
2. When the focus is adrift (on the page, or on an element that is gone) and
   `held` names a row: the same control of that row if it is still listed,
   else of the row after it, else of the row before, else the notice of the
   empty list. A list drawn anew with no rows at all gives the focus to that
   notice when `acted` names a row that is not there: the node that had the
   focus went with the row, and the notice is what the list has left to give
   it to. Putting the focus never moves the scroll by itself.
3. It brings a row into view, only as far as needed (`block: "nearest"`):
   drawn anew, the row that got the focus back, or else the row acted on;
   read again in place, a restored focus is also brought into view, whether
   its row stayed or was replaced after a background update. A background
   update that restores no focus brings nothing into view.
4. An entry is used up only when what it asks for happened. Where the list is
   not in view (the reader is the only pane) the focus cannot land: `held` and
   `acted` are kept, aimed at the row that would have taken them, for the list
   that is drawn next.

**When it is forgotten**

| Entry | When |
|---|---|
| `held` | the focus goes to a control outside the rows; a press outside its row; another control takes it |
| `acted` | the next action replaces it; its row is gone and the row after was brought into view (a list with no rows has no row after it, so the action waits for one); a press outside the list |
| `held`, `acted`, `shown`, `heirs` | a list of another address is drawn |
| `scroll` | never within a page load, but only the 20 most recent addresses are kept |
| all | `forgetListMemory()`, for tests only, after each case |

**The reader's side.** The title of a message the person opened takes the
focus (at every width, once per message) only when the focus is on the page or
in the rows: a focus the person already took to the search field, a field of
the composer or a dialog is theirs, and the keys they type there must not
become shortcuts. A message that comes with the page takes the focus only
where the reader is the one pane in view. Going back (`u` or the link) and a
message that leaves from the reader both hand the focus to the list for that
message: back on its row, or on the row after it.

A run of rows also keeps its key (below), so a row that stays is the same
element while the list is read again in place.

## The label tones

`--label-1` to `--label-8` in `styles/theme.css`, in the light list and both
dark ones (`theme.test.ts` fixes the values). A chip is `--foreground` at 10%
over the row, so it shows on every surface a row takes; the dot is the tone.
Calculated from the tokens (8-bit sRGB, the chip mixed over each surface a row
takes: the pane, under the pointer, open, and open under the pointer and
pressed), not read from a rendered page:

| Tone | Light | Dark | Dot against the chip, lowest of the surfaces a row takes: light, dark |
|---|---|---|---|
| 1 blue | `#083a88` | `#82c2f7` | 7.00, 4.85 |
| 2 brown, amber | `#392b16` | `#e58803` | 9.01, 3.46 |
| 3 red | `#9b4251` | `#fcc1b6` | 4.19, 5.92 |
| 4 violet | `#794acb` | `#ae83f8` | 3.77, 3.26 |
| 5 teal | `#0d7d89` | `#aafcfe` | 3.20, 7.96 |
| 6 green | `#155a06` | `#8cd55e` | 5.52, 5.19 |
| 7 pink | `#671156` | `#fb78ae` | 7.70, 3.70 |
| 8 olive | `#83710d` | `#f5f778` | 3.18, 8.13 |

The lowest is always the open row (`--accent`). The floor is 3:1 (WCAG 1.4.11).
Every pair of the eight is checked the way the chart colours are (`charts.md`):
distance in OKLab times 100, floors 15 with full colour vision and 8 with
protanopia or deuteranopia simulated. Smallest distances: light 16.1 and 8.6,
dark 16.5 and 8.9. Tritanopia is not in the floor (4.6 and 3.5); a chip always
carries the label's name. An override of the tones should be checked the same
way, over all 28 pairs and against the chip on the open row.

