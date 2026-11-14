# Webmail (`/app/mail`)

The end-user mail client of the panel: folder tree, message list and reader, all
read through epistle's JMAP. This page says what exists, what was measured of
the JMAP server, how a hostile message is handled and what is still missing.

## What exists

| Piece | Where |
|---|---|
| A page per folder, two panes (the list and the reader), one column below 1024 px | `app/app/mail/(places)/[role]`, `app/app/mail/(places)/folder/[name]`, each with `[id]` for an open message; they all render `features/mail/components/mail-place`. Frame in `app/app/mail/layout.tsx`, which renders the panel's shell (`layouts.md`) |
| The sidebar: the way into the composer, the folders under a heading that opens and closes them | `features/mail/components/mail-nav`, `folders-boundary`, `folder-pane`, `folder-tree`; the current folder is read from the address (`links/active-folder`) |
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

**The storage** is `Quota/get`, read once per request: what the account uses
of its limit as a meter with the two figures, and "almost full" or "full"
written out from nine tenths of the limit, since a tone alone would not say
it. An account with no limit is told what it uses and that there is no limit,
with no meter. Nothing is drawn when the server lists no quota in bytes or
cannot be asked. Sizes are written in decimal units, like the attachments
(`format/storage-size`). The box is 76 px tall with a meter and without one,
and a block of that height holds its place while the mail server is asked, so
the foot of the sidebar does not move when the answer comes; a session with no
mail of its own gets neither.

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
  `label`, `starred`, `important` and `search` are no routes yet: they span
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
  only), **but `docs/api.md` says the REST API does not accept them as a bearer,
  and `src/api/state/bearer.rs` only accepts the configured token and API keys**.
  JMAP therefore has no OAuth path today. Until it has, the per-user credential
  has to be an API key bound with `--account` (it reaches only JMAP, `/api/v1/send`
  and the delivery log, as that account), created and stored by whoever signs the
  user in. This needs a decision with the epistle side.

The bearer never reaches the browser: JMAP is called only from Server Actions and
Route Handlers, after the session is checked.

## Keywords: labels, important, forwarded

A message's state beyond read and starred is a keyword on it, and the views carry
it (`features/mail/labels`), though no screen draws it yet:

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

## What was measured of epistle's JMAP (source, `src/api/jmap/`)

- `POST /jmap/api` with `using` ignored; limits 16 calls, 500 objects per `/get`,
  10 MB per request, 4 requests in flight per credential.
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
- **Remote images are blocked** and counted. The reader offers "load images" for
  that message and that visit (`?images=1`); only then does the response's policy
  allow `https:` images. `data:` raster images are kept, SVG never.
- **The frame** has `sandbox="allow-popups allow-popups-to-escape-sandbox"`: no
  scripts and no same-origin access. The body route answers with its own policy
  (`default-src 'none'; img-src data:; style-src 'none'; script-src 'none';
  base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox ...`),
  `X-Frame-Options: SAMEORIGIN`, `nosniff`, `no-referrer`, `no-store`. It is the
  only response the panel lets be framed: `proxy.ts` and the static headers of
  `next.config.ts` skip exactly `/app/mail/body/<id>` (see `isMailBodyPath`), and
  any other spelling of the path keeps the panel's `frame-ancestors 'none'`.
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
- **The request is bounded as it streams.** A valid `Content-Length` is required (411),
  and the body is read as it arrives and cut at the first byte past the cap or past what
  it declared, counting bytes.
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
- **Attachments** are uploaded as soon as they are chosen, up to 20 files of 25 MiB,
  and sent by blob id. The name is reduced on the server by the same `safeFilename` as a download (it ends up in MIME headers). The type is the declared one when it is a plain
  `type/subtype` (parameters dropped), else `application/octet-stream`; the name is
  cleaned like a download's.
- **The upload route is outside the proxy, and is its own only gate.** Next's proxy
  holds in memory the body of every request it covers, before it decides anything
  (read in `next/dist/server/body-streams.js`, and measured on the built server: a
  request with no session got no answer until its whole body had arrived, and eight
  of them held at 26 MB took the server from 97 MB to 306 MB). So
  `proxyClientMaxBodySize` is 2 MB, enough for the largest body a covered route
  reads (the composer's message, 1.5 MB), and `/app/mail/upload` is skipped by the
  proxy's matcher as that exact path. The route does every check itself before it
  reads a byte: same origin, the session and its role, and the size from
  `Content-Length`, which is required. It then hands the body to the mail server as
  it arrives, counted against that size, and never buffers it; a body that is not
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
  (epistle has none), push updates (the list polls every 30 s while visible).
- The real JMAP was not run; the stand-in follows the source. Measure against a
  running epistle before relying on any row above.

## How the page is sent

`/app/mail` sends its frame at once and each part streams its own data inside
`Suspense`: in the layout, `FoldersBoundary` (the tree of the sidebar, which is
a sheet below 768 px) and `QuotaMeter` (the storage, with nothing in its place
while it waits); in the page, `ListBoundary` (the search, the filters and the
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
