# Webmail (`/app/mail`)

The end-user mail client of the panel: folder tree, message list and reader, all
read through epistle's JMAP. This page says what exists, what was measured of
the JMAP server, how a hostile message is handled and what is still missing.

## What exists

| Piece | Where |
|---|---|
| Page, three panes, one column below 1024 px | `app/(mail)/app/mail/page.tsx`, frame in `app/(mail)/layout.tsx` |
| Folder tree, list, search, filters, pager, reader | `features/mail/components/*` |
| Server Actions behind each pane | `features/mail/actions/*` (`getMailboxesAction`, `getMessageListAction`, `getMessageAction`) |
| JMAP client, one credential provider | `features/mail/jmap/call`, `features/mail/jmap/credentials` |
| Sanitiser and body page | `features/mail/sanitize/*`, `features/mail/responses/body-response` |
| Attachment download | `features/mail/responses/attachment-response` |
| Stand-in JMAP for the e2e run | `scripts/e2e/stand-in-api/jmap/` |

An admin session sees a link to the administration in the header, built on the
server with the installation's id (`app/app/mail/layout.tsx`); no other session
is given the id.

The view lives in the address: `/app/mail?box=&page=&filter=&q=&msg=`. Each
parameter is checked on its own and a bad one falls back to its default.
Keyboard: `j` and `k` (next and previous message), `/` (search), `u` (back to the
list on a narrow screen). They are ignored while a field or dialog has focus and
with any modifier. Interface text is the `mail` namespace in the six languages.

## The session and the credential (`MailSession`)

`features/mail/jmap/credentials` is the only place that decides who the webmail
acts for and which bearer it presents. Everything else gets a `MailSession`
(`accountId`, `bearer`) and never reads a cookie or a secret.

Today the provider is **interim**: the panel session's name is the account and
`EPISTLE_API_TOKEN` is the bearer. That token is the operator's, so this only
fits an account whose owner is the operator. Replace the provider with
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

## Not done yet

- Actions on messages (mark read, star, move, archive, delete, spam): PR 2.
- The composer (to, cc, bcc, subject, body, attachments, drafts, reply, forward,
  send): PR 3.
- Inline `cid:` images (shown as attachments for now), conversation threads
  (epistle has none), push updates (the list polls every 30 s while visible).
- Native `<select>`, `<details>` and `<kbd>` stand in for shadcn components that
  are not installed yet (`language-select`, `headers-disclosure`,
  `shortcuts-help`). They sit behind their own components so they can be replaced
  by `select`, `collapsible` and `kbd` when those land.
- The real JMAP was not run; the stand-in follows the source. Measure against a
  running epistle before relying on any row above.
