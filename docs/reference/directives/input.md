### *input

#### Summary

`*input` binds a form control’s value to a data path.
It keeps a DOM control (such as `<input>`, `<textarea>`, or `<select>`) in sync with a field in Sercrod’s data or staged data.
The alias `n-input` behaves identically.

`*input` is focused on value-level binding and works together with `*lazy` and `*eager` to control how often the host re-renders after a change.


#### Basic example

A simple text field bound to `form.name`:

```html
<serc-rod id="app" data='{"form":{"name":"Alice"}}'>
  <label>
    Name:
    <input type="text" *input="form.name">
  </label>

  <p>Hello, <span *print="form.name"></span>!</p>
</serc-rod>
```

Behavior:

- On initial render, the `<input>` shows `"Alice"`.
- When the user edits the field, `form.name` is updated.
- The `<span *print="form.name">` reflects the new value after Sercrod’s update cycle.


#### Behavior

`*input` provides a two-way binding between a control and a data expression:

- Data to UI:
  - On render, Sercrod evaluates the expression from `*input` and sets the control’s current value, checked state, or selection.
- UI to data:
  - When the user interacts with the control, Sercrod writes the new value back to the expression using `assign_expr`.
  - Optional filters (`model_out` and `input_in`) can transform data when rendering or capturing input.
- Staged vs live data:
  - If the host has staged data (`this._stage`), `*input` writes into the staging area.
  - If not, `*input` writes directly into the main data.

Supported tags:

- `INPUT`
- `TEXTAREA`
- `SELECT`

Other elements with a `.value` property may technically work, but `*input` is designed primarily for standard form controls.


#### Expression syntax

The `*input` expression is evaluated as a normal Sercrod expression and used as an assignment target:

- Typical pattern:

  - `*input="form.name"`
  - `*input="user.profile.email"`
  - `*input="settings.volume"`

- The left-hand side can be:
  - A simple identifier (`username`).
  - A dotted path (`form.name`, `user.settings.theme`).
  - Any expression that is valid on the left of an assignment inside `with(scope){ ... }`.

Assignment semantics:

- Sercrod’s `assign_expr(lhs, value, scope)`:
  - Uses a sandboxed `with(scope){ lhs = __val }`.
  - For unknown top-level identifiers, it allocates nested objects on demand.
    - For example, `*input="profile.name"` on an initially empty data object will create `data.profile` if needed.
  - If the assignment fails, Sercrod logs a warning (when warn logging is enabled) and keeps the UI functional.

Best practice:

- Use simple property paths for `*input` (for example `form.name` or `user.email`).
- Avoid complex arbitrary expressions on the left-hand side, as they may be hard to reason about in assignment.


#### Evaluation timing

`*input` participates in two phases:

1. Initial reflection (data to UI):

   - During render, after Sercrod has prepared the scope, it:
     - Evaluates the `*input` expression on either staged or main data.
     - Applies the value to the control:
       - For `input[type="checkbox"]`: sets `checked` from a boolean or array value.
       - For `input[type="radio"]`: sets `checked` based on equality against the bound value.
       - For other inputs and textarea: sets `.value`.
       - For select: sets the selected option(s).

2. Event-driven updates (UI to data):

   - Sercrod attaches event listeners:
     - `input` for text-like controls.
     - `change` for checkboxes, radios, selects, and others.
   - On those events, it:
     - Normalizes the new value (including optional numeric conversion).
     - Passes the value through `input_in` filter.
     - Writes the result back via `assign_expr`.
     - Triggers either a full update or a more focused child update depending on `*lazy` and `*eager`, and whether staging is active.

If the host has staged data, updates do not trigger a live host re-render until the staged changes are applied.


#### Execution model

A simplified execution model for `*input`:

1. Resolve binding:

   - Sercrod obtains the expression string from `n-input` or `*input`.
   - It chooses a target object:
     - Prefer staged data (`this._stage`) when present.
     - Otherwise use main data (`this._data`).
   - It tests evaluation:
     - If evaluating the expression on staged or main data throws a `ReferenceError`, Sercrod falls back to the current scope object.
     - This allows bindings to work when the path only exists in the scope, not yet in the main data.

2. Initial data to UI:

   - Evaluate the expression to get `curVal`.
   - For different controls:
     - `INPUT`:
       - `type="checkbox"`:
         - If `curVal` is an array, the checkbox is checked when its `value` is included in that array (string comparison).
         - Otherwise, the checkbox is checked when `curVal` is truthy.
       - `type="radio"`:
         - After rendering, a `postApply` hook re-evaluates the bound expression and sets `checked` when the bound value equals the control’s `value`.
       - Other types:
         - `curVal` is passed through `model_out` (if defined), then normalized:
           - `null`, `undefined`, and `false` become an empty string.
         - The resulting string is assigned to `el.value`.
     - `TEXTAREA`:
       - Similar to text inputs:
         - `null` and `false` normalize to an empty string.
         - `model_out` (if defined) can transform the value before it is written.
     - `SELECT`:
       - For `multiple`:
         - Expects `curVal` as an array of values (strings after normalization).
         - A `postApply` hook selects all options whose value is contained in that array.
       - For single select:
         - Writes a string value, with `null` mapped to an empty string.

3. IME composition handling:

   - For text-like controls (`input` except checkbox/radio, and `textarea`), Sercrod tracks IME composition:
     - While composing (between `compositionstart` and `compositionend`), `input` events are ignored.
     - After composition ends, normal `input` handling resumes.

4. UI to data (input events):

   - For `input` (text-like) and `textarea`:
     - On each `input` event, if not composing:
       - Read `el.value` as `nextVal`.
       - Align numeric types:
         - If `type="number"`, convert to a number when possible, keeping empty string as empty.
         - Otherwise, if the current bound value is a number and the new value is not empty, try to parse a number.
       - Pass `nextVal` through `input_in` filter.
       - Assign the result back to the expression via `assign_expr`.
       - If there is no staged data:
         - If `*eager` is active, call `update()` on the host.
         - Otherwise, call `_updateChildren(...)` to update only the host’s descendants.

5. UI to data (change events):

   - For `change` on all relevant controls:
     - Compute `nextVal` depending on control type:
       - Checkbox:
         - If the bound value is an array, toggle membership of `el.value` in that array.
         - Otherwise, use `el.checked` as a boolean.
       - Radio:
         - If `el.checked`, use `el.value`.
       - Select:
         - For `multiple`, use an array of selected `option.value`.
         - Otherwise, use `el.value`.
       - Others:
         - Use `el.value`.
     - If the original bound value is a number (and `nextVal` is not empty and not an array), try to convert to number.
     - Pass `nextVal` through `input_in` and assign to the binding expression.
     - If there is no staged data:
       - If `*lazy` is active, update only the host’s children.
       - Otherwise, perform a full `update()` of the host.

6. Staged data:

   - When the host uses `*stage`, `*input` writes into `this._stage` instead of `this._data`.
   - Because the update logic checks `if (!this._stage)`, staged inputs do not trigger automatic re-rendering of the live view.
   - Applying or restoring the stage (for example via `*apply` / `*restore`) will drive the next visible update.


#### Variable creation and scope layering

`*input` does not create new variables in the template scope.

Scope behavior:

- The binding expression is evaluated against:
  - Staged data (`this._stage`) or main data (`this._data`) as primary scopes.
  - The current scope as fallback on certain reference errors.
- When writing, `assign_expr` operates on the chosen scope and can create missing path segments.
- All existing scope entries (such as `$data`, `$root`, `$parent`, and variables from `*let`) remain available but are not modified unless your `*input` expression explicitly targets them.

Guidelines:

- Prefer to bind to stable data paths derived from `data` on `<serc-rod>`.
- Avoid binding directly to transient local variables created by `*let` unless you understand the implications.


#### Parent access

`*input` does not provide its own parent helper, but you can target parent data explicitly:

- Use normal paths to reach parent data structures (`parentForm.name`, `wizard.steps[current].value`, and similar).
- Use `$root` and `$parent` inside expressions if you need to bind to root-level or parent-host data.

The binding still obeys the same assignment semantics: the expression is the left-hand side of an assignment inside the current scope.


#### Use with conditionals and loops

`*input` can be freely combined with conditional rendering and loops, as long as the rendered control remains a valid form element:

- With `*if`:

  ```html
  <label *if="form.enableName">
    Name:
    <input type="text" *input="form.name">
  </label>
  ```

  - When the condition becomes falsy, the input is removed from the DOM; when it becomes truthy again, the control is re-created and bound using the current data.

- With `*for`:

  ```html
  <serc-rod id="list" data='{
    "tags":["HTML","CSS","JavaScript"]
  }'>
    <ul>
      <li *for="tag of tags">
        <label>
          <input type="checkbox" *input="selectedTags" :value="tag">
          <span *print="tag"></span>
        </label>
      </li>
    </ul>

    <p>Selected: <span *print="selectedTags.join(', ')"></span></p>
  </serc-rod>
  ```

  - Here, `selectedTags` is expected to be an array.
  - Each checkbox toggles its tag inside that array.

- With `*each`:

  - `*input` works as expected inside bodies of `*each`, just like with `*for`.
  - The loop variables are visible to binding expressions.


#### Use with *stage, *lazy and *eager

`*input` is designed to integrate with staged editing and timing control directives.

- With `*stage`:

  ```html
  <serc-rod id="profile" data='{"profile":{"name":"Taro","email":"taro@example.com"}}'>
    <form *stage="'profile'">
      <label>
        Name:
        <input type="text" *input="profile.name">
      </label>

      <label>
        Email:
        <input type="email" *input="profile.email">
      </label>

      <button type="button" *apply="'profile'">Save</button>
      <button type="button" *restore="'profile'">Reset</button>
    </form>
  </serc-rod>
  ```

  - Inside the staged area, `profile` refers to staged data under `stage.profile`.
  - Inputs modify only the staged copy, not live data.
  - Applying or restoring the stage controls when the live data changes.

- With `*lazy`:

  - `*lazy` and `n-lazy` adjust how change-driven updates behave:
    - When active, change events (for example from checkbox, radio, select) update the data but trigger a lighter child-only update instead of a full host re-render.
    - The attribute can be used with or without a value:
      - `*lazy` or `*lazy=""` means “lazy is enabled”.
      - `*lazy="expr"` is evaluated; if the expression is truthy, lazy behavior is enabled.

- With `*eager`:

  - `*eager` and `n-eager` affect text-style inputs and textarea on `input` events:
    - When `*eager` is enabled, text changes cause a full `update()` of the host.
    - Without `*eager`, Sercrod only updates the host’s children, which can be cheaper.
  - Similar to `*lazy`, it can be:
    - Present as a bare attribute (`*eager`).
    - Or have an expression value (`*eager="expr"`) that decides whether eager behavior is active.

Project-level recommendation:

- Use `*eager` sparingly, only when the host needs to react immediately to every keystroke.
- Use `*lazy` when you want heavy recomputation to happen on change rather than on every adjustment, especially for checkboxes, radios, and selects.


#### Best practices

- Use simple, stable paths:

  - Favor expressions like `form.name` or `user.email`.
  - Avoid writing to very complex expressions; keep assignments intuitive.

- Initialize data types:

  - When you expect a number, initialize the bound value as a number or use `type="number"`.
  - When you expect a checkbox group, initialize the bound value as an array.
  - For multi-selects, also use arrays.

- Use filters for formatting and parsing:

  - Implement `Sercrod._filters.model_out` to format bound values before they appear in controls.
  - Implement `Sercrod._filters.input_in` to parse or validate input before storing it in data (for example trimming whitespace or coercing to domain-specific types).

- Combine with `*stage` for editing flows:

  - Wrap groups of inputs in staged sections when you need explicit “Save” / “Cancel” flows.
  - Let `*apply` and `*restore` control when staged values become live.

- Be mindful of update costs:

  - Use `*eager` only when necessary; eager updates can be expensive on large templates.
  - Use `*lazy` to limit full rerenders from frequently changing inputs.

- Treat `name` attributes as optional:

  - `*input` binds via its expression, not via `name`.
  - You can still use `name` for browser-level features (such as form submission), but the binding does not rely on it.


#### Additional examples

Checkbox bound to a boolean:

```html
<serc-rod id="flag" data='{"settings":{"enabled":true}}'>
  <label>
    <input type="checkbox" *input="settings.enabled">
    Enabled
  </label>

  <p>Status: <span *print="settings.enabled ? 'ON' : 'OFF'"></span></p>
</serc-rod>
```

Checkbox group bound to an array:

```html
<serc-rod id="colors" data='{"colors":["red","green","blue"],"selected":["red"]}'>
  <div *for="color of colors">
    <label>
      <input type="checkbox" *input="selected" :value="color">
      <span *print="color"></span>
    </label>
  </div>

  <p>Selected: <span *print="selected.join(', ')"></span></p>
</serc-rod>
```

Radio group bound to a single value:

```html
<serc-rod id="plan" data='{"plan":"basic"}'>
  <label>
    <input type="radio" name="plan" *input="plan" value="basic">
    Basic
  </label>
  <label>
    <input type="radio" name="plan" *input="plan" value="pro">
    Pro
  </label>

  <p>Current plan: <span *print="plan"></span></p>
</serc-rod>
```

Select with multiple:

```html
<serc-rod id="multi" data='{
  "allOptions":["A","B","C"],
  "chosen":["A","C"]
}'>
  <label>
    Choose:
    <select multiple *input="chosen">
      <option *for="opt of allOptions" :value="opt" *print="opt"></option>
    </select>
  </label>

  <p>Chosen: <span *print="chosen.join(', ')"></span></p>
</serc-rod>
```


#### Notes

- `*input` and `n-input` are aliases; choose one style and use it consistently.
- `*input` is designed for `<input>`, `<textarea>`, and `<select>`.
- The bound expression is treated as an assignment target; Sercrod will attempt to create missing intermediate objects when necessary.
- `*lazy` and `*eager` are optional helpers for tuning update timing; they do not change the core binding semantics.
- IME composition is respected for text-like fields, so partial compositions do not repeatedly overwrite data.
- As with other directives, `*input` follows Sercrod’s general rules for expressions, filters, and scope resolution; there are no special restrictions on combining it with other directives on the same element, as long as the result is still a well-formed form control.
