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
