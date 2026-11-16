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
| Remote images in messages | `REMOTE_IMAGE_MODES`, `features/mail/config/remote-images`: ask, always or never | `__Host-remote-images`, `HttpOnly`, path `/` |
| Time zone of the dates | `TIME_ZONES`, `features/time-zone/config/zones`: `UTC` and every IANA zone the running Node knows | `time-zone`, `HttpOnly`, path `/app` |
| Messages per page | `PAGE_SIZE_CHOICES`, `features/mail/config/page-size`: 25, 50 or 100 | `page-size`, `HttpOnly`, path `/app` |
| Pace of the refreshes | `REFRESH_PACES`, `features/refresh/config/pace`: normal, slow or fast, never off | `refresh`, `HttpOnly`, path `/app` |

A person does not choose an accent: the palette and the logos are the
operator's, which is what keeps the measured contrasts true.

Every cookie lives a year, is `Secure` and `SameSite=Lax`, and is written by one
function (`lib/preference-cookie` for the attributes, one writer per
preference in `features/<f>/cookie`), so the controls that change a
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

`features/preferences`. One `<form action>` with a native select
(`NativeSelect`) for every choice the person owns, because a Radix radio group
renders its input only after it has mounted and posts nothing without script.
Each field has the three checks of `forms.md`:

1. **The browser**: the field is `required` and a `select` can hold nothing but
   its options, which are the list.
2. **The schema** (`schemas/preferences`, `zod/mini`): each field is one of its
   list exactly (`ES` is not `es`, nothing is trimmed), with `required` for
   a field that is missing or empty and `notInList` for anything else.
3. **The Server Action** (`actions/save-preferences`): checks the session, reads
   each field once (a field sent twice or as a file is not a choice), parses the
   same schema and, only if every field is valid, writes the person's cookies.
   One value outside its list stores none of the others, and the answer names
   every refused field. No session (missing, forged or expired) is `failed`,
   with nothing written.

Without script the browser posts the form and the answer is the page again, with
the state of the action in it. With script the form validates first and shows the
theme at once; the language, the density, the remote image mode, the time
zone, the page size and the pace of the refreshes are what the page renders next.

Nothing read from a cookie reaches the page unchecked: `readPreferences` takes the
language from the request's own resolution (`getLocale`, which already believes
only a shipped code) and the other six from their readers, which believe a
word of their list and nothing else, and the page prints the parsed value, never
the cookie's text. The first paint has the choice: the root layout paints
`data-theme` and `lang` on the server, the density is the attribute of the list
pane, and the form's selects start on the values the server read.

## Remote images

The person's choice is one of three modes in `REMOTE_IMAGE_MODES`:

- `ask` is the default: remote images are blocked, and the reader offers a
  button that loads them for that message and that visit;
- `always` loads them without asking;
- `never` blocks them and offers no button.

The mode is kept in the `__Host-remote-images` cookie (`Secure`, `HttpOnly`, `Path=/`, no `Domain`, `SameSite=Lax`).
The `__Host-` prefix is deliberate: a browser refuses a cookie of that name set with a `Domain`, so a sibling domain cannot plant
`always` over the person's choice. The old `remote-images` name is not read. The cookie is not
itself a policy: the body route reads the effective mode and uses the same
`?images=1` path as the button, so the sanitiser keeps its link and URL policy
and the response's `img-src` widens only when that path already allowed remote
images.

The operator may fix the mode for everyone with
`EPISTLE_PANEL_REMOTE_IMAGES`. The operator's mode wins over the cookie, the
page on `/app/me` shows the mode as read-only text instead of a select, and
the Server Action refuses a posted attempt to change it.

The issue also proposed loading images only for senders in an address book or
a trusted list. That mode is not built: the panel has no address book and no
trusted-sender list to decide it from.

## The time zone

Every date the panel prints for display is in the zone the person chose: `UTC`
or the name of an IANA zone. The choice is kept in the `time-zone` cookie under
`/app` and is one of the names the running Node knows
(`Intl.supportedValuesOf("timeZone")`) or `UTC`, exactly: a value is believed
when it is exactly one of those names, never because `Intl` accepted it, and
the list is built when the module loads, so it is the list of the process that
runs it.

The zone is read on the server (`features/time-zone/queries/time-zone`) and
given to the pages: the client components read it from a context the layout
sets (`features/time-zone/components/time-zone-provider`) and the server
components that print a date take it as a prop. The browser never reads the
cookie, which is `HttpOnly`; the zone travels down as a prop, so the server
render and the browser agree on every date.

The select is long, so it is grouped by region (`optgroup`), `UTC` first.

What the zone does not change: the dates inside a message (its body, its
headers and the `Date` header it travels with), the range of days a search
keeps (the API counts its days in Greenwich) and the columns of the timeline
(the API counts its records in days of Greenwich, so the columns stay there;
their labels say the same instants in the zone of the person).

The operator may fix the zone for everyone with `EPISTLE_PANEL_TIME_ZONE`. The
operator's zone wins over the cookie, the page on `/app/me` shows the zone as
read-only text instead of a select, and the Server Action refuses a posted
attempt to change it.

## The page size and the pace of the refreshes

Two choices of the same form, written like the others
(`features/mail/cookie/page-size`, `features/refresh/cookie`) and read on the
server (`features/mail/queries/page-size`,
`features/refresh/queries/refresh-pace`), each by a reader that believes a word
of its list and nothing else. `customising.md` has the numbers and what they do
not move; here is how they are wired.

- **The page size** is the number of messages one page of the message list
  holds: 25, 50 or 100, 50 by default (what the list held before). The one
  function that cuts the page reads it, so the page on the server and the one
  the browser asks for are the same. The tables of the administration are not
  paged by the server (the API gives them whole, or by its own cursor) and page
  by themselves in the browser with a control of their own, so this choice does
  not reach them.
- **The pace** multiplies the interval of every list that refreshes by itself
  (`normal` is today's, `slow` is twice that, `fast` is half of it and never
  under 15 s, so the status counters and the queue, already at 15 s, do not
  change). The layouts of the mail and of the administration read the
  effective pace and put it in a context around the whole frame
  (`features/refresh/components/refresh-provider`); a list asks the context for
  its interval (`useRefreshInterval`) and gives it to its query options. There
  is no `off`: a visible page left open keeps the session alive by refreshing
  its lists, and the idle timeout counts that refresh as use, so the keepalive
  runs on the effective interval. For that reason `slow` runs as `normal` when the
  idle timeout is 2 minutes or less (`effectiveRefreshPace`, applied by
  `readEffectiveRefreshPace`, which the layouts read); the form is given what was
  chosen (`readChosenRefreshPace`) and says under the field, or in the operator's
  read-only text, that it is used as `normal`.

The operator may fix either for everyone with `EPISTLE_PANEL_PAGE_SIZE` and
`EPISTLE_PANEL_REFRESH`, the same way as the others: the operator's value wins
over the cookie, the page shows it as read-only text, the Server Action refuses
a posted attempt to change it (naming every fixed field that was posted), and a
value off the list stops the start with a message that names the variable.

## What waits

Signature and shortcuts can join the same way: a new field of the form with
its list in the place that owns it, a message key per error, and its cookie
written through `lib/preference-cookie`.

## The sign-in page

It keeps no language control, because it had none: choosing a language writes a
cookie, and a write that needs no session is a cookie any visitor could set. It
speaks what the browser asked for or the operator's default
(`EPISTLE_PANEL_DEFAULT_LOCALE`), and the person changes it here once signed in.

## Tests

Each module has its own, and the proxy has `proxy-me.test.ts` and the model of
`proxy-generated-inputs.test.ts`. The e2e scenario `me` runs the page, the plain
post with no script and the refusals against the built server and the stand-in.
