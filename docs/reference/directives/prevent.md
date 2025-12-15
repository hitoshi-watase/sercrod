### *prevent

#### Summary

`*prevent` is a shorthand for `*prevent-default`.
It attaches low-level listeners that call `event.preventDefault()` for specific events on the host element:

- Enter key presses (`keydown`).
- Form `submit` events (when the host is a `<form>`).
- Or both, depending on the mode.

Unlike many other directives, the attribute value is not a Sercrod expression.
It is a simple mode string such as `enter`, `submit`, or `all`.


#### Basic example

Prevent the browser’s default form submission, but still run your handler:

```html
<serc-rod id="form-app" data='{"status": null}'>
  <form *prevent="submit" @submit="status = 'saved'">
    <input type="text" name="title">
    <button type="submit">Save</button>
    <p *if="status" *print="status"></p>
  </form>
</serc-rod>
```

In this example:

- The browser’s built-in form submission is blocked.
- The `@submit="status = 'saved'"` handler still runs.
- The page does not navigate away; you stay in the current Sercrod host.


#### Behavior

`*prevent` and `*prevent-default` are handled by the same runtime branch:

- If the element has either `*prevent-default` or `*prevent`, Sercrod:

  - Reads the raw attribute value.
  - Interprets it as a mode string.
  - Installs one or more DOM event listeners on the host element.

- Supported modes (case-insensitive):

  - `enter` (default)
  - `submit`
  - `all`

- Defaulting:

  - If the attribute value is empty or omitted, the mode is treated as `enter`.

Behavior by mode:

- `enter`:

  - Attaches a `keydown` listener to the host.
  - When `e.key === "Enter"`, it calls `e.preventDefault()`.
  - No `submit` listener is installed.

- `submit`:

  - If the host element is a `<form>`, attaches a `submit` listener.
  - That listener always calls `e.preventDefault()` on submit.
  - No `keydown` listener is installed for Enter.

- `all`:

  - Installs both:

    - `keydown` listener that blocks the Enter key.
    - `submit` listener on `<form>` that blocks form submission.

Any other mode string:

- If the mode is not `enter`, `submit`, or `all`, no listeners are attached.
- The directive effectively does nothing in that case.


#### Relationship to *prevent-default

`*prevent` is purely syntactic sugar:

- The runtime branch is shared:

  - It checks for `*prevent-default` or `*prevent`.
  - It uses whichever attribute is present to read the mode string.

- This means:

  - `*prevent-default` and `*prevent` accept the same set of modes.
  - They produce the same effect when given the same mode.

Typical usage patterns:

- Verbose form:

  ```html
  <form *prevent-default="all" @submit="save()">
    ...
  </form>
  ```

- Shorthand:

  ```html
  <form *prevent="all" @submit="save()">
    ...
  </form>
  ```

In both cases:

- The browser’s default form submission is blocked.
- Sercrod event handlers attached via `@submit` still run.


#### Modes in detail

Mode string handling:

- The raw attribute value is not evaluated as an expression.
- It is treated as plain text and converted to lower case internally.
- Whitespace is not trimmed inside; you should write simple tokens such as `enter` or `submit`.

Supported modes:

- `enter` (default):

  - Installs `keydown` listener:

    - On any element, when Enter is pressed (`e.key === "Enter"`), `e.preventDefault()` is called.

  - Recommended when:

    - You want to prevent Enter from triggering built-in behaviors, for example:

      - Implicit form submit.
      - Activating a focused control in a way you do not want.

- `submit`:

  - Effective only when the host is a `<form>`.
  - Installs a `submit` listener that always calls `e.preventDefault()`.

  - Recommended when:

    - You want full manual control over form submission via `@submit` or other handlers.
    - You intend to submit via `fetch`, `XMLHttpRequest`, or some other custom logic.

- `all`:

  - Combines the two:

    - Blocks Enter key default on the host.
    - Blocks native form submit if the host is a `<form>`.

  - Recommended when:

    - You want to make sure that neither Enter nor submit cause any built-in navigation or reload.


#### Evaluation timing

`*prevent` and `*prevent-default` are processed when Sercrod renders each element:

- After attribute-based handlers (`@click`, `@submit`, and so on) are attached.
- Before Sercrod moves on to other non-structural directives on the same element.

Important points:

- The mode is read once when the element is processed.
- The mode string is not re-evaluated on subsequent updates.
  - Changing the attribute value after initial render does not reconfigure the listeners.
- The listeners remain attached for the lifetime of the host element.


#### Execution model

Conceptually, the runtime flow for `*prevent` looks like:

1. Detect:

   - Check whether the node has `*prevent-default` or `*prevent`.

2. Read mode:

   - `raw = value of "*prevent-default" or "*prevent" (whichever exists)`.
   - `mode = (raw || "enter").toLowerCase()`.

3. Attach listeners:

   - If `mode` is `enter` or `all`:

     - Add a `keydown` listener like:

       - On `keydown`, if `e.key === "Enter"`, call `e.preventDefault()`.

   - If `mode` is `submit` or `all` and the host is a `<form>`:

     - Add a `submit` listener that always calls `e.preventDefault()`.

4. Continue:

   - Sercrod continues processing other directives and attributes as usual.
   - Event handlers registered via `@...` attributes are not replaced; they remain intact.


#### Interaction with Sercrod event handlers

`*prevent` is complementary to the `@` event system:

- `*prevent` controls whether the browser’s default action runs.
- `@event="handler(...)"` controls which Sercrod expression is executed.

Example: manual form handling

```html
<serc-rod id="login-app" data='{"error": null}'>
  <form *prevent="submit" @submit="login()">
    <input type="text" name="user">
    <input type="password" name="pass">
    <button type="submit">Log in</button>
    <p *if="error" *print="error"></p>
  </form>
</serc-rod>
```

In this setup:

- The `submit` event is delivered to the Sercrod handler `login()`.
- The browser does not perform a real HTTP form submission.
- You are free to implement `login()` with `fetch`, show errors in the page, etc.

Key points:

- `*prevent` does not automatically invoke your handlers.
- It only changes whether the browser’s built-in behavior (navigation, form submit) happens.
- You should still define `@submit`, `@keydown`, or other `@event` handlers as needed.


#### Use cases

Typical scenarios where `*prevent` is useful:

- Prevent accidental form submissions:

  - When you want to treat the Enter key as “do nothing” or “move focus” instead of “submit now”.

- Single-page flows:

  - When forms are handled entirely in JavaScript, and navigating away would destroy state.

- Controlled forms:

  - When you have a Sercrod-based validation or saving flow and do not want an actual page reload.


#### Best practices

- Always specify a mode for clarity:

  - `*prevent="submit"` for forms.
  - `*prevent="enter"` for non-form controls where Enter should be ignored.
  - `*prevent="all"` when you want both behaviors.

- Prefer `*prevent` for readability:

  - Use `*prevent="submit"` instead of the longer `*prevent-default="submit"` wherever you can.
  - Both are supported, but `*prevent` is shorter and easier to scan.

- Keep in mind it is not an expression:

  - Do not write `*prevent="enablePrevent ? 'submit' : null"`.
  - The directive will treat that entire string literally and not evaluate it.

- Combine with `@` handlers:

  - `*prevent` is most useful when combined with explicit handlers that implement your custom logic.
  - For example, `*prevent="submit" @submit="saveDraft()"` gives you full control without navigation.


#### Additional examples

Block Enter on a text input:

```html
<input type="text"
       *prevent="enter"
       @keydown="onKeydown($event)">
```

- Enter key default is blocked.
- Your `onKeydown` handler still receives the event via `@keydown`.

Block both Enter and submit on a form:

```html
<form *prevent="all" @submit="save()">
  <input type="text" name="title">
  <button type="submit">Save</button>
</form>
```

- Enter in the form does not cause a browser-level submit.
- Clicking the submit button does not perform a native submit.
- Your `save()` handler still runs.


#### Notes

- `*prevent` and `*prevent-default` share a single implementation branch and support the same modes.
- The attribute value is a plain mode string, not a Sercrod expression; unsupported mode strings result in no special behavior.
- `*prevent` only covers Enter keydown and form submit:

  - It does not automatically block other keys or mouse events.
  - For more complex behaviors, combine `*prevent` with explicit `@event` handlers and custom logic.

- There are no Sercrod-level restrictions on combining `*prevent` with other directives on the same element, but:

  - It only affects Enter and `submit`.
  - It does not alter the semantics of other structural or data-binding directives.
