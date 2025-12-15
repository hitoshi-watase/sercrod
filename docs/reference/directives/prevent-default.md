### *prevent-default

#### Summary

`*prevent-default` attaches passive helpers that call `event.preventDefault()` for common UI events on the host element:

- Prevent the default action for the Enter key on that element.
- Optionally prevent form submission for `submit` events.

It has a short alias `*prevent`, and both directives share the same behavior and options.
`n-prevent-default` and `n-prevent` are attribute aliases for the same feature.

Use `*prevent-default` when you always want to suppress the browser’s default behavior for Enter and/or form submission on a specific element, regardless of what your own event handlers do.


#### Basic example

Prevent Enter from submitting a search form, but still handle the submit event in Sercrod:

```html
<serc-rod id="search" data='{}'>
  <form *prevent-default="'submit'" @submit="runSearch()">
    <input type="search" name="q" placeholder="Search..." />
    <button type="submit">Search</button>
  </form>
</serc-rod>
```

Behavior:

- Clicking the submit button or pressing Enter inside the form fires your `@submit` handler `runSearch()`.
- After your handler runs, `*prevent-default` calls `event.preventDefault()` on the `submit` event, so the browser does not reload or navigate.


#### Behavior

`*prevent-default` is not a structural directive; it does not change how the DOM is rendered.
Instead, it wires extra event listeners on the rendered element:

- It reads an optional mode from its attribute value.
- Based on the mode, it attaches one or both of:

  - A `keydown` listener for Enter on that element.
  - A `submit` listener on the element when it is a `FORM`.

- These listeners always call `event.preventDefault()` when they fire.
- Your own `@event` handlers still run as normal; `*prevent-default` runs in addition to them.

Aliases:

- `*prevent-default` and `*prevent` behave identically.
- `n-prevent-default` and `n-prevent` are attribute-name aliases for the same directive.


#### Modes

The directive supports a small set of string modes.
The attribute value is read and normalized as:

- If the value is empty or missing: `"enter"`.
- Otherwise: lowercase of the value (for example `"ENTER"` → `"enter"`).

Recognized modes:

- `"enter"` (default):

  - Attaches a `keydown` listener on the element.
  - When the user presses Enter (`key === "Enter"`), `event.preventDefault()` is called.

- `"submit"`:

  - If the element is a `FORM`, attaches a `submit` listener.
  - When the form is submitted, `event.preventDefault()` is called.

- `"all"`:

  - Combines both behaviors:
    - Prevent default on Enter keydown.
    - Prevent default on form submission (if the element is a `FORM`).

Any other string:

- If the normalized mode is not `"enter"`, `"submit"`, or `"all"`, no listeners are attached and the directive has no effect.


#### Evaluation timing

`*prevent-default` is evaluated when Sercrod renders the host element and sets up its event handlers:

- The attribute value is read once during render.
- The mode is determined at that time.
- The corresponding listeners are attached to the real DOM element.

On re-render:

- When the element is re-rendered, Sercrod creates a fresh DOM element and re-applies `*prevent-default` to that instance.
- The directive does not dynamically reconfigure listeners based on later data changes; changes to the mode expression take effect on the next render of that element.


#### Execution model

Conceptually, when Sercrod processes an element that has `*prevent-default` or `*prevent`:

1. Determine the mode:

   - Read `*prevent-default` or `*prevent` from the template node.
   - If it is empty or missing, use `"enter"`; otherwise, use the lowercase string value.

2. Attach listeners on the rendered element:

   - For `"enter"` and `"all"`:
     - Add `keydown` listener.
     - If `e.key === "Enter"`, call `e.preventDefault()`.

   - For `"submit"` and `"all"`:
     - If the element is a `FORM`, add `submit` listener.
     - In that listener, always call `e.preventDefault()`.

3. The directive does not alter the element’s scope or its child rendering.
   It only adds these helper listeners.

Interaction with `@event` handlers:

- Sercrod also registers handlers for attributes like `@click`, `@submit`, `@keydown`, etc.
- Those handlers are attached separately from `*prevent-default`.
- On an actual event:

  - Your handler from `@event` runs.
  - The helper from `*prevent-default` runs and calls `preventDefault()` when its conditions match.

The exact order of handler execution is an implementation detail, but you can rely on the fact that `preventDefault()` will be called for the configured modes, regardless of whether your handler calls it.


#### Scope and variables

`*prevent-default`:

- Does not create new variables.
- Does not modify the evaluation scope.
- Does not introduce `$event` or `$e` by itself.

Use inside event handlers:

- When you define `@event` handlers, Sercrod evaluates expressions in the normal template scope.
- The directive’s only responsibility is to add the preventive listeners; it does not change how event handler expressions are evaluated.


#### Use with event handlers and modifiers

`*prevent-default` is designed to complement Sercrod’s event attributes:

- With `@submit`:

  ```html
  <form *prevent-default="'submit'" @submit="save()">
    <!-- fields -->
  </form>
  ```

  - Your `save()` handler runs.
  - The directive ensures the form does not perform the default browser submit.

- With key handling:

  ```html
  <input
    type="text"
    *prevent-default="'enter'"
    @keydown="onKey()"
  />
  ```

  - Pressing Enter triggers `@keydown="onKey()"`.
  - The helper calls `preventDefault()` on the Enter `keydown` event.

Relationship to event modifiers:

- Sercrod’s event system supports modifiers like `@click.prevent` or `@submit.stop`.
- Those modifiers apply per handler and control behavior only when that particular handler runs.
- `*prevent-default` is a separate, directive-level helper that:

  - Does not depend on any particular `@event`.
  - Works even if you omit `.prevent` on your handlers.
  - Can be used together with event modifiers if you want both patterns.


#### Best practices

- Choose the simplest suitable mode:

  - Use `"enter"` when you only want to block Enter key behavior on an element (for example to prevent implicit submits in forms with custom behavior).
  - Use `"submit"` when you want to stop default form submission but still handle `@submit` yourself.
  - Use `"all"` on forms when you want both behaviors at once (block Enter and block submit).

- Make the mode explicit:

  - Even though `"enter"` is the default, it is clearer to write the mode explicitly in most cases:

    ```html
    <form *prevent-default="'submit'" @submit="save()">
      ...
    </form>
    ```

  - Explicit modes help avoid confusion for future readers of the template.

- Combine with `@submit` instead of removing it:

  - `*prevent-default` is not a replacement for an actual `@submit` handler.
  - Prefer to keep `@submit` for your logic and use the directive only to suppress the browser’s navigation or reload.

- Avoid unsupported modes:

  - Do not rely on arbitrary strings like `"click"` or `"change"` as modes; they are currently ignored.
  - For per-event control outside the built-in modes, use event modifiers such as `@click.prevent`.


#### Additional examples

Prevent both Enter and submit on a login form:

```html
<serc-rod id="login" data='{}'>
  <form *prevent-default="'all'" @submit="doLogin()">
    <label>
      Email
      <input type="email" name="email" />
    </label>
    <label>
      Password
      <input type="password" name="password" />
    </label>
    <button type="submit">Sign in</button>
  </form>
</serc-rod>
```

Use the short alias `*prevent`:

```html
<serc-rod id="contact" data='{}'>
  <form *prevent="'submit'" @submit="sendMessage()">
    <textarea name="body"></textarea>
    <button type="submit">Send</button>
  </form>
</serc-rod>
```

In both examples:

- The form’s default submission is suppressed by the directive.
- Your handler is responsible for sending data (for example via `fetch`, `*post`, or another mechanism).


#### Notes

- `*prevent-default` and `*prevent` are non-structural event helpers; they never change the rendered DOM structure.
- Their effect is limited to adding listeners for the Enter `keydown` event and the `submit` event (for form elements).
- Modes other than `"enter"`, `"submit"`, and `"all"` are ignored by the current implementation.
- The directive is independent of event modifiers like `.prevent` or `.stop` and can be composed with them when needed.
