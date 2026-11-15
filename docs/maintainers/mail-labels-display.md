# What the webmail shows of labels

A label is a keyword on a message. How a name becomes a keyword and back, and the
eight tones, are in `mail.md` ("Keywords") and `mail-list.md` ("The label tones");
the code is `features/mail/labels`. This page says what the panel **shows** of
labels and what it does not do yet.

## What is shown

| Where | What | Code |
|---|---|---|
| A message's row | up to three chips after the subject, then `+N`; where the row is too narrow for a readable name the labels are only a count; the names behind a count are in a tooltip | `components/label-chips`, `label-chip` |
| The reader | every label as a chip in a named list under the subject | `components/reader-header` |
| The sidebar | a group "Recent labels" (`labels` in `SIDEBAR_GROUPS`) under the folders: one link per label with the dot of its tone | `components/labels-nav`, `labels/sidebar-selection`, `links/label-href` |

A chip is the label's name as text, isolated with `bdi`, cut with an ellipsis and
never changed; the tone is only a dot. A keyword another IMAP client set (for
example `Work_items`) is shown as the keyword, so it can be recognised. A chip adds
no tab stop to the row, whose own state sentence says every label once. Under
forced colours the pill, whose tint is dropped, keeps a border
(`forced-colors:border`), and the dots keep their tone.

## The sidebar group

- **Where the list comes from.** From the messages the browser has already
  loaded: the pages of every list in the query cache (`useLoadedMail`), the page
  read last winning when two hold the same message, and their refreshes. Nothing
  is asked of the server for it. The heading says "Recent labels" and a sentence
  for assistive technology (`labelsNavHint`) says where they come from. It is not
  every label of the account: a label on no message loaded is not listed.
- **Which labels.** At most `SIDEBAR_LABELS_MOST` (20): the ones on the most
  messages seen, listed by name. Two spellings of one keyword are one label.
  With no label, or nothing loaded yet (the page the server sends never has the
  group), it is not drawn at all.
- **Where a link goes.** To the folder the person is in (the inbox from the
  composer) narrowed by the `label` condition: `?label=<keyword>`. The condition
  already existed (`list-conditions`, `match-conditions`).
- **The server does not filter by keyword.** `Email/query` takes only
  `inMailbox` and cannot look across folders (Glyndor/epistle#1790), so the list a
  label opens is the folder's newest `SCAN_LIMIT` messages narrowed by the panel,
  with the "partial" notice when the folder holds more. When the server can filter
  by `hasKeyword`, only `loadMessageList` changes.
- **Closing.** The heading is a button (`NavSection`, Enter and Space), the choice
  is kept in the `sidebar_groups` cookie like the folders', and the label the list
  is narrowed by is still drawn while the group is closed. Collapsed to icons a
  label is its dot with the name in a tooltip.
- **Dots.** `svg` and not `span`: the sidebar entry keeps a direct `span` out of
  the rail. Measured in the built panel (light, dark): the eight tones against the
  sidebar's resting fill and against the current entry's fill are all at least 3:1
  (lowest 3.32, tone 8 on the current entry in light). The current entry under the
  pointer was not measured.

## Not yet

Applying or removing a label, creating one, choosing its tone, renaming, counts
beside the labels, labels from the whole account and a route per label. The tone
is a function of the keyword until the server keeps a choice.
