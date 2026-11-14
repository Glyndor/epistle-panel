# Charts

The admin overview (`/app/{id}`) draws four charts under the status counters:
deliveries by outcome, deliveries over time, the queue by waiting time and the
suppression list by domain. They are drawn on the server, from what the API
already gives, with no chart library and no script of their own.

## Where each number comes from, and its limit

The API has no time series and no totals by outcome. Every chart is counted in
the panel from a list the API returns, so each has the limit of its list.

| Chart | Read from | Limit | What the card says at the limit |
|---|---|---|---|
| Deliveries by outcome | `GET /api/v1/deliveries?since=<period>&limit=100`, once per page view | 100 records, no next page | "The server returned 100 records, the most it gives, so this period may hold more" |
| Deliveries over time | the same answer (the two cards share it through `React.cache`) | the same 100 | the hours or days it may not have returned are filled with a band, named in the legend |
| Queue by waiting time | `GET /api/v1/queue?limit=100`, following `next_cursor` for 5 pages at most | 500 messages, the oldest | "These are the 500 oldest messages. The queue holds more, all of them newer" |
| Suppression by domain | `GET /api/v1/suppression?limit=100`, following `next_cursor` for 5 pages at most | 500 addresses, the first in alphabetical order | "These are the first 500 addresses in alphabetical order. The list holds more, so this ranking of domains is of these 500 only" |

The two kinds of limit are not known the same way, and the words follow that:

- **The delivery log cannot say it was cut.** It has no cursor and no total. An
  answer of exactly 100 records is all there is or the first 100 of more, and
  nothing in it tells which. So at 100 the cards speak in the conditional, in
  the six languages: the period *may* hold more, an hour *may* not have been
  returned, a column holds its records *possibly in part*. They never say that
  records are missing, and never that an hour had no delivery.
- **The queue and the suppression list say so.** A page that is not the last
  carries `next_cursor`. A queue of exactly 500 messages ends without one and
  is drawn as the whole queue; one of 620 leaves a cursor after the fifth page,
  and then every sentence of the card counts what was *read*: "500 messages
  read", "500 recipients pending in the messages read", and a description for
  a screen reader that starts "The 500 oldest messages of a queue that holds
  more". The ranking of domains of a capped list is the ranking of its first
  500 addresses in alphabetical order, not of the list, and the note says so.

The period is `24h`, `7d` or `30d`, read on the server from `?since=` with a zod
enum (`features/overview/schemas/overview-input`); anything else is the default,
24 hours. The period links are plain links, so the choice works with no script.

### A full answer is not "the latest 100"

The delivery log is read the way `DeliveryLog::list` in epistle reads it: the
newest UTC day first and, inside a day, the oldest record first, cut at the
limit. So a full answer holds every record of the days newer than the oldest
day in it, and that oldest day only up to its last record in the answer. On a
busy day that can leave out the most recent hours.

`bucketDeliveries` works that out and marks each column `complete`, `partial`
(the one the answer stopped in) or `missing`. A missing column is filled with a
band and reads "may not have been returned" in the table, never 0; the partial
one has the band over what it holds and says "possibly in part", in the table
and in its `title`. It rests on records being in time order inside a day's
file, which is how the server appends them.

### What the API does not give

- **A queued message has no date and no count of attempts.** Its id is a UUID
  of version 7, made when the message is accepted (the OpenAPI document says so
  of the queue's order), and its first 48 bits are that moment in milliseconds.
  The waiting time is read from there (`uuidV7Seconds`). An id of another
  version carries no time and is counted apart as "Unknown".
- **A suppressed address has no reason and no date.** The list is addresses
  only, so the one split the data allows is the domain after the `@`.
- **Real series** (messages per minute, queue depth over time, bounce rate)
  are in the server's Prometheus metrics, on a separate loopback listener with
  no authentication, which the panel does not reach.

## How a chart is drawn

No `style` attribute is allowed by the panel's policy, so nothing can be sized
with a style. A mark is `components/charts/mark`: an `svg` element with nothing
inside, as wide and as high as its `width` and `height` attributes (pixels, or
a percentage of the room around it), painted by a class. Where a mark sits is
flex layout. Words are ordinary text of the page, so a long name is cut with an
ellipsis and a reader can enlarge them.

| Part | Folder | What it is |
|---|---|---|
| `Mark` | `components/charts/mark` | one bar or one part of a bar or column |
| `SegmentedBar` | `components/charts/segmented-bar` | one whole split into parts, 12 px high |
| `StackedColumns` | `components/charts/stacked-columns` | columns over time on a count axis from zero; the levels of the axis are bands of two tones, not lines |
| `BarList` | `components/charts/bar-list` | one series as horizontal bars, a row each |
| `ChartCard`, `ChartImage`, `ChartNote`, `ChartFigure` | `components/charts/chart-card` | the frame: figure, title, the drawing as one image, a caveat, the headline number |
| `ChartLegend`, `Swatch` | `components/charts/chart-legend`, `swatch` | the names of the series beside their colours |
| `ChartData` | `components/charts/chart-data` | the table of the chart behind a "View data" button |

The numbers behind the drawing are pure functions with their own tests:
`lib/charts/shares` (shares in tenths of a percent that add up to exactly
1000, by largest remainder), `lib/charts/segments` (widths of the parts of a
bar, with a minimum for a sliver), `lib/charts/nice-scale` (a count axis that
ends on a round number), `lib/charts/stack` (heights of the parts of a column)
and `lib/charts/axis-ticks`. Counting is in `features/overview/queries`.

Two equal counts can show shares 0.1 apart (7.1 % and 7.2 %): that is the price
of shares that add up to 100 %.

### A column is as high as its total, and no more

`stackColumn` gives a column the height of its total on the scale: total × 160
/ top of the axis, at least 1 px for a column with a value and at most the 160
of the plot. The 2 px gap between two parts and the 3 px a small part is never
drawn under are taken out of the larger parts of the same column, the way
`layoutSegments` does for a bar; they are never added on top. A column too low
for both drops the gaps, and one too low for the minimum shares its height
evenly.

An earlier version added them. On the `skew` sample an hour of 5 records, one
of each outcome, was drawn 23 px high beside an hour of 8 records at 21.3 px,
and 79 records on an axis of 80 came to 168 px in a plot of 160. The tests of
`lib/charts/stack` now hold two properties over generated columns (seeded,
`src/test/prng`): the drawn height is the total on the scale within a pixel,
and a column of more is never lower than a column of less.

A column that holds part of its hour is the least it can be, so the axis is
drawn for a tenth more than it: the plot keeps room over it for the band.

### An `svg` on the server has no child

React streams a page in pieces and can cut the markup at any element, sending
the rest later in a hidden holder. For the children of an `svg` that holder is
`<svg aria-hidden="true" style="display:none">`: an inline style, which the
policy refuses. A row of the page's payload over 3200 bytes is what makes React
cut, and where it cuts depends on timing.

Measured on the built server: a first version of these charts drew `rect`
elements inside an `svg`. The browser logged two `style-src-attr` violations on
some loads and none on others, and with the stand-in API answering in 300 ms
the holder was in 3 of 6 answers to `curl`. With marks that have no child the
holder is always `<div hidden>`: 0 in 16 answers, and no violation.

So a chart component rendered on the server never puts an element inside an
`svg`, and uses no icon (an icon is an `svg` with children).
`src/test/server-svg-has-no-child` fails with the file when one does, and the
`overview` end-to-end scenario asks for the page twelve times with a slow API
and counts style attributes.

## Colours

The series colours are `--chart-1` to `--chart-5` in
`internal/src/styles/theme.css`, in a fixed order that is never cycled. An
operator's `/theme.css` can redefine them. A chart with more than five series
folds the rest into one row; it never invents a sixth colour.

| Token | Outcome | Light | Dark |
|---|---|---|---|
| `--chart-1` | delivered, and every single-series bar | `#2a78d6` | `#3987e5` |
| `--chart-2` | deferred | `#bb731b` | `#c98500` |
| `--chart-3` | failed | `#a51d2b` | `#d5414b` |
| `--chart-4` | suppressed | `#732a9d` | `#995ba6` |
| `--chart-5` | canceled | `#0e8f7a` | `#34a08e` |
| `--chart-missing` | the band of a column that may not have been returned | `#85858d` | `#6e6e76` |

Contrast of each colour against what it is drawn on, measured in Chromium on
the built panel (WCAG 1.4.11 asks 3:1 of a graphic). A column stands on the
card or on the deeper tone of a level of the axis (`--surface-sunken`, which is
also the striped row of a table):

| Colour | Light: card | level, striped row | Dark: card | level, striped row |
|---|---|---|---|---|
| `--chart-1` | 4.42 | 4.06 | 4.97 | 5.22 |
| `--chart-2` | 3.76 | 3.46 | 5.88 | 6.19 |
| `--chart-3` | 7.47 | 6.87 | 4.03 | 4.24 |
| `--chart-4` | 8.24 | 7.58 | 3.79 | 3.98 |
| `--chart-5` | 4.02 | 3.69 | 5.65 | 5.94 |
| `--chart-missing` | 3.66 | 3.36 | 3.58 | 3.76 |

The band of a column that may not have been returned is `--chart-missing`, a
grey of its own. It was `--muted` before, the surface of a skeleton, at 1.21
and 1.12 against the card and the level in light and 1.20 and 1.26 in dark: a
band the note of the card pointed to ("the shaded columns") and few could see.
The band is a mark, so it is drawn where the column has none: it fills a column
with nothing and sits over the parts of one that holds some, never behind them,
where a part would be seen against the grey and not against the card. The key
of the legend is the same grey.

The quiet grey of a row that gathers the rest is `--muted-foreground`, 7.14 and
7.23 on the card. Against the tint of a table row under the pointer
(`--accent`) `--chart-3` falls to 2.73 in the dark theme, which is why a swatch
sits on its own tile.

### Every pair of colours, not only the neighbours

A series of nothing is left out of a bar and of a column, so any two of the
five can end up side by side: delivered beside canceled when nothing was
deferred, failed or suppressed. The palette is checked over all ten pairs, by
distance in OKLab times 100, with full colour vision and with protanopia and
deuteranopia simulated. The floors are 15 and 8.

| Theme | Smallest distance, colour vision deficiency | Smallest distance, full colour vision |
|---|---|---|
| Light | 10.8, canceled and deferred | 17.5, canceled and delivered |
| Dark | 9.4, canceled and failed | 16.7, suppressed and failed |

The first palette was chosen for neighbours only, on the belief that only
neighbours touch, and failed this: suppressed and delivered were 1.9 apart in
dark with a colour vision deficiency simulated. In dark no fourth colour alone repairs
it, since failed and canceled (`#d5414b` and `#199e70`) were 5.5 apart whatever
the fourth was; the fifth moved from a green to a teal and the fourth to a
purple. An override of the palette should be checked the same way, over all
pairs.

Tritanopia is not in the floor: the smallest distance with it simulated is 3.5
in light and 3.4 in dark. Every pair is also told apart without colour, as the
next paragraph says.

A colour never carries a series alone: the legend table names each outcome
beside its swatch with its count and its share, the columns stack in the same
order everywhere, the `title` of a column says its total and how many records
of each outcome it holds ("5 records (1 Delivered, 1 Deferred, 1 Failed, 1
Suppressed, and 1 Canceled)"), and every number is in a table. A swatch sits
on a small tile of the card's surface, so a striped or hovered table row does
not change what it is seen against.

## Accessibility

Each chart is a `figure` with a visible title. The drawing is one image
(`role="img"`) named by the title and described by a sentence with the numbers
(`aria-describedby`); nothing inside it is a link. The same data is a `Table`:

- the outcomes card shows it, because the table is the legend and its rows are
  the links to the filtered delivery log;
- the other three keep it behind "View data" (`Collapsible`), because the bars
  already print every value, or, for the columns over time, because a table of
  25 or 31 rows would bury the card. The Collapsible is the one piece of script
  the charts add.

A mark keeps its colour when the system forces colours (a high contrast
theme repaints backgrounds, and a mark is a background): `Mark`, the swatch and
the band carry `forced-color-adjust-none`. Checked with Chromium's emulation,
not on Windows.

Nothing is only in a tooltip. A column's `title` repeats what the table says:
it is the browser's own tooltip, which a pointer gets and a keyboard or a touch
screen does not, so the table behind "View data" is where the detail of a
column is for everyone.
The table of the columns over time has seven columns and scrolls sideways on a
phone; it has no link to focus, so its container takes the focus
(`scrollLabel` of `Table`) and the arrow keys scroll it.

The current period is a pill of the secondary surface (`bg-secondary`) in
bold, and carries `aria-current`. No line marks it: the panel draws none, and
an earlier version with a 2 px line under the current period was the one line
of the page. It is not the primary fill either: the focus ring against that
measured 2.27:1 in the dark theme. The ring is drawn 2 px off the pill, on the
page's surface.

When the API does not answer, the page says so once, at the top, with a link
that loads it again (`OverviewNotice`): a plain `<a>` to the address the reader
is on, so the server reads again. A card that could not be drawn says "Not
loaded" in a quiet line and is not an alert, and the counters keep their four
cards with a dash in each; an earlier version raised the same
warning five times, one per part, with no way out. The notice shares the reads
of the cards (`React.cache`), is there at the first one that fails and draws
nothing when all answer. Its link is the text colour of the warning in every
state, 8.44:1 on the fill in light and 12.05:1 in dark, with a focus ring at
4.50:1 and 6.01:1; pressed, it shows a thicker line under it instead of the
dimmed colour of the panel's other links, which measured 4.05:1 there.

### The skeleton of a card

A skeleton that is not as high as its card moves the page when the card
arrives. An earlier one was a stack of bars of fixed heights: on a phone held
with a finger the four cards came in 176, 24, 22 and 106 px higher than their
skeletons and the heading of the second section dropped 228 px.

So a skeleton is written with everything of its card that needs no data:

- the title, as text, so the title row wraps where the card's will in every
  language and at every width;
- the link at the end of the title row and the "View data" button, as blocks
  with the measures of the button they stand for (`buttonVariants`, so the
  44 px of a coarse pointer come with it) around the button's own words, which
  are transparent, not read and not selectable: the block is as wide as the
  button will be and is not a control;
- the legend of the timeline, whose entries are the five outcomes;
- rows of the height of the rows they stand for: 32 px a row of bars, and the
  rows of the outcomes table, 44 px under a finger.

What depends on the data is held at its usual size: one line under a title
that has one (the timeline's by its own words with a time of four zeros, since
in some languages it takes two lines on a phone), four rows for the queue and
six for the suppression list (five domains and the rest).

A card with nothing to draw is as high as its skeleton too. The message of an
empty queue, of a log that is off or of a card that was not loaded is centred
over what holds the place of the chart, laid out unseen and unread
(`CardEmpty` and `CardUnavailable` take it as `place`). An empty queue is the
usual state of a healthy server: without this its card came in 180 px lower
than its skeleton, and a page with nothing to chart moved by 600 px.

Measured on the built panel, skeleton against card, at 360, 768 and 1280 px,
with a fine and with a coarse pointer: 0 px for the four cards in the six
languages on a sample with data in every chart, and with nothing in any. What
still moves, because only the data says so:

| When | Card | Moves by |
|---|---|---|
| the answer of the log is at the API's limit | outcomes, timeline | 76 to 112 px: the caveat, and for the timeline one more entry in the legend |
| the queue or the list is longer than what is read | queue, suppression | 44 to 76 px: the caveat |
| the queue has a message whose id carries no time | queue | 42 px: a fifth row |
| the list has fewer than six domains | suppression | 42 px less per domain |
| the timeline or the queue was not loaded, or the log is off | timeline, queue | 18 px less with a fine pointer: no line under the title |

The counters above the charts are not part of this: on a phone a version too
long for its card wraps and moves what is under it by 28 px, which the
stand-in's `0.0.0-stand-in` does and `0.12.9` does not.

### Decisions kept, with what they cost

Recorded on 2026-11-13, after an audit of the page.

- **The current period is told by its weight, and the pill is quiet.** The
  fill of the pill is 1.06:1 against the page in light and 1.43:1 in dark:
  it is a tone, not an edge. The bold weight and `aria-current` say which
  period is the current one. The focus ring is 4.06:1 against the fill and
  4.28:1 against the page in light, 5.49:1 and 7.87:1 in dark.
- **The "View data" button is told by its words, not by its edge.** It is the
  `outline` variant, a tonal fill with no border, at 1.19:1 against the card in
  light and 1.32:1 in dark. WCAG 1.4.11 asks 3:1 of what is needed to identify
  a control, and here that is the text, at full contrast. A border would be the
  line the panel does not draw.
- **Shares add up to 100 %, so two equal counts can read 7.1 % and 7.2 %.** The
  alternative is shares that add up to 99.9 % or 100.1 %.
- **The ranking of a capped suppression list is of its first 500 addresses.**
  The API gives the list in alphabetical order and has no count by domain, so
  the true ranking would need the whole list on every page view. The note of
  the card says what the ranking is of.
- **The detail of a column under the pointer is the native `title`.** A tooltip
  of the panel's own would be script the charts do not otherwise need; the
  table gives the same numbers to everyone.

## Adding a chart

1. Count in a pure function under `features/<feature>/queries`, with a test
   that pins the numbers. Take `now` as an argument.
2. Load on the server in an async component: catch the failure, log it with
   `logApiFailure` under a fixed name and render `CardUnavailable`. A throw
   inside `Suspense` would take the page down. Wrap the loader in
   `React.cache` and add it to the reads of `OverviewNotice`, which gives the
   page's one warning.
3. Compose `ChartCard`, a `ChartImage` with a description that says the
   numbers, the drawing, and the table. Handle four states: not loaded, off
   (when the API can say so), empty (`CardEmpty`) and data. When the list can
   be cut, say what was read in every sentence, the description included.
4. Give it a skeleton of its shape (`chart-card-skeleton`), put the card in its
   own `Suspense` in the page and the skeleton in `loading.tsx`: the two must
   draw the same frame (`streaming.test.tsx` compares them). Write the
   skeleton with what is known before the data (see "The skeleton of a card"
   above) and add its words to `skeletonWords`. Key the `Suspense`
   by the period, as every boundary of the page is, also when the chart does
   not depend on it. A change of period renders the page again on the server,
   and React keeps the old page until every boundary it already showed has its
   new content: with the API at 1.5 s an answer and only the delivery cards
   keyed, a click on a period changed nothing on screen for 1.5 s.
5. Add the strings to `overview.json` in the six languages. The namespace is
   not sent to the browser, so read it with `getTranslations`, not
   `useTranslations`; numbers and dates go through `getFormatter`, dates with
   `timeZone: "UTC"`.
6. Build, then run the `overview` scenario and look at the page at 360, 768 and
   1280 px in both colour schemes with the console open.

To see the charts with data, switch the stand-in API to a sample (see
`e2e.md`): `POST /__control/sample` with `{"name":"busy"}`.
