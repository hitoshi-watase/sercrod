### Attribute bindings (fallback for :name)

#### Summary

This page describes the general behavior of Sercrod’s attribute bindings that **do not** have their own dedicated manual.

Any attribute whose name starts with `:` (for example `:title`, `:aria-label`, `:data-id`) participates in this mechanism.
The expression to the right of `=` is evaluated, and the result is mapped to a plain HTML attribute on the rendered element.

Typical examples that use this fallback:

- `:title`
- `:aria-label`, `:aria-current`, `:aria-describedby`, `:aria-*`
- `:data-id`, `:data-status`, `:data-role`, `:data-*`
- `:role`
- `:tabindex`
- other custom attributes (`:data-*`, `:foo-bar`, and so on)

Attributes such as:

- `:class`
- `:style`
- `:value`
- `:href`
- `:src`
- `:action`
- `:formaction`
- `:xlink:href`
- `:disabled`
- `:readonly`
- `:checked`

have (or may have) their own dedicated manuals that describe additional details.
However, they still share the generic evaluation pipeline described here.

Reserved keys:

- `:text` and `:html` are reserved for text/HTML bindings and are **explicitly skipped** by this fallback.
  They are not processed here and are handled separately (or may be unimplemented in this version).


#### Basic example

A typical use of fallback attribute bindings:

```html
<serc-rod id="user-card" data='{
  "user": {
    "id": "u-123",
    "name": "Alice",
    "role": "admin",
    "active": true
  }
}'>
  <div
    :data-id="user.id"
    :aria-label="user.name"
    :role="user.role"
    :tabindex="user.active ? 0 : -1"
  >
    <span *print="user.name"></span>
  </div>
</serc-rod>
```

Behavior:

- All attributes beginning with `:` are evaluated against the current scope.
- When the expression produces a value, the underlying attribute name is the part after the colon (for example `data-id`, `aria-label`).
- Falsy and boolean results map to attributes in a predictable way (explained below).
- The `*print` directive controls the content; `:data-*`, `:aria-*`, `:role`, and `:tabindex` control accessibility and behavior.


#### Behavior

At render time, Sercrod scans each element for attributes that start with `:`:

- For each `:name="expr"`:

  - Sercrod evaluates `expr` in the current scope.
  - The result is mapped to the underlying attribute name `name` (for example `title`, `aria-label`, `data-id`).
  - The scope is never modified by attribute bindings; they are pure read operations.

Attribute name:

- The underlying attribute name is the attribute name without the leading `:`.
- For example:

  - `:title="expr"` → `title` attribute.
  - `:data-id="expr"` → `data-id` attribute.
  - `:aria-label="expr"` → `aria-label` attribute.

Special cases in the fallback pipeline:

- `:class` and `:style` have dedicated logic for combining strings, arrays, and objects.
- `:value` interacts with form controls and assigns to both `el.value` and the `value` attribute.
- URL-like attributes (`:href`, `:src`, `:action`, `:formaction`, `:xlink:href`) are passed through a URL filter hook for safety.
- All other attribute names share the generic rules described in the next section.

Reserved and excluded:

- `:text` and `:html` are explicitly skipped by the fallback implementation and are not handled here.
  They are reserved for text/HTML bindings.


#### Value mapping

The generic fallback follows a small set of rules to decide how to apply values:

- The expression is evaluated once for each render, with context `{ el, scope, mode: "attr:name" }`, where `name` is the attribute name without `:`.

For non-special attribute names (everything except `class`, `style`, `value` and the URL-like list):

- If the evaluated value is `false`, `null`, or `undefined`:

  - The attribute is **removed** from the element (as if it had never been set).

- If the evaluated value is `true`:

  - The attribute is created and set to an empty string (`""`).
  - This matches the common HTML convention for boolean attributes.

- For any other non-null, non-false value:

  - The value is passed through the attribute filter hook.
  - The final string (or boolean) returned by the filter is converted into a real HTML attribute.

For URL-like attributes:

- When the attribute name is one of:

  - `href`
  - `src`
  - `action`
  - `formaction`
  - `xlink:href`

- The raw string is passed to the URL filter hook.
- Only if the filter returns a truthy string is the attribute set.
- Otherwise, the attribute is not written, even if the original expression returned a value.

For `:value` on form controls:

- When the underlying attribute name is `value` and the element is an `INPUT`, `SELECT`, `TEXTAREA`, or `OPTION`:

  - The fallback not only sets the `value` attribute, but also assigns to `el.value = String(val)`.
  - This keeps the DOM property and attribute in sync on the rendered element.


#### Filters and customization

Attribute bindings use the following hooks on the `Sercrod` class:

- `Sercrod._filters.url(raw, attrName, ctx)`:

  - Used for URL-like attributes (`href`, `src`, `action`, `formaction`, `xlink:href`).
  - By default, it just returns the raw string.
  - Projects can override it to sanitize or rewrite URLs.

- `Sercrod._filters.attr(name, value, ctx)`:

  - Used for all other attributes that go through the generic path.
  - By default, it returns `{ name, value }`.
  - Projects can override it to:
    - Rename attributes.
    - Normalize boolean flags.
    - Drop disallowed attributes by returning `null` or `{ name, value: null }`.

The fallback implementation behaves like this after the filter:

- If the filter returns `null` or `undefined`, the attribute is not written.
- If the filter returns an object `{ name, value }` and `value` is `null` or `undefined`, the attribute is not written.
- If `value` is exactly `true`, a boolean-style attribute is written with an empty string.
- Otherwise, the attribute with name `name` is set to `String(value)`.


#### Error handling

If evaluation of the attribute expression throws an error:

- For `:class`:

  - The element’s `className` is set to an empty string.

- For `:style`:

  - The element’s inline `style` is cleared (`cssText = ""`).

- For other attributes:

  - A “safe default” attribute is written with an empty string value.

This behavior ensures that failures during attribute evaluation do not break the render process; instead, the element falls back to a neutral state.


#### Evaluation timing

Attribute bindings run as part of `_renderElement`, after structural directives have decided whether the element will be rendered.

In broad order:

1. Structural directives (`*if`, `*for`, `*each`, `*switch`, `*template`, `*include`, and similar) decide:

   - Whether the element is rendered at all.
   - How many copies (if any) are created.
   - Which children will be present.

2. For each concrete element being rendered, Sercrod evaluates attribute bindings:

   - `:class`, `:style`, `:value`, and all other `:name` attributes (except `:text` / `:html`) are processed.
   - Each attribute is evaluated once for the current scope.

3. Event bindings and other element-level behaviors are attached.

4. Text content, `%expr%` expansions, inner HTML, and children are rendered.

Implications:

- Attribute bindings do not run for elements that were removed by `*if`, `*switch`, or other structural directives.
- For elements generated by `*for` or `*each`, the bindings are evaluated once per iteration, with the iteration’s scope.


#### Execution model

For the fallback path, you can think of `:name="expr"` as:

1. **Parse**:

   - Collect attributes whose names start with `:` on the template node.
   - For each attribute, compute `name = attr.name.slice(1)`.

2. **Evaluate**:

   - Evaluate `expr` using the current scope with a context `{ el: templateNode, mode: "attr:"+name }`.

3. **Apply**:

   - If `name === "class"`:
     - Use the class-specific rules (string, array, object).
   - Else if `name === "style"`:
     - Use the style-specific rule and `Sercrod._filters.style`.
   - Else if `name === "value"` and the element is a form control:
     - Assign to both `el.value` and the `value` attribute.
   - Else if `name` is URL-like:
     - Pass through `Sercrod._filters.url`.
   - Otherwise:
     - Pass through `Sercrod._filters.attr` and set or remove the attribute accordingly.

4. **Cleanup (optional)**:

   - If the runtime is configured with `cleanup.handlers = true`, the original `:name` attributes are removed from the output DOM.


#### Variable creation and scope layering

Attribute bindings **do not** create any new variables.

- The expression on a `:name` attribute sees the same scope as any other Sercrod expression on that element.
- No new loop variables, aliases, or helpers are introduced.
- The scope is never mutated by attribute bindings; they always read from data, never write back to it.

Available inside the expression:

- The data bound to the surrounding Sercrod host (`data` or any other root object).
- Special helpers:

  - `$data` - the current host’s data.
  - `$root` - the top-level host’s data.
  - `$parent` - the nearest ancestor host’s data.

- Methods and helpers injected by `*methods` or related configuration.


#### Parent access

Attribute expressions can freely refer to outer data:

- `:title="$root.appTitle"` to reference root-level data.
- `:data-parent-id="$parent.id"` to reflect an ancestor’s identifier.
- `:aria-label="user.name + ' (' + parentLabel + ')'"` if `parentLabel` is part of the scope.

The fallback implementation does not alter how scope resolution works; it simply evaluates the expression under the usual rules.


#### Use with conditionals and loops

Attribute bindings are compatible with conditionals and loops:

- With `*if`:

  - The `*if` gate runs before attributes are evaluated.
  - If `*if` is falsy, the element and its attributes are not rendered.

- With `*for`:

  - Each repeated instance of the element gets its attributes evaluated in its own per-iteration scope.

  ```html
  <ul>
    <li
      *for="user of users"
      :data-id="user.id"
      :aria-label="user.name"
    >
      <span *print="user.name"></span>
    </li>
  </ul>
  ```

- With `*each`:

  - If `*each` is on a container, the container’s attributes are evaluated once.
  - Attributes on child elements inside the loop body are evaluated for each iteration.

  ```html
  <table>
    <tbody *each="row of rows">
      <tr :data-row-id="row.id">
        <td *print="row.name"></td>
      </tr>
    </tbody>
  </table>
  ```

As a rule of thumb:

- Structural directives (`*if`, `*for`, `*each`, `*switch`) decide *which* elements exist.
- Attribute bindings decide *what attributes those existing elements have*.


#### Best practices

- Prefer specific manuals when available:

  - For `:class`, `:style`, `:value`, `:href`, `:src`, `:action`, `:formaction`, `:xlink:href`, `:disabled`, `:readonly`, `:checked`, consult their dedicated pages for additional details.

- Keep expressions simple:

  - Attribute expressions should focus on shaping the attribute’s final value.
  - Complex computation is often better performed in data or helper methods.

- Use booleans for boolean-like attributes:

  - Write `:disabled="form.submitting"` instead of `:disabled="form.submitting ? true : false"`.
  - The fallback will remove the attribute when the value is falsy and create it otherwise.

- Be explicit with `:data-*` and `:aria-*`:

  - These attributes are ideal for accessibility and automation hooks.
  - Use clear names like `:data-test-id`, `:aria-label`, and `:aria-describedby` to make intent obvious.

- Avoid mixing multiple notations for the same attribute on one element:

  - For example, combining `:class` with `*class` or `n-class` is technically possible, but the last one applied wins and may overwrite the others.
  - As a best practice, stick to **one** class-binding style per element (`:class` *or* `*class` / `n-class`, not both).


#### Examples

Using `:aria-*` and `:data-*` for accessibility and diagnostics:

```html
<serc-rod id="menu" data='{
  "items": [
    { "id": "home", "label": "Home", "active": true },
    { "id": "settings", "label": "Settings", "active": false }
  ]
}'>
  <nav aria-label="Main menu">
    <ul>
      <li
        *for="item of items"
        :data-id="item.id"
        :aria-current="item.active ? 'page' : null"
        :tabindex="item.active ? 0 : -1"
      >
        <button
          type="button"
          :aria-pressed="item.active"
        >
          <span *print="item.label"></span>
        </button>
      </li>
    </ul>
  </nav>
</serc-rod>
```

Using `:role` and `:data-*` together:

```html
<div
  :role="isDialogOpen ? 'dialog' : null"
  :data-state="isDialogOpen ? 'open' : 'closed'"
>
  <p *print="message"></p>
</div>
```

In these examples:

- Falsy results (`null`, `false`) remove the attribute.
- Truthy non-boolean values are converted to strings.
- Boolean `true` produces a boolean-style attribute with an empty string when passed through the generic filter.


#### Notes

- Fallback attribute bindings are one-way: they read from data and write to the DOM, but never modify data.
- URL-like attributes are always routed through the URL filter hook before being applied.
- The `cleanup.handlers` configuration controls whether the `:name` attributes themselves are removed from the output DOM.
- `:text` and `:html` are reserved keys and explicitly skipped by this fallback implementation; they are not covered by this page.
- When a dedicated manual exists for a specific attribute binding, treat that manual as the primary source; this page describes the shared baseline behavior for all `:name` attributes.
