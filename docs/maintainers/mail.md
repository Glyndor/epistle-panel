# Webmail (`/app/mail`)

The end-user mail client of the panel: folder tree, message list and reader, all
read through epistle's JMAP. This page says what exists, what was measured of
the JMAP server, how a hostile message is handled and what is still missing.

## What exists

| Piece | Where |
|---|---|
| A page per folder, two panes (the list and the reader), one column below 1024 px | `app/app/mail/(places)/[role]`, `app/app/mail/(places)/folder/[name]`, each with `[id]` for an open message; they all render `features/mail/components/mail-place`. Frame in `app/app/mail/layout.tsx`, which renders the panel's shell (`layouts.md`) |
| The sidebar: the way into the composer, the folders under a heading that opens and closes them | `features/mail/components/mail-nav`, `folders-boundary`, `folder-pane`, `folder-tree`, `features/mail/folder-fold`; the current folder is read from the address (`links/active-folder`) |
| The day picker in the sidebar, under the folders | `features/mail/components/day-picker-nav` (the client leaf), `components/ui/calendar`, `features/mail/day-picker/*`, `features/mail/links/day-href` |
| The storage at the foot of the sidebar | `features/mail/components/quota-meter`, drawn with `components/ui/meter` |
| The trail of the header | `app/app/mail/@trail/**`, `features/mail/components/place-trail` and `mail-breadcrumbs` |
| List, search, filters, pager, reader | `features/mail/components/*` |
| Server Actions behind each pane | `features/mail/actions/*` (`getMailboxesAction`, `getMessageListAction`, `getMessageAction`) |
| JMAP client, one credential provider | `features/mail/jmap/call`, `features/mail/jmap/credentials` |
| Sanitiser and body page | `features/mail/sanitize/*`, `features/mail/responses/body-response` |
| Attachment download | `features/mail/responses/attachment-response` |
| Stand-in JMAP for the e2e run | `scripts/e2e/stand-in-api/jmap/` |

An admin session sees a link to the administration in the header, built on the
server with the installation's id (`app/app/mail/layout.tsx`); no other session
is given the id.

**The trail** leads from the mail to the folder and, with a message open, to
its subject. The folder is named like its page's title (the role in the
reader's language, or the last part of the folder's name) and linked on the
path the folder links use, with what narrows its list. The subject streams in
behind a bar that holds its place: it is the message the reader shows, read
once for both (`requestMessage`), and it is cleaned text inside a `bdi`. A
message that cannot be read names nothing, and the folder stays a link. A
folder inside another (`Work/Q4`) is preceded by the folders above it, each
cleaned and inside a `bdi`, as words and not links: a folder's address says
nothing of whether the one above it can be opened. Below 768 px only the
folder and the subject are drawn. The composer's trail says what it was opened
for.

The sidebar is named "Mail navigation" and the list inside it "Folders": two
landmarks, two names.

**The folders fold.** A folder that has folders under it is drawn with a
control of its own: a button with a chevron, and the folder's link beside it.
The link still opens the folder and the button only folds the branch under it,
so the two are two stops of the keyboard, and Enter or Space works the button.
The button is the panel's own collapsible, the one the headings of the
navigation use, so it brings no style with it, and it says whether the branch
is open (`aria-expanded`) and which folder it folds ("Fold Work", "Unfold
Work", in the reader's language).

- **The branch that holds the current folder stays open.** The tree never hides
  where the person is: a folder above the one the address shows is open
  however it was folded, and its button says so (`aria-disabled`) and does
  nothing. The fold comes back when the person leaves that branch.
- **A folded folder says what waits under it.** The count beside a folder is
  its own while the branch is open and the whole branch's while it is folded:
  "Work" with two unread in "Q4" under it says three while it is folded, and
  one while it is open.
- **The column of the button is kept for every folder**, so the names of a
  level line up whether the folder has folders under it or not. The tree is a
  flat list indented by depth, so a folder under a folded one is left out of
  the list instead of being held by a collapsible's content.
- **Collapsed to icons** the rail has no room for a tree: there is no button
  and every folder is its icon, as before.
- **Which branches are folded is kept in memory**, by the tree, in the browser,
  and does not outlive the visit: the page the server sends has every branch
  open and the browser folds from there, so the first paint is the one the
  server drew. The groups' cookie (`components/ui/sidebar/groups-cookie`) was
  not reused for it: it holds a closed list of the names of the groups of the
  navigation and is read on the server, while the folders are the account's
  own and are only known once the mail server has answered.

**The day picker** is a month of days in a group of its own, "Calendar", between the folders and the labels (the `calendar` name of the groups' cookie, closed or open as the others). Pressing a day opens the folder the person is in with `after` and `before` both set to it; pressing it again takes it off; the chosen day is the one the address names and no other (a range marks nothing). Nothing is drawn in the rail collapsed to icons. The first paint is the server's: today (in the person's zone, `dayInZone`), the zone and the day the language starts the week on (`firstDayOfWeek`, from `Intl.Locale`: Sunday for `en` and `pt`, Monday for `es`, `fr`, `de`, `it`) are props of `MailNav`, and the browser takes today from its own clock only after hydration (`useToday`, read again when the window returns). **Limit:** the day is the calendar day in the person's zone, but the conditions count days in Greenwich (`queries/match-conditions`), so a message that arrived near midnight in a far zone lists under the neighbouring day. The first slice does not mark days that have mail, and a day outside 1970 to 9999 cannot be pressed.

The tree itself is `features/mail/components/folder-tree` (the tree and the row
of a folder) and the model of the branches is `features/mail/folder-fold`.

**The storage** is `Quota/get`, read once per request: what the account uses
of its limit as a meter with the two figures, and "almost full" or "full"
written out from nine tenths of the limit, since a tone alone would not say
it. An account with no limit is told what it uses and that there is no limit,
with no meter. When the server lists no quota in bytes (`Quota/get` with an
empty list) or cannot be asked, the box says the usage is not available.
Sizes are written in decimal units, like the attachments
(`format/storage-size`). The box is 76 px tall whatever it says, and a block
of that height holds its place while the mail server is asked, so the foot of
the sidebar does not move when the answer comes, whichever of the four it is.
Drawing nothing for an account with no quota took the block away and left the
foot 80 px shorter; knowing it before the frame is sent would mean holding
the frame until the mail server answers, and the frame leaves before the
server is asked (about 20 ms to the first byte with the server two seconds
slow, measured on the built panel). A session with no mail of its own gets
neither the box nor the block: the layout knows that from the session alone.
The stand-in answers each case (`POST /__control/quota`, see `e2e.md`).

**A folder is a page with a path of its own**, and so is an open message:

| Place | Path |
|---|---|
| a folder the account has by role | `/app/mail/inbox`, `/drafts`, `/sent`, `/archive`, `/junk`, `/trash` |
| any other folder | `/app/mail/folder/<name>` |
| a message open in either | the folder's path and `/<id>` |

`/app/mail` itself is the inbox, the same page as `/app/mail/inbox`, so signing
in lands on it with no second trip. What narrows a folder's list is not a place
and stays a parameter, read on the server: `?page=&filter=&q=`, each checked on
its own, a bad one falling back to its default.

- **A folder's name in a path** is written with an escape of its own
  (`lib/folder-segment`): a letter, a digit and a hyphen as they are, a dot too
  except first, any other byte as `_` and two upper-case digits. `Work/Q4` is
  `Work_2FQ4`. Percent-encoding would carry a slash, but what `%2F` inside one
  segment means is decided again by the framework, a proxy in front and the
  browser. Only the one spelling is read, so a folder has one path.
- **A role's path opens the first folder with that role.** A second folder with
  the same role is linked by its name. A folder named by its id does not wait
  for the folder tree; one named by its role does. An account with no folder of
  the role is told so in the list pane; when the folders could not be read at
  all the pane says the server is unreachable and offers to try again, since
  that is not the same thing.
- **What is no route is decided in the proxy** (`lib/mail-paths`, `isMailPath`),
  not in the page: under a `loading.tsx` a page's `notFound()` answers 200 (see
  `e2e.md`). So another case, an encoded slash, a role that is none, an id that
  is not one and a name the panel does not write all get the panel's one 404,
  and the mail server is asked nothing. The pages check again and call
  `notFound()` for whatever would reach them some other way.
- **An address from before** (`?box=` or `?msg=`) is redirected to the page it
  meant, by the proxy too (`legacyMailTarget`) and for the same reason: a
  `redirect()` from a page under a `loading.tsx` answers 200 with a refresh, not
  307. The new address is built from values that passed their own check and
  always starts with `/app/mail/`, so the old query cannot choose where it goes;
  without a session the old address goes to the sign-in page like any other.
- **A message's id is read by one rule** in the proxy and in the page
  (`isMessageId`, held to the message schema by a test), so the proxy never lets
  through an id the page would then refuse with a 200.
  `label`, `starred`, `important` and `search` are no routes yet (a label's
  link is the current folder with `?label=`, see `mail-labels-display.md`): they span
  folders, which `Email/query` cannot do (Glyndor/epistle#1790).
- **Each place has its title**: the role in the reader's language, or the last
  part of the folder's name, and the panel's name.
Keyboard: `j` and `k` (next and previous message), `/` (search), `u` (back to the
list on a narrow screen). They are ignored while a field or dialog has focus and
with any modifier. Interface text is the `mail` namespace in the six languages.

## The session and the credential (`MailSession`)

`features/mail/jmap/credentials` is the only place that decides who the webmail
acts for and which bearer it presents. Everything else gets a `MailSession`
(`accountId`, `bearer`) and never reads a cookie or a secret.

Today the provider is **interim**: the panel session's name is the account and
`EPISTLE_API_TOKEN` is the bearer. That token is the operator's, so the provider
gives it only to a session with the admin role: a session of any other role has no mail
until a per-user credential exists. Replace the provider with
`setMailCredentialProvider` once the end-user sign-in exists. What is missing:

- the end-user sign-in: `/` is one sign-in for every role and the session carries the role, but the account still signs in against the panel's own check; what is missing is the per-user JMAP credential;
- a token bound to the user's account. epistle's `/oauth` issues ES256 tokens
  through a PKCE flow (`POST /oauth/authorize`, `POST /oauth/token`, `S256`
  only), **but epistle's `docs/api.md` says the REST API does not accept them as a bearer,
  and epistle's `src/api/state/bearer.rs` only accepts the configured token and API keys**.
  JMAP therefore has no OAuth path today. Until it has, the per-user credential
  has to be an API key bound with `--account` (it reaches only JMAP, `/api/v1/send`
  and the delivery log, as that account), created and stored by whoever signs the
  user in. This needs a decision with the epistle side.

The bearer never reaches the browser: JMAP is called only from Server Actions and
Route Handlers, after the session is checked.

## Keywords: labels, important, forwarded

What is drawn of labels, and what is not yet, is in [`mail-labels-display.md`](mail-labels-display.md).

A message's state beyond read and starred is a keyword on it, and the views carry
it (`features/mail/labels`). The list draws all of it (see "The message list" below):

- **A label is a keyword.** epistle keeps any keyword that is an IMAP atom (ASCII, no
  space, none of `( ) { % * " ] \`, at most 64 bytes, at most 32 on a message) and
  matches it without regard to case. `keyword-codec` writes a name into that
  alphabet and back: a letter, a digit, a dot and a hyphen stand for themselves, any
  other byte of the name's UTF-8 form is `_` and two hexadecimal digits (`To do` is
  `To_20do`). A keyword it did not write is shown as the keyword itself: one an
  IMAP client set, one that would read as a control, an invisible character or a
  text-direction control, one that reads as a name written another way. A name
  that is already such a keyword (`Work_items`) is that keyword, so what a client
  set and what is typed in the panel are one label, and two keywords never show
  as one name. A name may not hold what cannot be seen; a joiner and the emoji
  selector are taken only between two characters.
- **A keyword of the protocol is not a label**: one that starts with `$` or `\`, and
  `Junk`, `NonJunk` and `NotJunk`, which some clients write without the `$`.
- **Case.** Only the four JMAP names come back in lower case. Every other keyword
  comes back as it was set, so `$Important` from an IMAP client and `$important`
  are read as one (`hasKeyword`), and taking the mark off removes every spelling.
- **Important is the user's mark** (`$important`, the operations `important` and
  `unimportant`). What a sender declares in `Importance` or `X-Priority` is not it.
- **Answered and forwarded are written when the reply or the forward is sent**,
  and not before: the composer carries the id of the message it was opened from
  and which of the two marks it leaves (`origin`), and `markOrigin` adds the
  keyword to that message after the server has queued the new one. A draft, a
  refused send and a failure to write the mark change nothing. A reply saved as
  a draft and sent later from the drafts folder leaves no mark: the draft does
  not record what it answers, and finding it by `In-Reply-To` needs a query the
  server does not have yet (Glyndor/epistle#1790).
- **A label's colour** is one of eight tones, chosen from the keyword
  (`label-tone`), until the server can keep the user's choice.
- **The list is dated**: its answer carries the UTC day it was read, and
  `format/date-group` puts a row under today, yesterday, the last six days or its
  month from that day, so the server and the browser agree.

The stand-in mailbox holds one message in each state and the combinations worth
seeing (`stateMessages` in `scripts/e2e/stand-in-api/jmap/messages.ts`), dated from
the day it starts so there is always one of today and one of yesterday.

## The message list

How a row is drawn, the date groups, the density, the filters, the queue of
changes to a message and what the list remembers for the page (its scroll and
the focus) are in [`mail-list.md`](mail-list.md).

## What was measured of epistle's JMAP (source, `src/api/jmap/`)

- `POST /jmap/api` with `using` ignored; limits 16 calls, 500 objects per `/get`,
  10 MB per request, 4 requests in flight per credential.
- `GET /jmap/session` publishes those limits (`maxSizeUpload`, `maxSizeRequest`,
  `maxObjectsInGet`, `maxObjectsInSet` in the core capability,
  `maxSizeAttachmentsPerEmail` in the mail one). The panel reads the ones the
  composer needs; the recipient count is not among them.
- Mailbox ids are the mailbox **names** (`INBOX`, `Sent`, `Work/Q4`); roles are
  guessed from the name. `Mailbox/get` carries `totalEmails` and `unreadEmails`.
- `Email/query` takes **only** `filter.inMailbox` and a newest-first default
  sort; no text filter, no keyword filter, no `position` or `limit`: it returns
  every id. The panel pages by slicing the ids and fetching that slice. A filter
  (unread, starred, attachments) or a search fetches the newest 1000 messages and
  filters in the panel, and the list says when the folder holds more
  (`partial`). Search reads subject, sender, recipients and preview.
- `Email/get` ignores `properties`; body text needs `fetchTextBodyValues` /
  `fetchHTMLBodyValues` and `maxBodyValueBytes` (the panel asks 1 MiB). The raw
  headers are on `bodyStructure.headers` of the root part (ask for `headers` in
  `bodyProperties`). Threads are one message each.
- `Email/set` `update` replaces `keywords` whole (no patch paths) and a
  `mailboxIds` update takes the first key set to true as the target. `create`
  builds a draft from `textBody`/`htmlBody`/`attachments` or `bodyStructure`.
  `EmailSubmission/set` needs the `send` scope. (Not used yet.)
- `GET /jmap/download/{account}/{blob}/{name}` sends the part with its own type
  and **no** `Content-Disposition`, so the panel never relays it as it comes.
  Blob ids of parts are `<message>.<part>`.
- Errors: a method failure is a `["error", {type}]` response inside a 200.

## Hostile messages

A message is hostile input. What the panel does:

- **HTML is never inserted into a page.** It is parsed with parse5 (the HTML
  standard's parser), re-written from the tree by `sanitize-html` with an element
  and attribute allow-list, and shown in an iframe whose source is
  `/app/mail/body/<id>`. The sanitiser writes the output itself, escapes every
  text and attribute, and never writes `svg`, `math`, `template`, `noscript` or a
  raw-text element, so what a browser parses back is the checked tree (the
  mutation-XSS class). No `style`, event handler, form, frame, object, script,
  `meta` or `base`. Links keep `http`, `https`, `mailto` and `tel`, open in a new
  window with `noopener noreferrer`, and a URL with a user name is dropped.
- **Remote images follow the effective mode** and are counted. The mode is
  the operator's `EPISTLE_PANEL_REMOTE_IMAGES` when it is set, otherwise the
  person's `__Host-remote-images` cookie, otherwise `ask`. In `ask`, the reader offers
  "load images" for that message and that visit (`?images=1`); only then does
  the response's policy allow `http:` and `https:` images. In `always`, the
  reader and the body route use that same `?images=1` path without asking. In
  `never`, remote
  images stay blocked, the reader offers no button and the body route ignores
  `?images=1`. `data:` raster images are kept, SVG never.
- **The frame** has `sandbox="allow-popups allow-popups-to-escape-sandbox"`: no
  scripts and no same-origin access. The body route answers with its own policy
  (`default-src 'none'; img-src data:; style-src 'none'; script-src 'none';
  base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox ...`),
  `X-Frame-Options: SAMEORIGIN`, `nosniff`, `no-referrer`, `no-store`. It is the
  only response the panel lets be framed: `proxy.ts` and the static headers of
  `next.config.ts` skip exactly `/app/mail/body/<id>` (see `isMailBodyPath`), and
  any other spelling of the path keeps the panel's `frame-ancestors 'none'`.
  The remote image mode does not add a second policy path: it reaches the
  existing `bodyResponse` boolean, so the sanitizer and the CSP change together
  only when the effective mode allows remote images.
- **Text** (subject, names, addresses, headers, text body) is rendered as text,
  cleaned of controls, line and paragraph separators and bidi overrides/isolates
  (`safe-text`), and wrapped in `<bdi>`.
- **Attachments** go through `/app/mail/attachment/<id>/<part>`: the part must be
  listed as an attachment by the message, the name is reduced to one clean path
  segment (`safe-filename`), the type is forced to a short allow-list or
  `application/octet-stream` (HTML, SVG, XML and script types never keep theirs),
  and the file is always `Content-Disposition: attachment`, at most 25 MiB.
  The file is passed on as it arrives from the mail server and is never held in
  memory: one chunk is read when the browser asks for one. The headers have 60 s
  to come; after that the download has no total time (the reader may be on a slow
  line) but may not stand still for 30 s. A file that declares more than 25 MiB is
  refused before a byte is sent; one that carries more without saying so breaks
  the download off at that byte, with the stream failed and not ended, so the
  browser reports a failed download and never saves a short file as whole. The
  answer declares the size the mail server declared.
- Limits: 1 MiB of body read, 1 MiB of HTML parsed, 64 levels and 20 000 elements
  kept, 120 headers listed.

Tests: `sanitize-html/index.test.ts` holds real payloads (script, svg onload,
`url()` in CSS, meta refresh, base href, mXSS through svg/math/noscript/form/
template, `javascript:` spelled with tabs, entities and case, event handlers,
forms, iframes, trackers, bidi, null bytes, 100 000 nested elements) and checks the
parsed-back output against the allow-list (`test-support/assert-safe`). Breaking
the namespace check, the link policy, the image policy, the `rel` or the attribute
check each fails between 1 and 13 of those tests (measured). The e2e scenario
`mail` reads the same on the built server.

## Actions on messages

The reader has a toolbar: star, read or unread, archive, spam, move (a menu of the
folders) and delete, with the keys `s`, `e`, `!` and `#` or Delete. Opening an
unread message marks it read, quietly and once. They all go through
`changeMessageAction` (strict input: a message id and one operation, or a move to a
named folder), which asks JMAP for the message, writes the **whole** keyword set
(epistle's `Email/set` replaces it) and, for a move, names the one target folder
(`archive`, `spam` and `trash` find theirs by role; an account without one gets a
"no such folder" answer, not an error). epistle moves a message by appending a copy
and removing the original, so a moved message gets a **new id**: the reader goes
back to the list and the list and counters reload. A flag change shows at once on
the message, its row and the folder counter, and is put back if the server refuses.
Deleting from the trash destroys the message and asks first with `ConfirmAction`, whether
the button or the Delete and # keys ask (the keys are ignored while the dialog is open). Moving a message to Junk does not set `$junk`: epistle trains
on the move itself (`src/api/jmap/email/mod.rs`).

## The composer

`/app/mail/compose` (`?mode=reply|replyAll|forward|draft&msg=<id>`): to, cc, bcc,
subject, a text body, attachments, save draft, send, discard, and reply, reply all,
forward and edit draft from the reader. A message is plain text; there is no rich
editor and no signature.

- **Route handlers, not Server Actions.** A message body is larger than the 16 KB a
  Server Action may carry (`next.config.ts`), so saving and sending go through
  `POST /app/mail/compose-message` (JSON) and attachments through `POST
  /app/mail/upload` (the file as the body). Because they are plain POST endpoints
  they check what an action gets from Next: the request must come from the panel's
  own origin (`Origin` equal to the forwarded host, as for Server Actions; none or
  `null` is refused), then the session, then the input. The compose body is parsed
  with a strict schema (`compose-input`); the answer is a closed category and never
  the server's words.
- **Only a draft is replaced.** A save or send that names a `draftId` first reads that
  message and requires `$draft` and the drafts folder, else it is refused as invalid
  before anything is written or destroyed; an id the account does not have (another
  account's message looks like that) is refused the same way, and the composer page
  ignores `mode=draft` on a message that is not a draft.
- **The request is bounded as it streams.** A `Content-Length` that is a plain
  decimal number of bytes is required (411), and the body is read as it arrives
  and cut at the first byte past the cap or past what
  it declared, counting bytes.
- **The limits are the mail server's own.** The composer asks the server's JMAP
  session resource (`GET /jmap/session`, read by
  `features/mail/jmap/session`) for the limits it publishes, and the browser's
  attributes, the form's schema and the route's own checks all read the same
  object (`features/mail/schemas/compose-input-limits`): the request cap is the
  session's `maxSizeRequest` and the file cap is its `maxSizeUpload`, so the
  panel refuses exactly what the server refuses and never what it accepts. A
  number the session does not publish, or publishes in a shape the panel cannot
  use (missing, zero, negative, not a number, past a gigabyte), leaves the
  panel's own: 25 MiB of file and 1.5 MB of request. A session that cannot be
  read at all leaves every number as it was.
- **The total attachment budget** is `maxSizeAttachmentsPerEmail` from the
  mail capability. Missing or unusable means no total cap. The picker counts
  existing files and each successful upload before the next file; uploads carry
  that count as `attachedBytes`, checked before their body is read. That count
  is a plain decimal number of bytes too, and one that is not is refused as
  invalid (400), like the size the request declares. Compose JSON
  carries a nonnegative integer `size` per attachment; the server schema checks
  each file and their sum again. These declared sizes are early checks; JMAP
  remains authoritative for actual blob sizes. A total refusal names the budget
  in all six languages, using the same binary-size formatter as a file refusal.
  Displayed budgets are floored (whole KiB, tenths of MiB and larger), never
  rounded above their actual bytes. HTTP 413 and JMAP `requestTooLarge` from
  composing use the existing message-too-large outcome, preserving the form.
- **Two limits are the panel's own, because the session says nothing about
  them**: how many files a message may carry (20) and how many recipients a
  message may take (100). The recipient count is **not discoverable yet**: epistle
  keeps its `max_recipients` in its configuration and does not publish it in the
  session, so the panel cannot learn the operator's number and holds its own
  until the session does. The count of files is the panel's too, for the same
  reason. The recipient limit is for the **whole message**: To, Cc and Bcc
  together carry no more than it, in the compose schema
  (`features/mail/schemas/compose-input`) and in the form's own check
  (`features/mail/components/compose-form/check-recipients`), which shows the
  same sentence a refusal from the mail server shows
  (`refusal_tooManyRecipients`) under the field whose addresses took the
  message over the limit.
- **The sender is never chosen by the browser.** It is the account's first sending
  identity (`Identity/get`); epistle refuses a `From` the account does not own.
- **Saving a draft** creates the new message in the drafts folder and then removes
  the previous draft (epistle cannot edit a stored message), so what is open is
  always the latest copy. **Sending** stores the message the same way, queues it
  with `EmailSubmission/set` (recipients from To, Cc and Bcc, Bcc removed by the
  server; epistle keeps its own copy in Sent), then removes the working copy and
  the previous draft. When the server refuses, the work stays as a draft and the
  form says why with one of: no recipient, too many, from-address not owned,
  invalid address, mailbox full, rate limited, refused to send, too large, other.
- **Attachments** are uploaded as soon as they are chosen, up to 20 files of as many
  bytes as the server accepts (`maxSizeUpload`, 25 MiB by default), and sent by blob
  id. The name is reduced on the server by the same `safeFilename` as a download (it ends up in MIME headers). The type is the declared one when it is a plain
  `type/subtype` (parameters dropped), else `application/octet-stream`; the name is
  cleaned like a download's.
- **The type that goes out with the message is checked again**, because it comes
  from the browser: it must be a plain media type, and it must not be one a
  browser or a mail client runs or renders as a page (`text/html`,
  `application/xhtml+xml`, `image/svg+xml`, `application/javascript` and the
  other markup and scripting types, `+xml` included). Those leave as
  `application/octet-stream`, so the file is saved and never rendered
  (`features/mail/sanitize/attachment-type`, used by
  `features/mail/queries/compose-message`). The ordinary types keep the one
  they have: a PDF, an image, an office document, an archive, plain text, a CSV,
  a message.
- **The upload route is outside the proxy, and is its own only gate.** Next's proxy
  holds in memory the body of every request it covers, before it decides anything
  (read in `next/dist/server/body-streams.js`, and measured on the built server: a
  request with no session got no answer until its whole body had arrived, and eight
  of them held at 26 MB took the server from 97 MB to 306 MB). So
  `proxyClientMaxBodySize` is 2 MB, and the two routes that take a big body,
  `/app/mail/upload` and `/app/mail/compose-message`, are skipped by the proxy's
  matcher as those exact paths. Each route does every check itself before it
  reads a byte: same origin, the session and its role, and the size from
  `Content-Length`, which is required and must be a plain decimal number of
  bytes: `Number()` would also read `1e3`, `0x64` and ` 100 `, which are not
  lengths, so a header that is not one is answered 411, as a missing one is.
  It then hands the body to the mail server as it arrives, counted against that
  size, and never buffers it; a body that is not
  the size it declared breaks the call off and is answered `invalid`. Its answers
  carry their own policy (`default-src 'none'`), since the proxy's headers are not
  laid over them. The mail server takes four uploads at a time for one caller and
  answers 429 past that, which the route passes on as `busy`. The e2e scenario
  declares a body and sends none of it (the route refuses at once, with and without
  a session), uploads a 12 MB file whole and refuses 27 MB.
- **Reply and forward** prefill on the server from cleaned text: the quoted original
  is the text part, or the sanitised HTML reduced to text, cut at 20 000 characters,
  put in a text area and never inserted as markup. A reply goes to the reply-to
  address (else the sender), reply all adds the other recipients minus the account,
  and `In-Reply-To` and `References` carry the original's id. A forward carries the
  original as text under its header lines. **Attachments are not forwarded.**

## Not done yet

- No autosave of the draft, no warning on leaving with unsaved text, no signature, no
  rich text, no address book or completion, no forwarding of attachments.
- Inline `cid:` images (shown as attachments for now), conversation threads
  (epistle has none), push updates (the list polls every 30 s while visible, at the person's pace: 60 s slow, 15 s fast).
- The real JMAP was not run; the stand-in follows the source. Measure against a
  running epistle before relying on any row above.

## How the page is sent

`/app/mail` sends its frame at once and each part streams its own data inside
`Suspense`: in the layout, `FoldersBoundary` (the tree of the sidebar, which is
a sheet below 768 px) and `QuotaMeter` (the storage, behind a block of its own
height); in the page, `ListBoundary` (the search, the filters and the
page of the open folder) and `ReaderBoundary` (the open message); in the
header, the trail of an open message. Each boundary reads on the server and hands the result to its client
component, which owns the data from then on; the fallback of each is the same
skeleton its client component shows while it fetches.

`queries/request-mail` holds what the panes share within one request: the mail
session and the folders, each read once (`cache` from React), and `resolveBox`.
A view whose address names a folder never waits for the folder tree; one that
names none waits for it, to open the inbox by its role. The mail session stays
in server components: it is never a prop of a client component.

The list costs two JMAP calls in a row (the ids, then the messages), because
`Email/query` has no paging on the server yet.
