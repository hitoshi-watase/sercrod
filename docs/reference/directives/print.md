### *print

#### Summary

`*print` evaluates an expression and writes the result into the element as plain text by setting `textContent`.
The value is passed through Sercrod’s `text` filter and then rendered as a string, with `null`, `undefined`, and `false` treated as empty.
The alias `n-print` behaves the same and shares the same implementation.

Related low level variants:

- `*textContent` and `n-textContent` use the same code path as `*print` and `n-print`.
- All four directives end up assigning to `el.textContent` after applying the `text` filter.


#### Basic example

The simplest case, printing a single property from host data:

```html
<serc-rod id="app" data='{"name":"Alice"}'>
  <p *print="name"></p>
</serc-rod>
```

A simple greeting based on host data:

```html
<serc-rod id="app" data='{"user":{"name":"Alice"}}'>
  <p *print="`Hello, ${user.name}!`"></p>
</serc-rod>
```

At runtime:

- Sercrod evaluates `` `Hello, ${user.name}!` `` in the current scope.
- The result "Hello, Alice!" is given to the `text` filter.
- The `<p>` element’s `textContent` becomes `Hello, Alice!`.
- Any child nodes inside the original `<p>` template are ignored when `*print` is present.


#### Behavior

Core behavior of `*print` and `n-print`:

- Sercrod reads the expression from the attribute (`*print` or `n-print`).
- The expression string is optionally normalized by `normalizeTpl` if it is defined on the Sercrod class (otherwise it is used as is).
- The expression is evaluated with `eval_expr(expr, scope, { el: node, mode: "print" })` or `mode: "n-print"`.
- The result value `v` is normalized:

  - If `v` is `null`, `undefined`, or `false`, Sercrod treats it as an empty value.
  - For any other value, Sercrod uses it as is.

- The value is passed to `Sercrod._filters.text`:

  - Default `text` filter simply returns `String(raw ?? "")`.

- The final string is assigned to `el.textContent`.

Important details:

- Because `textContent` is used, any `<` or `>` characters in the value are treated as literal text by the browser. They do not become HTML markup.
- When `cleanup.directives` is enabled in the global config, Sercrod removes `*print`, `n-print`, `*textContent`, and `n-textContent` from the output DOM after rendering.
- On unexpected internal errors in this pass, the element’s `textContent` falls back to an empty string.


#### Value normalization and filters

The implementation normalizes values in two steps:

1. Expression result:

   - `v = eval_expr(...)`
   - If `v` is `null`, `undefined`, or `false`, it is treated as empty and replaced with "".
   - All other values (including `0`, `true`, and objects) are kept as `raw`.

2. Text filter:

   - The normalized `raw` value is passed to `this.constructor._filters.text(raw, { el, expr, scope })`.
   - Default `text` filter is:

     - `text: (raw, ctx) => String(raw ?? "")`

   - This means:
     - `null`, `undefined`, or `false` become "".
     - `0` becomes "0".
     - `true` becomes "true".
     - Objects become "[object Object]" unless you override the `text` filter.

You can override `Sercrod._filters.text` (or provide `window.__Sercrod_filter.text` before Sercrod is loaded) to change how `*print` and `*textContent` values are normalized.
The same `text` filter is also used by the fallback path that renders `%expr%` text expansions into plain text.


#### Evaluation timing

`*print` is a non structural directive.
It is handled in the per element rendering stage after structural directives and before child nodes are rendered.

More precisely:

- Structural directives such as `*if`, `*elseif`, `*else`, `*for`, `*each`, `*switch`, and `*let` are processed in `renderNode`.
  - They may clone or skip the element before `_renderElement` is called.
  - If a structural directive decides that the element should be skipped, `_renderElement` is never reached and `*print` never runs.
- Only when none of the structural branches take over, Sercrod calls `_renderElement(node, scope, parent)`.

Inside `_renderElement`:

- The `*print` / `n-print` / `*textContent` / `n-textContent` block runs before:
  - `%expr%` text expansions on the element as a whole.
  - Recursing into child nodes.

As a result:

- When `*print` or `n-print` is present, the element is rendered as a plain text node and its children are not processed.
- Other text modes on that element, such as `%expr%` expansion on the same element, are skipped because `*print` short circuits the rendering of children.


#### Execution model

Conceptually, the runtime behaves as follows for `*print` and `n-print`:

1. Detect directive:

   - If the element has `*print` or `n-print` or `*textContent` or `n-textContent`, Sercrod enters the text assignment path.

2. Choose the active attribute:

   - Priority is:

     - `*print`
     - `n-print`
     - `*textContent`
     - `n-textContent`

   - The first one that exists on the element provides the expression string.

3. Prepare the expression:

   - Read the raw attribute value.
   - If `normalizeTpl` exists on the Sercrod class, pass the expression string through it.
   - Otherwise use the original string.

4. Evaluate:

   - Run `eval_expr` with the current effective scope and the element as context.
   - If `eval_expr` fails internally, it logs a warning with `mode:"print"` or "textContent" and returns `false`.

5. Normalize and filter:

   - Map `null`, `undefined`, and `false` to "".
   - Pass the result to the `text` filter with `{ el, expr, scope }`.

6. Assign:

   - Set `el.textContent` to the filtered string.

7. Cleanup and append:

   - Optionally remove `*print`, `n-print`, `*textContent`, and `n-textContent` from the element if `cleanup.directives` is enabled.
   - Append the element to its parent.
   - Return from `_renderElement` without rendering child nodes.

For `*textContent` and `n-textContent`, the same steps are taken, except that `mode` is "textContent" or "n-textContent" for logging purposes.
Functionally they are equivalent to `*print` and `n-print` in the current implementation.


#### Variable creation

`*print` does not create any new variables.

- It only reads from the current effective scope.
- Any variables available in expressions come from:

  - Host data (`data="..."` or `data={...}` on `<serc-rod>`).
  - Variables introduced by `*let` or `n-let` on this element or ancestors.
  - Variables introduced by loops, such as `item` in `*for="item of items"` or `*each="item of items"`.
  - Special helper variables injected by `eval_expr`:
    - `$data` for the host data object.
    - `$root` for the root Sercrod host’s data.
    - `$parent` for the nearest ancestor Sercrod host’s data.
  - Functions and methods injected via `*methods` and internal helper methods.

The expression on `*print` is evaluated in exactly the same environment as other expression based directives.


#### Scope layering

`*print` uses the same scope that is effective at the point where the element is rendered.

- Structural directives such as `*let` and `*for` may replace or extend the scope before `_renderElement` is called.
- For a typical pattern:

  ```html
  <ul *for="item of items">
    <li *print="item.label"></li>
  </ul>
  ```

  - The `*for` directive creates a per iteration scope with `item` bound.
  - `_renderElement` is called on each `<li>` with that scope.
  - `*print="item.label"` reads `item` from the per iteration scope.

`*print` itself does not change or wrap the scope; it only reads from it.


#### Parent access

Because `*print` uses `eval_expr`, it supports the usual Sercrod special variables for accessing parent data:

- `$data` refers to the data of the current Sercrod host.
- `$root` refers to the data of the root Sercrod host.
- `$parent` refers to the data of the nearest ancestor Sercrod host.

Examples:

```html
<serc-rod id="app" data='{"title":"Dashboard","user":{"name":"Alice"}}'>
  <header>
    <h1 *print="$data.title"></h1>
    <p *print="`Signed in as ${$data.user.name}`"></p>
  </header>
</serc-rod>
```

In nested hosts, you can use `$parent` or `$root` when the inner host wants to display some outer header information inside a `*print` expression.


#### Use with conditionals and loops

`*print` is often used inside elements that are controlled by `*if`, `*for`, or `*each`.

- With `*if` on the same element:

  ```html
  <p *if="user" *print="user.name"></p>
  ```

  - The `*if` chain is processed in `renderNode`.
  - If the condition is falsy, the element is not rendered and `*print` never runs.
  - If the condition is truthy, `_renderElement` is called on the element, and `*print` renders the name.

- Inside `*for`:

  ```html
  <ul>
    <li *for="item of items">
      <span *print="item.label"></span>
    </li>
  </ul>
  ```

  - `*for` clones `<li>` for each `item`.
  - `*print` renders the label within each clone.

- Inside `*each`:

  ```html
  <table>
    <tbody *each="row of rows">
      <tr>
        <td *print="row.id"></td>
        <td *print="row.name"></td>
      </tr>
    </tbody>
  </table>
  ```

  - `*each` repeats the `<tbody>` children for each `row`.
  - `*print` displays fields from `row` in each cell.

There is no special interaction with loops beyond using the scope that loops provide.


#### Comparison with text interpolation (%expr%)

Sercrod supports `%expr%` style text interpolation inside plain text nodes using the configured delimiters.
By default the delimiters are `%` and `%`, and interpolation is implemented by `_expand_text`.

Key differences between `*print` and `%expr%`:

- Where the expression lives:

  - `*print` uses an attribute expression.
  - `%expr%` syntax uses inline expressions inside text content.

- Filter used:

  - `*print` and `*textContent` use the `text` filter.
  - `%expr%` expansions are combined with the `placeholder` filter.

- How the element is rendered:

  - `*print` replaces the entire content of the element and prevents child rendering.
  - `%expr%` runs only when:
    - There is no `*print`, `n-print`, `*textContent`, or `n-textContent` on the element.
    - The text node (or single text child) contains the delimiters.

Example with `%expr%` only:

```html
<serc-rod id="app" data='{"user":{"name":"Alice"}}'>
  <p>Hello, %user.name%!</p>
</serc-rod>
```

Example with `*print` taking precedence:

```html
<serc-rod id="app" data='{"user":{"name":"Alice"}}'>
  <p *print="`Hello, ${user.name}!`">
    This inner text, including %user.name%, is ignored.
  </p>
</serc-rod>
```

In this second case:

- `*print` runs, sets `textContent` from the expression, and skips child rendering.
- The inline `%user.name%` inside the children is never evaluated.


#### Related directives: *textContent and *innerHTML

- `*textContent` and `n-textContent`:

  - Use the same pipeline as `*print` and `n-print`.
  - They are logically equivalent in the current implementation, differing mainly in naming and the `mode` label passed to `eval_expr`.
  - All four are handled by the same code branch that assigns to `el.textContent`.

- `*innerHTML` and `n-innerHTML`:

  - Are separate directives that assign to `el.innerHTML`.
  - They pass the raw value through the `html` filter instead of `text`.
  - They do not use the `text` filter and are intended for inserting HTML strings.
  - When you want to insert HTML markup rather than text, use `*innerHTML` and provide a suitable `html` filter.

Combination rules and caveats:

- On a single element, you should not rely on combining `*print` or `*textContent` with `*innerHTML` or `n-innerHTML`.

  - If both `*print` and `*textContent` are present, only the first one in the internal priority order is used.
  - If `*print` or `*textContent` is present, the `*innerHTML` block on the same element is skipped, because `*print` short circuits child rendering.
  - Although the attributes can be written in HTML, only one text or HTML mode will effectively control the element.

To keep behavior predictable, treat `*print`, `*textContent`, `*innerHTML`, and `n-innerHTML` as mutually exclusive on a single element and choose one per element.


#### Best practices

- Use `*print` for text only content:

  - When an element is meant to show only an expression result, prefer `*print` instead of mixing static text and `%expr%`.
  - Example: badges, counters, titles that are entirely dynamic.

- Use `%expr%` for small inline substitutions:

  - When the text is mostly static and you want a few interpolated pieces, prefer `%expr%` inside a text node.
  - Example: Hello, %user.name% (id: %user.id%).

- Do not rely on children with `*print`:

  - When `*print` or `n-print` is present, children are not rendered.
  - Avoid putting important markup or directives inside the element body if you also use `*print`.

- Do not mix `*print` and `*innerHTML` on the same element:

  - Only one set of semantics will effectively apply.
  - If you need both plain text and HTML portions, split them into separate child elements.

- Remember the `text` filter:

  - If you need custom normalization (for example trimming whitespace or mapping specific values), override `Sercrod._filters.text`.
  - Keep in mind that this affects all uses of `*print` and `*textContent` as well as the fallback `%expr%` text expansion path that uses the same basic stringification rules.

- Prefer simple expressions:

  - For maintainability, keep `*print` expressions short.
  - For complex formatting, move the logic into a helper function and call that function from `*print`.


#### Additional examples

Display a number with a suffix:

```html
<serc-rod id="counter" data='{"count": 42}'>
  <p *print="`${count} items`"></p>
</serc-rod>
```

Fallback for missing values:

```html
<serc-rod id="app" data='{"user":{}}'>
  <p *print="user.name || 'Anonymous'"></p>
</serc-rod>
```

Using methods:

Assume `window.formatUser` is a function that returns a display name.

```js
function formatUser(user) {
  return user && user.name ? `User: ${user.name}` : "Guest";
}
```

```html
<serc-rod id="app" data='{"user":{"name":"Alice"}}' *methods="formatUser">
  <p *print="formatUser(user)"></p>
</serc-rod>
```

The `*methods="formatUser"` directive makes `formatUser` available in the expression scope for `*print` and other directives.


#### Notes

- `*print` and `n-print` share the same manual entry in `*man`.
- `*print` is implemented as a non structural directive inside `_renderElement` and does not affect layout or siblings beyond replacing the element’s text content.
- `*textContent` and `n-textContent` are currently implemented with the same behavior as `*print` and `n-print`, using the same value normalization and `text` filter.
- Behavior described here is based on the current `sercrod.js` implementation and may evolve if the text or HTML filters are customized through the official extension points.
