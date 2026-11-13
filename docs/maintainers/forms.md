# Forms

A form is react-hook-form with a zod schema that the Server Action enforces too.

- **One schema per form**, in `features/<f>/schemas/<form>`. The browser uses it
  through `zodResolver` as fail-fast help (it saves a request and names the
  field); the Server Action parses the same schema and is the real gate. A
  schema that ships to the browser is written in `zod/mini`, which tree-shakes
  (the sign-in page carries the core and the resolver, about 17 KB gzip, not the
  full library). The message of a failed check is a message key of the form's
  namespace; the component translates it with `FormMessage render`.
- **`components/ui/form`** is the shadcn Form on the panel's tokens. Each field
  subscribes to its own state (`useFormState({ name })`), so typing in one field
  does not re-render the others. `FormControl` sets the id, `aria-invalid` and
  an `aria-describedby` that names the message only while there is one.
- **The action's answer is generic where a specific one would leak.** Sign-in
  refuses an empty or over-long value and a bad credential with the same outcome, after the same minimum time, and the limiter runs after the
  schema, so refused input never reaches the API.
- **It stays a real `<form action>`.** Without script the browser posts the
  fields and the action runs; with script the submit handler validates first and
  calls the same action only when the schema accepts. The browser's own check
  stays on (no `noValidate`): it is the first of the three checks below.
- Mode is `onSubmit` with `onChange` revalidation: a field stays quiet until the
  first submit, then corrects itself as you type. Focus goes to the first invalid
  field (`shouldFocusError`), and after a server refusal to the password field.
- Tests do not mock an action's module: `mock.module` is process-wide, and a
  form test that did so made the action's own tests fail in some orders. They
  run the real action with `fetch` stubbed.

## Three checks, in order

A field is checked three times, each time by something that knows more.

1. **The browser**, from the field's own attributes: `required`, `minLength`,
   `maxLength`, `pattern`, `type`, `inputMode`. It runs before any script and
   costs nothing. Write the attributes from the same constants the schema uses,
   and test that they agree (`account-create-form` does: the HTML pattern, the
   form schema and the action schema accept exactly the same names).
2. **The schema**, in the form: what attributes cannot say (every line of a
   text area is an address, no control character in a name), with a message per
   field.
3. **The server**, twice: the Server Action parses the schema again, since the
   browser's two checks are bypassed by anyone who posts by hand, and the mail
   server decides what only it knows (the name is free, the address is in a
   hosted domain, the password is not in its list of leaked ones). Its refusal
   comes back as a category, never its words: the API's message can quote what
   was sent, a password included.

Every form has the three. What each field carries:

| Form | In the page | In the schema only |
| --- | --- | --- |
| Sign-in | `required`, `maxLength` | nothing more |
| New account | name: `required`, `maxLength`, `pattern`; display name: `maxLength`, `pattern`; addresses: `required`, `maxLength`; password: `required`, `minLength`, `maxLength` | each address is an address, at most 20; the exact length of the display name; the password's characters |
| Display name | `maxLength`, `pattern` (no control character) | the exact length, by code point |
| Password | `required`, `minLength`, `maxLength` | printable ASCII only |
| Masked address | `required`, `maxLength`, `pattern` (a letter or digit) | nothing more |
| Composer | `maxLength` on every field | which pieces of a recipient field are addresses; a recipient to send |
| Delivery filters | `maxLength`, `pattern` (an address) | read again from the query, a bad value dropped |
| Mail search | `maxLength` | read again from the query |

Rules for writing them:

- **Every field a person types into has a `maxLength`**, from the constant its
  schema holds. `src/test/bounded-fields` reads every screen and fails on a
  text field without one.
- **The page's length is one over the schema's** (`fieldLength(limit)`). A
  browser cuts a paste at `maxlength` without a word, and what is left would
  be sent as if it were whole: a password nobody typed, a list of recipients
  ending in half an address that still reads as one. With one character of
  room the cut value is over the schema's limit, so the form names it and
  sends nothing. The two GET forms (delivery filters, mail search) have no
  schema in the page and keep the exact length: the server reads the query
  again and drops or refuses what does not fit.
- **A length the browser cannot count exactly is doubled.** `maxlength` counts
  UTF-16 units and the mail server counts a display name by code point, where
  an emoji is one. The input allows twice the limit (`DISPLAY_NAME_HTML_MAX`),
  so no name the server takes is cut, and the schema does the exact count.
- **The display name is the one field the two read differently at an edge.**
  The schema trims before it looks for a control character, so a tab at an end
  passes it; the browser's pattern does not trim and asks for the tab to be
  removed. The test names that value.
- **A `pattern` is written for the `v` flag.** The browser anchors the
  attribute and compiles it with `v`, where a bare `-` at the end of a class is
  a syntax error; it then ignores the attribute, logs an error, and the field
  checks nothing. Escape the hyphen, and derive the attribute from the schema's
  own pattern when there is one (`MAIL_ADDRESS_HTML_PATTERN` is the source of
  `MAIL_ADDRESS_PATTERN` without its anchors). A pattern gets a `title` that
  says what is wanted, as a hint and not as an error (it is also the field's
  tooltip): the browser shows it with its own message. The field's help goes
  in `FormDescription`, so the help, not the title, is what describes it.
- **The composer keeps `noValidate`.** Its only attributes are lengths, which
  the browser enforces while typing whatever the form says, and its two buttons
  check different things (a draft needs no recipient).
- **The schema's messages are keys, kept in one list** when a field can also
  show a sentence (`COMPOSE_SIZE_MESSAGES`): the form translates a message only
  when it is in the list, and a test holds the list against the catalog.

Test each layer on its own, since the first hides the second:

- the attributes, against the constants and against the schema value by value
  (the same values accepted and refused by both);
- a click on the button with a value the attributes refuse: the field is
  `:invalid`, nothing is sent, and no message of the schema appears;
- a click with a value of the field's whole length, which is what a cut paste
  leaves: the browser has nothing to say, the schema names it too long, and
  nothing is sent;
- `fireEvent.submit` on the form, which is what a script does without the
  browser's validation: the schema names the field and nothing is sent;
- the action's own test, with a request posted by hand.

happy-dom reads `pattern` with no flag and no anchors, so a Unicode class such
as `\p{Cc}` was read as letters and a field every browser accepts stopped the
submit in a test. The test setup installs the standard's reading
(`src/test/browser-pattern`), so `validity.patternMismatch` and
`checkValidity()` say in a test what they say in a browser.

A help text goes in `FormDescription`, and its `FormItem` is marked
`described`: the control is then described by the help from the first render,
and by the help and the error once there is one.

The field-level spacing is the adopted contract of the design bar: 8 px between
label, control and message, 16 px between fields. A message appearing moves what
is below it by its height plus the gap (24 px for one line).

## The sign-in CAPTCHA

Optional and off by default: with `EPISTLE_PANEL_CAPTCHA_PROVIDER` unset the page
loads nothing from any other host and the CSP is the plain one. The contract is
in `features/auth/captcha/`; a provider is a name, a widget script, a
verification endpoint and the CSP sources it needs.

| Provider | Value | Widget and verification |
|---|---|---|
| Cloudflare Turnstile | `turnstile` | `challenges.cloudflare.com`; the widget is asked for the action `login` and the answer must carry it |
| Google reCAPTCHA v2 | `recaptcha` | `www.google.com/recaptcha`, `www.gstatic.com/recaptcha` |
| hCaptcha | `hcaptcha` | `hcaptcha.com` and its subdomains, verification at `api.hcaptcha.com` |
| Custom | `custom` | a script and a verification URL the operator names, see below |

Configuration, all environment variables:

- `EPISTLE_PANEL_CAPTCHA_PROVIDER`: one of the values above; unset or `off` is off.
- `EPISTLE_PANEL_CAPTCHA_SITE_KEY`: the public site key.
- `EPISTLE_PANEL_CAPTCHA_SECRET_KEY` or, preferred, `EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE`:
  the secret, read with the same validated reader as the other secrets.
- `EPISTLE_PANEL_CAPTCHA_HOSTNAME` (optional): the host name the provider must
  report the solve on; a different one is refused.
- For `custom` only: `EPISTLE_PANEL_CAPTCHA_SCRIPT_URL` and
  `EPISTLE_PANEL_CAPTCHA_VERIFY_URL` (https; plain http only for a loopback host)
  and `EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD` (default `captcha-response`).

The custom contract: the panel loads the script, puts `data-sitekey` and
`data-action` on a `.captcha-widget` box inside the sign-in form, and the script
draws into it and writes the token into an input named `RESPONSE_FIELD` in the
same form; the panel reads that input when the form is submitted. The
verification endpoint gets a form-encoded POST with `secret` and `response` and
answers `{"success": true|false, "hostname"?: ..., "error-codes"?: [...]}`, the
shape the three providers share.

What the panel guarantees:

- **The CSP is widened for one provider, on the sign-in page only.** The sources
  come from the per-provider allowlist in `features/auth/captcha/csp-sources`
  (a custom provider gets the origin of its own script) and go into `script-src`,
  `connect-src` and a new `frame-src`; no other directive changes, there is no
  `unsafe-inline`, and no other page or response is widened. The widget's styles
  live inside its frame, so `style-src` stays `'self'`.
- **The Server Action verifies before it does anything else costly.** The order
  is: schema, CAPTCHA, limiter, API. The CAPTCHA comes before the limiter so a bot
  that cannot solve it never counts against a name's backoff or the global
  ceiling, which would otherwise let it lock an operator out or burn the shared
  allowance. The price is one provider call per attempt, bounded by a timeout of
  5 s, a 16 KiB cap on the answer, no redirects and at most 16 calls in flight.
  A call above that ceiling waits for a slot, first in first out, for at most
  1.5 s with at most 32 others in line, and only then is refused without a
  request, so a short burst is absorbed. A slot is always given back, on an
  error and on a timeout. What it does not stop: concurrency kept above the
  ceiling and the line for longer than that still refuses sign-ins, the same
  trade-off as the cap on API calls. The client address is not trusted here, so
  the ceiling cannot be split per client.
- **It fails closed.** A provider named without a usable setup (missing site key
  or secret, unknown provider, bad URL), an unreadable secret file, an outage,
  a timeout or an answer that is not the expected shape all refuse the sign-in
  with the same generic message and the same minimum time. The log names the
  provider and the reason, or the variable at fault, once a minute at most for a
  setup problem. It never holds a token, a secret or a configured value.
- **A token is single use.** The form draws a new challenge after every answer
  and asks for it before any request when it is not solved.
- Without script a form cannot solve a CAPTCHA, so sign-in is refused: with the
  CAPTCHA on, the panel needs JavaScript to sign in.

Not covered: the real providers' widgets were not driven in this repository's
tests (the unit tests use mocked endpoints and the e2e a stand-in provider).
