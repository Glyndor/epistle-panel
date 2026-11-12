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
  refuses an empty or over-long value, a bad credential and a non-admin with the
  same outcome, after the same minimum time, and the limiter runs after the
  schema, so refused input never reaches the API.
- **It stays a real `<form action>`.** Without script the browser posts the
  fields and the action runs; with script the submit handler validates first and
  calls the same action only when the schema accepts, and `noValidate` (set after
  hydration) lets the field messages replace the browser's own bubbles.
- Mode is `onSubmit` with `onChange` revalidation: a field stays quiet until the
  first submit, then corrects itself as you type. Focus goes to the first invalid
  field (`shouldFocusError`), and after a server refusal to the password field.
- Tests do not mock an action's module: `mock.module` is process-wide, and a
  form test that did so made the action's own tests fail in some orders. They
  run the real action with `fetch` stubbed.

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
  come from the per-provider allowlist in `lib/security-headers/captcha-sources`
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
