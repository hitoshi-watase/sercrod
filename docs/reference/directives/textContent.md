### *textContent

#### Summary

`*textContent` sets the DOM `textContent` property of an element from an expression.
It is a text-oriented directive, similar in spirit to `*print`, and is paired with the alias `n-textContent`.

Use `*textContent` when you want to explicitly bind an expression to an element’s `textContent`, ignoring any static child markup.


#### Basic example

Simple binding to a message:

```html
<serc-rod id="app" data='{"message":"Hello Sercrod"}'>
  <p *textContent="message"></p>
</serc-rod>
```

Behavior:

- The `<p>` element is rendered.
- Sercrod evaluates `message` in the current scope.
- The result is converted to text via the `text` filter and assigned to `p.textContent`.
- Any static children of `<p>` in the template are not rendered; `textContent` completely replaces them.


#### Behavior

- `*textContent` is a one-way text binding from data to the DOM.
- It assigns the stringified result of an expression to the element’s `textContent` property.
- The directive is evaluated once per render of the element (and again on re-renders triggered by data updates).
- The alias `n-textContent` behaves the same as `*textContent`; only the attribute name differs.

Short manual entry (built into Sercrod):

- `textContent`: set the DOM `textContent` property from an expression.
- Example: `<div *textContent="message"></div>`


#### Expression evaluation

When Sercrod encounters an element with `*textContent` or `n-textContent`:

- It chooses a “source attribute” in this priority:

  1. `*print`
  2. `n-print`
  3. `*textContent`
  4. `n-textContent`

- Only the first attribute in this list is actually used.
  - If `*print` or `n-print` is present, the `*textContent` / `n-textContent` expression is ignored.
  - This makes mixing these attributes on the same element pointless; you should choose one.

- Once the source attribute is chosen:

  - Sercrod reads its value as an expression string.
  - If a bundler-specific `normalizeTpl` hook is available, it normalizes the expression string.
  - It evaluates the expression with `eval_expr(expr, scope, { el: node, mode: "textContent" })` for `*textContent`, or with a corresponding mode for `n-textContent`.
  - The raw evaluation result `v` is mapped to a “raw text” value:

    - If `v` is `null` or `false`, the raw text becomes the empty string `""`.
    - For any other value, the raw text is `v` as-is and will be converted to a string later.

  - The raw text is passed through the `text` filter:

    - `Sercrod._filters.text(raw, { el, expr, scope })`
    - By default, the filter is defined as `String(raw ?? "")`.
    - Projects can override this filter to change how textual values are produced (for example, to clamp length or apply additional formatting).

  - The final string is assigned to `el.textContent`.

Error handling:

- If expression evaluation or filtering throws, Sercrod falls back to:

  - `el.textContent = ""`.

Cleanup:

- If `this.constructor._config.cleanup.directives` is enabled, Sercrod removes the directive attributes from the rendered element:

  - `*print`
  - `n-print`
  - `*textContent`
  - `n-textContent`

- This keeps the output DOM clean, leaving only the resulting text content.


#### Evaluation timing

`*textContent` is not a structural directive; it runs after the structural layer for an element has succeeded.

Rough evaluation order for a given element:

1. Structural checks on the template node (host):

   - `*if` / `n-if`, `*elseif` / `*else`, `*switch` / `n-switch`, `*each` / `n-each`, `*for` / `n-for`, and similar control directives run at higher stages.
   - If a structural directive decides to drop or replace the element, `*textContent` does not run.

2. Sercrod host checks and other element-level decisions.

3. Rendering of a concrete DOM element (`el`) for this template node.

4. Text directives:

   - If the element has `*print`, `n-print`, `*textContent`, or `n-textContent`, the combined branch for “print/textContent” is executed.
   - That branch sets `el.textContent` and appends `el` to the parent.
   - After this branch returns, Sercrod does not recurse into children and does not process other content directives for this element.

5. Fallback text handling:

   - If there is no text directive, but the element has exactly one static text child, Sercrod may:
     - Copy the text verbatim, or
     - Expand `%expr%` placeholders via `_expand_text`, then assign the result to `textContent`.

6. Other content directives:

   - Only when no text directive and no simple static-text optimization applies, Sercrod proceeds to check `*compose` / `n-compose`, `*innerHTML` / `n-innerHTML`, and so on.

Important consequence:

- As soon as `*textContent` (or `*print`) is present, that directive “wins” the content for the element:
  - Child nodes are not rendered.
  - `%expr%` inline expansions in static text are not used.
  - `*compose` / `*innerHTML` are never reached for that element.


#### Execution model

The execution model for `*textContent` on one element can be summarized as:

1. Sercrod creates a new DOM element `el` corresponding to the template node.

2. It detects whether the element has any text directive:

   - `*print`, `n-print`, `*textContent`, `n-textContent`.

3. If so:

   - It chooses the source attribute (with `*print` > `n-print` > `*textContent` > `n-textContent` priority).
   - It evaluates the expression and passes the result through the `text` filter.
   - It sets `el.textContent` to the filtered string.
   - It optionally removes the directive attributes from `el` depending on the cleanup configuration.
   - It appends `el` to the parent.
   - It returns early; no children are rendered and no other content directives are considered.

4. If not:

   - The renderer falls back to static text or child-node rendering paths.

Combined with reactivity:

- When data changes and triggers an update, the containing Sercrod host re-renders, repeating the same process.
- `*textContent` expressions are re-evaluated in the new scope, and the new `textContent` is applied.


#### Variable creation and scope layering

`*textContent` does not create any new variables in the scope.

Inside the expression:

- You can use all normal scope variables:

  - Fields from the host data.
  - Loop variables from surrounding `*for` / `*each`.
  - Temporary variables from `*let`.
  - Special helpers injected by Sercrod such as `$data`, `$root`, and `$parent`.

Scope behavior:

- The expression for `*textContent` is evaluated in the “effective scope” for this element.
- The directive itself does not alter dynamic scope; it only reads from it.
- Assigning to variables inside the expression (for example, `x = x + 1`) is not the purpose of `*textContent` and should be avoided; use `*let`, `*global`, or explicit methods instead when you need side effects.


#### Parent access

`*textContent` has no special concept of “parent data” beyond what Sercrod already supplies:

- `$parent` gives the nearest ancestor Sercrod host’s data.
- `$root` gives the outermost Sercrod host’s data.
- Normal lexical names refer to the current element’s scope, including any loop or `*let` variables.

Typical usage:

```html
<serc-rod id="todo" data='{"items":[{"title":"Buy milk"}]}'>
  <ul *each="item of items">
    <li *textContent="item.title"></li>
  </ul>
</serc-rod>
```

Here, `item` is introduced by `*each`, and `*textContent` simply reads it.


#### Use with conditionals and loops

`*textContent` works well inside structural directives:

- With `*if`:

  ```html
  <p *if="user" *textContent="user.name"></p>
  ```

  - `*if` runs first; if `user` is falsy, the `<p>` is not rendered and `*textContent` never runs.
  - If `user` is truthy, the `<p>` is created and `*textContent` sets `textContent`.

- With `*each`:

  ```html
  <ul *each="item of items">
    <li *textContent="item.label"></li>
  </ul>
  ```

  - `*each` decides the number of iterations.
  - For each iteration, `*textContent` runs on the `<li>` clone in that iteration’s scope.

- With `*for`:

  ```html
  <ul>
    <li *for="item of items" *textContent="item.label"></li>
  </ul>
  ```

  - `*for` repeats the `<li>` element itself.
  - `*textContent` sets the `textContent` for each repeated `<li>`.

In all cases:

- Structural directives determine whether and how many elements exist.
- `*textContent` controls what text each existing element displays.


#### Interaction with other content directives

`*textContent` participates in the same “content choice” layer as `*print`, and it precedes other content directives:

- `*print` vs `*textContent`:

  - Both share the same implementation branch.
  - If both are present on the same element, `*print` (or `n-print`) is used and `*textContent` (or `n-textContent`) is ignored.
  - This is a defined implementation detail but not a useful pattern; in practice, you should choose one directive.
  - If you want to emphasize DOM property semantics, use `*textContent`; if you prefer “printing” semantics, use `*print`.

- `*textContent` vs `*innerHTML` / `*compose`:

  - The `*print` / `*textContent` branch runs before the `*compose` / `*innerHTML` branch.
  - If an element has both `*textContent` and `*innerHTML` (or `*compose`), `*textContent` wins:
    - The element’s `textContent` is set from the expression.
    - The branch for `*innerHTML` / `*compose` is never reached.
  - Combining these directives on the same element therefore has no useful effect; you should choose one.

- Static `%expr%` expansion:

  - When no text directive is present, Sercrod can expand inline `%expr%` placeholders in a single text node and assign the result to `textContent`.
  - As soon as `*textContent` is present, this static expansion is skipped, because the directive takes full control of `textContent`.

Recommendation:

- Treat `*textContent` as the unique controller of `textContent` for that element.
- Avoid putting multiple content-directing attributes (`*print`, `*textContent`, `*innerHTML`, `*compose`) on the same element, because only one branch will be effective.


#### Best practices

- Keep expressions side-effect free:

  - `*textContent` is meant for pure formatting; side effects (mutating data) inside the expression make templates harder to reason about.

- Pre-format complex text outside the template:

  - If you need heavy formatting (e.g. date/time, unit conversion, localization), consider computing those values in data or via helper methods instead of embedding long expressions.

- Use filters for cross-cutting concerns:

  - If you need to sanitize or normalize text globally, override `Sercrod._filters.text` in your application.
  - This way, all `*textContent` and `*print` bindings automatically receive the same treatment.

- Do not rely on attribute priority as a “feature”:

  - While the runtime clearly prioritizes `*print` over `*textContent`, this is an implementation detail mostly meant to keep behavior predictable when templates accidentally mix them.
  - In real templates, choose exactly one directive per element to express intent.

- Use `*textContent` when you want a clear “property binding” feel:

  - For readers familiar with the DOM, `*textContent` makes it explicit that the element’s `textContent` property is controlled by the expression.


#### Additional examples

Using `*textContent` with derived values:

```html
<serc-rod id="price" data='{"price": 1200, "currency":"JPY"}'>
  <span *textContent="price + ' ' + currency"></span>
</serc-rod>
```

Inside a list with conditional prefix:

```html
<serc-rod id="messages" data='{
  "messages": [
    { "important": true,  "text": "System update required" },
    { "important": false, "text": "Daily backup completed" }
  ]
}'>
  <ul *each="msg of messages">
    <li *textContent="(msg.important ? '[!] ' : '') + msg.text"></li>
  </ul>
</serc-rod>
```


#### Notes

- `*textContent` and `n-textContent` are aliases; they share the same implementation and differ only in attribute name.
- The directive is implemented strictly in terms of `textContent`:
  - No HTML parsing is performed.
  - All text is treated as plain text and will be escaped by the browser when rendered.
- Both `*textContent` and `*print` use the global `text` filter for final string conversion.
- When multiple content directives are present on a single element, the renderer chooses one branch (with `*print` > `n-print` > `*textContent` > `n-textContent` priority) and ignores the rest; this is defined behavior but discouraged in template design.
- `*textContent` does not interact with network features (`*post`, `*fetch`, `*websocket`, and others); it is purely about local text rendering for a single element.
