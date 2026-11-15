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

## Applying and removing labels

| Where | What | Code |
|---|---|---|
| The reader's toolbar | "Label as", a button with its words, beside Move | `components/label-menu`, `reader-toolbar` |
| A row | a tag mark, first of the row's marks (keyboard: link, labels, important, star), shown like the others (pointer on the row, focus in it, always on a coarse pointer) | `row-actions/label-mark` |
| A chip in the reader | a button inside the pill that takes the label off the message | `components/label-remove`, `components/label-chip` (`after`) |

- **The dialog.** "Label as" is the panel's `Dialog`, not a menu: a field inside a
  Radix menu has its typing read as typeahead, and a menu closes at a choice
  while the person often chooses several labels. The focus goes to the field,
  stays inside, and returns to the control on Escape or the close button. The
  list exists only while it is open. Measured in the built server: no CSP
  violation (the style element its scroll lock adds carries the nonce; test in
  `src/test/overlays-inject-no-style`).
- **The list.** The labels seen in the loaded lists (the sidebar's, `knownLabels`)
  plus every label on the messages in hand, by name, and it only grows while the
  dialog is open: a label taken off the last message that carried it stays, to be
  put back. A tick box per label: ticked when all the messages carry it, empty
  when none, indeterminate when some (a press puts it on all; when all have it, a
  press takes it off all). The field filters by name, without regard to case.
  "Create «text»" comes last when the text is no label by exact name (`Work` and
  `work` are two) and is not blank or invisible.
- **The name.** The one rule of `name-codec`, three times: the field's `maxlength`
  (`fieldLength(LABEL_NAME_MAX)`, one over, so a cut paste is seen), the panel
  (a name too long, counted in UTF-8 bytes, says so and is not offered) and the
  action's schema. The server writes the keyword itself (`encodeLabelName`); the
  client's guess is only for the optimistic chip.
- **Keyboard.** The field is first. Down goes into the list, Down and Up move
  between the boxes and the create button, Home and End go to the ends, Up from
  the first returns to the field, Space and Enter press a box. One stop of Tab
  for the whole list. Enter in the field makes the label when it is offered, or
  presses the one label left.
- **Writing.** `labelMessagesAction` (`kind: "keyword"` with `on`, or `kind:
  "create"` with a name; at most `LABEL_BATCH` = 50 messages, never a keyword that
  starts with `$`, so it cannot set a flag). epistle replaces a message's whole
  keyword set, so the server reads the sets of all the messages in one
  `Email/get` and writes them in one `Email/set`, touching only the label (found
  without regard to case, taken off in every spelling) and not writing a message
  that is already as asked. The answer is per message. Removal is always by
  keyword, never by writing the displayed name again: two labels can show one name.
- **On screen.** Shown at once on the open message and every row of every cached
  page (`queries/label-cache`, with the rule of `patchFlags`: each label of each
  message keeps the value the server last confirmed, and a refused change leaves
  what a later one still waiting asked for). A refused message is put back and a
  toast says so; success says nothing. Changes to one message share the scope of
  its flags, so a label and a star on it wait for each other. A selection longer
  than 50 is sent in runs of 50, one after the other; a failed run puts back only
  its messages.
- **Display of the keyword.** `labelOf` shows an `ep1-` keyword as the name it
  holds, with the tone of that exact name, cleaned like any text (the page
  collapses its spaces; the keyword is the identity). Every other keyword shows
  as before.

## Not yet

Choosing a label's tone, renaming, counts beside the labels, labels from the whole
account and a route per label. The tone is a function of the keyword until the
server keeps a choice. There is no way to select several messages in the list, so
no control opens "Label as" for a selection: `LabelMenu`, the action and
`useLabelChange` already take several messages (tested, indeterminate included),
and the selection toolbar only has to mount them. A message can carry at most 32
keywords (epistle's `MAX_KEYWORDS_PER_MESSAGE`); past it the server refuses the
change and the toast says so, with no warning before. A batch is serialised with
other batches, not with a flag change to one of its messages (the window is one
round trip). On a coarse pointer the row's three marks take 136 px of the row; it
was not measured with touch emulation.
