### *eager

#### Summary

`*eager` is an optional modifier for `*input` / `n-input` that makes Sercrod re-render the host “eagerly” on every input-like event for text fields and textareas.

- Without `*eager`, data is still written on every event, but the host only performs a narrower update (typically propagating changes to child Sercrod components).
- With `*eager`, the host calls `update()` after each input event on the control (subject to `*stage` and host-level `*lazy`).
- `*eager` has an alias `n-eager`.

`*eager` only has effect on elements that also carry `*input` or `n-input` and are treated as text-like controls by Sercrod.


#### Basic example

Enable eager updates on a text input:

```html
<serc-rod id="profile" data='{"user":{"name":""}}'>
  <form>
    <label>
      Name:
      <input type="text" *input="user.name" *eager>
    </label>

    <p>Preview: <span *print="user.name"></span></p>
  </form>
</serc-rod>
```

Behavior:

- Every keystroke in the input writes to `user.name`.
- Because of `*eager`, Sercrod calls `update()` for the host after each input event.
- The `<span *print="user.name">` is kept in sync keystroke-by-keystroke, without waiting for a change or submit event.


#### Behavior

Scope of `*eager`:

- `*eager` is interpreted only when the element also has `*input` or `n-input`.
- It is a non-structural modifier: it does not change how templates are expanded, only when and how the host re-renders in response to user input.

Targeted controls:

- When the host binds a form control through `*input` / `n-input`, it distinguishes three main groups:

  - Text-like controls:
    - `<input>` with a type that is not `checkbox` or `radio`.
    - `<textarea>`.
    - These use the `input` event for “live” updates.

  - Change-driven controls:
    - `<input type="checkbox">`.
    - `<input type="radio">`.
    - `<select>` (single or multiple).
    - These use the `change` event.

  - Everything else:
    - Treated as change-driven; bound on `change`.

Effects of `*eager`:

- For text-like controls (text inputs and textareas):

  - Every input event:
    1. Writes the new value to the bound data path (via `*input`).
    2. If the host is not staged (`*stage` is not active):

       - If `*eager` (or `n-eager`) is truthy:
         - The host calls `update()` immediately.
       - Otherwise:
         - The host triggers only child updates through `_updateChildren(...)`.

- For change-driven controls (checkbox, radio, select, other):

  - `*eager` is currently not consulted.
  - These controls always write on `change`, and the update strategy is governed by `*lazy` (not by `*eager`).

In other words:

- `*eager` specifically upgrades the update policy for text-like `*input` bindings.
- It does not override the change-event logic of checkboxes, radios, or selects.


#### Activation and value semantics

`*eager` and `n-eager` are treated as boolean or conditionally-boolean attributes with a small amount of convenience logic.

Recognized forms:

- Bare attribute (always enabled):

  ```html
  <input *input="form.name" *eager>
  <input *input="form.email" n-eager>
  ```

  - If `*eager` / `n-eager` is present and its attribute value is empty or `null`, `isEager` becomes `true`.

- Conditional expression:

  ```html
  <input *input="form.name" *eager="settings.livePreview">
  <input *input="form.email" n-eager="user.prefersEagerInputs">
  ```

  - Sercrod evaluates the attribute value as a normal expression in the current scope.
  - If evaluation succeeds:
    - `isEager` is `Boolean(result)`.
  - If evaluation throws (for example, due to a `ReferenceError`):
    - Sercrod falls back to a string-based rule:
      - If the raw attribute value is `"false"` (any case), `isEager` is `false`.
      - Any other non-empty literal string makes `isEager` `true`.

Practical interpretation:

- Use bare `*eager` when you always want eager behavior.
- Use `*eager="expr"` when you want to toggle eager behavior from application data.
- If you accidentally give it a literal string that is not a valid expression, `"false"` disables eagerness, everything else enables it.


#### Interaction with *input / n-input

`*eager` has no meaning by itself. It only matters in combination with `*input` or `n-input`:

- Without `*input` / `n-input`:

  - `*eager` is effectively ignored.
  - Sercrod does not attach eager behavior to arbitrary elements.

- With `*input` / `n-input`:

  - Sercrod reads `*eager` / `n-eager` during binding setup for that control.
  - `*eager` influences how often the host re-renders in response to that control’s user events.

Data writes:

- Regardless of `*eager`, when the control’s event handler fires:

  - Sercrod always writes the new value to the bound path via `assign_expr`.
  - `*eager` does not delay or batch the write; it only changes the re-render strategy.

Summary:

- `*input` controls “what gets written and where”.
- `*eager` controls “how aggressively the host re-renders after a text input changes”.


#### Interaction with *lazy

There are two separate uses of `*lazy` in Sercrod:

1. Host-level `*lazy` on `<serc-rod>`:
   - Affects how often the host re-renders in response to generic updates and events.

2. Input-level `*lazy` on controls that also have `*input` / `n-input`:
   - Affects how change-driven controls (checkbox, radio, select, other) update the host after writes.

`*eager` interacts only with the first group (text-like `*input` bindings) and does not override the second:

- For text inputs and textareas:

  - `*eager` decides whether to call `update()` on each input event.
  - Host-level `*lazy` can still influence what `update()` actually does:
    - If the host is marked `*lazy`, an `update()` triggered by `*eager` may short-circuit to “child-only updates plus hooks” instead of a full template rebuild.

- For change-driven controls:

  - `*eager` is ignored.
  - `*lazy` on the control (or on the host) controls whether `update()` is called on change, or whether only children are updated.

Rule of thumb:

- Use `*eager` on text-like `*input` controls when you want immediate visual feedback.
- Use `*lazy` on hosts or change-driven controls when you want to avoid full host re-renders on every change.


#### Interaction with *stage

`*eager` respects `*stage`:

- When the host is in staged mode (`*stage` is active and `_stage` is set):

  - Input handlers still write into the staged data copy.
  - However, the eager update path is disabled:
    - The guards around `update()` check `!this._stage` before re-rendering.
  - The host is not re-rendered on each input, even if `*eager` is true.

- When you later apply the staged changes (for example via `*apply` or the appropriate host-level flow):

  - The host re-renders based on the staged data being committed.
  - `*eager` does not affect this commit-time re-render; it only affects live updates while the host is not staged.

This allows you to combine:

- `*stage` for “edit, then apply” flows, with
- `*eager` for immediate feedback in non-staged contexts.


#### Evaluation timing

The value of `*eager` is determined when Sercrod binds the element:

- During `_renderElement`, when a node with `*input` / `n-input` is processed:
  - Sercrod parses and evaluates the `*eager` / `n-eager` attribute.
  - The resulting boolean `isEager` is captured in the event handlers.

Consequences:

- Changes to the expression behind `*eager` only take effect after the host re-renders and the binding is re-established.
- `*eager` is not re-evaluated on every keystroke; it is per-render, not per-event.

If you need to switch between eager and non-eager modes at runtime:

- Drive the condition in `*eager="..."` from reactive data.
- Cause a host re-render (for example by updating any data that affects the template).
- The next binding pass will pick up the new value of `*eager`.


#### Execution model

For a text-like input with `*input` and optional `*eager`, the flow is:

1. Binding setup (render time):

   - Sercrod reads the `*input` / `n-input` expression and figures out a target data object.
   - It evaluates `*eager` / `n-eager` once to compute `isEager`.
   - It sets the initial control value based on the current data.
   - It attaches event listeners (`input` and/or `change`) that capture `isEager`.

2. On each `input` event (text inputs and textareas):

   - Sercrod transforms the raw value using any installed input filters.
   - It writes the value to the bound data path with `assign_expr`.
   - If the host is not staged:
     - If `isEager` is `true`:
       - It calls `update()` on the host.
     - Otherwise:
       - It only propagates updates to child Sercrod instances (`_updateChildren(...)`).

3. On `change` events (checkbox/radio/select/others):

   - Sercrod computes and writes the new value, similar to text inputs.
   - `isEager` is ignored; the actual update policy is controlled by `*lazy`.

In all cases, `*eager` does not change what is written, only when and how broadly the host re-renders.


#### Best practices

- Use `*eager` for “live preview” fields:

  - Examples: search boxes, “slug” fields, inline previews, character counters.
  - These benefit from the host re-rendering on every keystroke.

- Avoid `*eager` on very heavy components:

  - If the host template is large or expensive to render, eager updates on every keystroke can become costly.
  - Consider:
    - Leaving the host in the default behavior (child-only updates).
    - Or using a staged / debounced pattern at the application level.

- Combine with `*stage` for complex forms:

  - Use `*stage` to isolate edits.
  - Use `*eager` only on selected inputs where live feedback is clearly worth the cost.
  - Remember that `*eager` is ignored while the host is staged; the main benefit appears once the host returns to non-staged mode.

- Keep `*eager` expressions simple:

  - Prefer boolean or simple property checks, such as `*eager="settings.eagerInputs"`.
  - If you need more elaborate logic, compute it in data or methods, and reference it from `*eager`.

- Do not rely on `*eager` for change-only controls:

  - For checkboxes, radios, and selects, `*eager` does not alter the re-render policy in the current implementation.
  - For those controls, use `*lazy` (or host-level `*lazy`) to adjust behavior.


#### Examples

Live search box:

```html
<serc-rod id="search" data='{"query":"","results":[]}'>
  <div>
    <input
      type="search"
      placeholder="Type to search"
      *input="query"
      *eager>
  </div>

  <ul *each="item of results">
    <li *print="item.label"></li>
  </ul>
</serc-rod>
```

- Each keystroke updates `query` and triggers `update()` because of `*eager`.
- A separate mechanism (for example `*post` or `*api` wired to `query`) can refresh `results`.

Conditional eager mode:

```html
<serc-rod id="settings" data='{
  "user": { "name": "" },
  "ui":   { "eagerPreview": true }
}'>
  <label>
    <input type="checkbox" *input="ui.eagerPreview">
    Enable eager preview
  </label>

  <label>
    Name:
    <input
      type="text"
      *input="user.name"
      *eager="ui.eagerPreview">
  </label>

  <p>Preview: <span *print="user.name"></span></p>
</serc-rod>
```

- When `ui.eagerPreview` is `true`, name changes re-render the host on each keystroke.
- When it is `false`, the host falls back to the default, narrower update behavior.


#### Notes

- `*eager` and `n-eager` are aliases; choose one naming style and stick to it for consistency.
- `*eager` is meaningful only in combination with `*input` / `n-input`; on other elements, it is effectively ignored.
- In the current implementation:
  - Text-like controls with `*input` always write data on each `input` event; `*eager` controls whether the host re-renders fully on each event.
  - Change-driven controls (checkbox, radio, select, others) do not consult `*eager` and instead rely on `*lazy`.
- Host-level `*lazy` and `*stage` are still respected; `*eager` can request eager host updates, but the host’s own lazy and staged policies can limit when full re-renders actually occur.
