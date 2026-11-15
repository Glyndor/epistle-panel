# The person's own page (`/app/me`)

One page where a signed-in person sets what is theirs, the same for the
webmail and the administration: the same session, the same address, for a
session of any role. It is `app/app/me`, and it is not part of either area.

## What it holds

| Preference | List (the one place it is spelled) | Cookie |
|---|---|---|
| Language | `SUPPORTED_LOCALES`, `i18n/locales` | `locale`, `HttpOnly`, path `/` |
| Theme | `THEME_CHOICES`, `features/theme/config/choices`: light, dark or the system's, nothing else | `theme`, readable by script (the page that replaces a failed layout reads it), path `/` |
| Density of the message list | `LIST_DENSITIES`, `features/mail/config/list-density` | `list-density`, `HttpOnly`, path `/app` |

A person does not choose an accent: the palette and the logos are the
operator's, which is what keeps the measured contrasts true.

Every cookie lives a year, is `Secure` and `SameSite=Lax`, and is written by one
function (`lib/preference-cookie` for the attributes, one writer per
preference in `features/<f>/cookie`), so the three controls that change a
preference (this form, the theme button of the header, the density switch of the
list) cannot write it differently. They are per browser. When the per-account
document of preferences exists (Glyndor/epistle#1839) the same form writes
there and the choice follows the person to another device: only the action's
last lines, where it calls the writers, change.

The density cookie was `mail-density`, sent under `/app/mail`. A cookie sent
only to the mail area cannot be read back by `/app/me`, so it is now
`list-density` under `/app`. A browser that still holds the old one ignores it,
and a person who had chosen the compact list sees the comfortable one until they
choose again.

## Where it is decided

- **The proxy** decides the route, as it does for the others: `classifyAppPath`
  has a kind `me`, and `lib/me-paths` says whether a path is the route, spelled
  exactly (`/app/me`, one slash at the end the same). A visitor without a valid
  session is sent to the sign-in page from anything under it; a session of
  either role reaches the exact path; any other spelling or anything below
  it is the panel's one 404. Nothing about the session checks, the role gates
  or the policy changed: the page adds no CSP source and no `style-src`
  exception. It is never crawled: the same `X-Robots-Tag` and the `robots` meta
  tag of every response.
- **The layout and the page** ask for the session themselves
  (`requireSession`), as every page does. The layout is the panel's `AppShell`
  with a sidebar of its own (`features/preferences/components/me-nav`): the way
  back to the mail, the way into the administration only when the server gave
  an address (an admin session in an installation whose admin area is on), and
  the page, marked current. The mail link is always there: the mail area
  answers for a session with no mail of its own with its own notice, and this
  page does not wait for the mail server to say so.
- **The header** has no language control. The account menu has the theme (one
  click, as before), a link to the page, the way into the administration and
  sign out; the `noscript` fallback has the link to the page too.

## The form

`features/preferences`. One `<form action>` with three native selects
(`NativeSelect`), because a Radix radio group renders its input only after it
has mounted and posts nothing without script. Each field has the three checks
of `forms.md`:

1. **The browser**: the field is `required` and a `select` can hold nothing but
   its options, which are the list.
2. **The schema** (`schemas/preferences`, `zod/mini`): each field is one of its
   list exactly (`ES` is not `es`, nothing is trimmed), with `required` for
   a field that is missing or empty and `notInList` for anything else.
3. **The Server Action** (`actions/save-preferences`): checks the session, reads
   each field once (a field sent twice or as a file is not a choice), parses the
   same schema and, only if all three are valid, writes the three cookies. One
   value outside its list stores none of the others, and the answer names every
   refused field. No session (missing, forged or expired) is `failed`, with
   nothing written.

Without script the browser posts the form and the answer is the page again, with
the state of the action in it. With script the form validates first and shows the
theme at once; the language and the density are what the page renders next.

Nothing read from a cookie reaches the page unchecked: `readPreferences` takes the
language from the request's own resolution (`getLocale`, which already believes
only a shipped code) and the other two from their readers, which believe a word of
their list and nothing else, and the page prints the parsed value, never the
cookie's text. The first paint has the choice: the root layout paints
`data-theme` and `lang` on the server, the density is the attribute of the list
pane, and the form's selects start on the values the server read.

## What waits

Time zone (Glyndor/epistle-panel#215) and remote images (#208) have no section.
Their storage is not the trivial kind this page was built for: the list of time
zones is the browser's, a closed list of hundreds of names that the panel does
not hold, and nothing yet formats a date in a chosen zone, so a saved value would
change nothing; remote images change what a message may load and so the policy of
the framed body, which is the mail area's to decide and not a cookie's to
loosen. When they are built, each is a new field of the form with its list in the
place that owns it, a message key per error, and its cookie written through
`lib/preference-cookie`. Signature and shortcuts can join the same way.

## The sign-in page

It keeps no language control, because it had none: choosing a language writes a
cookie, and a write that needs no session is a cookie any visitor could set. It
speaks what the browser asked for or the operator's default
(`EPISTLE_PANEL_DEFAULT_LOCALE`), and the person changes it here once signed in.

## Tests

Each module has its own, and the proxy has `proxy-me.test.ts` and the model of
`proxy-generated-inputs.test.ts`. The e2e scenario `me` runs the page, the plain
post with no script and the refusals against the built server and the stand-in.
