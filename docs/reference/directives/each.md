### *each

#### Summary

`*each` repeats the children of a single host element for each entry in a list, object, or other iterable.
The host element itself is rendered exactly once and acts as a container.
The directive understands JavaScript-like `in` and `of` loop syntax and has an alias `n-each`.

Use `*each` when you want one structural wrapper (such as `<ul>`, `<tbody>`, or `<div>`) whose contents are repeated.

Important restriction:

- A single element must not combine `*each` with `*include` or `*import`.  
  These structural directives all want to control the host’s children, so they are not allowed on the same element.


#### Basic example

A simple list:

```html
<serc-rod id="app" data='{"items":["Apple","Banana","Cherry"]}'>
  <ul *each="item of items">
    <li *print="item"></li>
  </ul>
</serc-rod>
```

Behavior:

- `<ul>` is rendered once.
- `*each="item of items"` iterates the array.
- For each item, Sercrod renders the original `<li>` subtree with a local variable `item` bound to the current value.
- The result is a single `<ul>` containing three `<li>` elements.


#### Behavior

- `*each` is a structural directive that controls how many times the original child nodes are rendered.
- The host element is cloned once as a container; its original children are used as a template for each iteration.
- The expression on `*each` is evaluated once per render of the host.
- Inside each iteration, Sercrod renders the original children with an iteration-specific scope.

Alias:

- `*each` and `n-each` are aliases. They accept the same syntax and behave identically.


#### Expression syntax

The expression to the right of `*each` uses a restricted, JS-like loop syntax:

- `value of iterable`
- `(key, value) of iterable`
- `key in object`

`key` and `value` must be simple identifiers (no destructuring or complex patterns).

Supported and recommended patterns:

- Array values:

  - `item of items`  
    Iterates an array, binding `item` to each element.

  - `(index, item) of items`  
    Iterates an array, binding `index` to the numeric index and `item` to the element.

- Object values:

  - `key in obj`  
    Iterates over the enumerable keys of `obj`, binding `key` to each property name.

  - `(key, value) of obj`  
    Iterates over `Object.entries(obj)`, binding `key` to the property name and `value` to the value.

Collection evaluation:

- The right-hand side is evaluated as a normal Sercrod expression.
- If the expression returns a falsy value (such as `null`, `undefined`, `false`, `0`, or an empty string), `*each` treats it as an empty collection and renders nothing.
- Arrays and plain objects are the primary targets; other iterables may work but are not the main focus.


#### Value semantics

For `modeWord = "of"`:

- `item of items`:

  - If `items` is an array, each iteration sees `item` as one element of the array.
  - If `items` is a non-null, non-array object, `*each` iterates `Object.values(items)`, so `item` is each value.

- `(index, item) of items`:

  - If `items` is an array, Sercrod uses `Array.from(items.entries())`.
    - `index` receives the numeric index.
    - `item` receives the element.
  - If `items` is a non-null object, Sercrod uses `Object.entries(items)`.
    - `index` receives the key.
    - `item` receives the value.

For `modeWord = "in"`:

- `key in obj`:

  - Sercrod runs a `for...in` style enumeration.
  - The single variable (`key` in this example) receives each property name.
  - To access values, you write expressions like `obj[key]` inside the body.

- `(key, value) in obj`:

  - The current implementation of `*each` does not bind `key` and `value` separately.
  - Only the second name is bound, and it receives the key string.
  - This form is therefore not usable in practice for `*each`.
  - If you need both key and value, always use `(key, value) of expr`.

Recommendation:

- Use `of` when you need values, or key and value pairs.
- Use `in` only when you need keys, and stick to the single-variable form (`key in obj`) with `*each`.


#### Evaluation timing

`*each` participates in Sercrod’s structural evaluation order:

- Host-level `*if` and `n-if` run before `*each`.
  - If a host `*if` condition is falsy, the host and its children are dropped and `*each` does not run.
- `*switch` on the same host (if present) is processed before `*each` and may completely replace the children.
- After those structural checks, `*each` is evaluated on the host.
- The expression for `*each` is evaluated once per render of the host, not once per iteration.
- Child directives (`*if` on child elements, nested `*for`, nested `*each`, `*include`, bindings, event handlers, and so on) are evaluated separately for each iteration when the child nodes are rendered.


#### Execution model

Conceptually, the runtime behaves like this when it encounters `*each`:

1. Evaluate the expression on `*each` to obtain a collection (`iterable`).
   - If the result is falsy, treat it as an empty collection and stop.
2. Create a shallow clone of the host element as a container.
   - The tag name and all attributes are copied.
   - The `*each` / `n-each` attribute is removed from the clone.
3. Take the original child nodes of the host as the template body.
4. For each entry in the collection:
   - Prepare a per-iteration scope that merges:
     - The effective parent scope.
     - The per-iteration variables (for example `item`, `index`, `key`, `value`).
   - Render each original child node with this scope into the container.
5. Append the container to the parent of the original host.
   - The original host node is not appended.

On re-renders:

- When the surrounding Sercrod host re-renders, `*each` re-evaluates the expression and rebuilds the loop body from the original template children.
- There is no diffing or keyed patching; the children are regenerated from the template, which keeps the implementation small and predictable.


#### Variable creation and scope layering

Inside the body of `*each`:

- The loop variables (`item`, `index`, `key`, `value`, or whatever names you choose) are added to the scope for each iteration.
- These variables shadow any outer variables with the same names.
- All existing scope entries remain available:
  - Data from the host (`data` or whatever you bound on `<serc-rod>`).
  - Special helpers like `$data`, `$root`, and `$parent` injected by Sercrod.
  - Methods injected via `*methods` or similar configuration.

Guidelines:

- Choose iteration variable names that do not unintentionally shadow important outer variables.
- If you need to access the original collection while using a short name for the item, keep a long-form name in the data, such as `state.items`, and refer to `state.items` when needed.


#### Parent access

`*each` does not introduce a separate parent object, but parent data remain available through the normal Sercrod scope model:

- You can access outer data through whatever names you used in `data` (for example `items`, `state`, `config`).
- You can access the root data with `$root`.
- You can access the nearest ancestor Sercrod host’s data with `$parent`.

The only additional names introduced by `*each` are the loop variables themselves.


#### Use with conditionals and loops

`*each` is designed to compose with other directives when they target different layers:

- Host-level condition:

  - `*if` on the same element is evaluated first and acts as a gate for the entire loop.

  ```html
  <ul *if="items && items.length" *each="item of items">
    <li *print="item.label"></li>
  </ul>
  ```

  - If `items` is falsy or has zero length, the `<ul>` and its body are not rendered at all.

- Child-level conditions:

  - You can freely use `*if` or `*for` inside the body of `*each`.

  ```html
  <ul *each="item of items">
    <li *if="item.visible">
      <span *print="item.label"></span>
    </li>
  </ul>
  ```

- Nested loops:

  - Nested `*for` or nested `*each` inside the body of `*each` are allowed.
  - Each nested loop sees the outer loop’s variables in its scope.

  ```html
  <table>
    <tbody *each="row of rows">
      <tr *each="cell of row.cells">
        <td *print="cell.text"></td>
      </tr>
    </tbody>
  </table>
  ```

  - In this example, `<tbody>` is rendered once, and its `<tr>` children are repeated per row, with `<td>` repeated per cell.


#### Use with templates, *include and *import

`*each`, `*include`, and `*import` are all structural directives that control the children of a host element, but in different ways:

- `*each`:
  - Takes the original children of the host as a template.
  - Repeats those children for each entry in a collection.

- `*include`:
  - Finds a named `*template`.
  - Replaces the host’s inner content with the inner content of that template.

- `*import`:
  - Is typically a higher-level helper that internally relies on the template/include mechanism.
  - Also wants to control the host’s children as a single unit.

Because all of these directives want to own the host’s children, putting them on the same element is not supported.

Invalid patterns:

```html
<ul *each="item of items" *include="'user-item'">
  <!-- This combination is not supported -->
</ul>

<ul *each="item of items" *import="'user-item'">
  <!-- This combination is also not supported -->
</ul>
```

Reasons:

- `*each` expects to read the host’s original children and use them as the loop body.
- `*include` and `*import` want to overwrite the host’s children with template content.
- The implementation does not merge these behaviors; whichever transformation happens first would effectively erase the assumptions of the others.
- The result is undefined and will almost certainly break expectations.

Supported patterns:

- Put `*each` on the container and `*include` or `*import` on a child element:

  ```html
  <ul *each="item of items">
    <li *include="'user-item'"></li>
  </ul>

  <ul *each="item of items">
    <li *import="'user-item'"></li>
  </ul>
  ```

  In these cases:

  - `<ul>` is the loop container, rendered once.
  - `<li>` is the template body for each iteration.
  - `*include` / `*import` runs independently inside each iteration, and the included template can use `item`.

- Or use `*include` / `*import` to bring in a template that contains its own loop:

  ```html
  <section *include="'user-list-block'"></section>
  <section *import="'user-list-block'"></section>
  ```

  Where `user-list-block` is a `*template` that uses `*each` internally.

If your project wraps `*include` with other helpers, or defines `*import` as such a helper, the same restriction applies: do not put those helpers on the same element as `*each`.


#### Comparison with *for

Both `*for` and `*each` iterate collections, but they do so at different structural levels.

- `*for`:

  - Repeats the host element itself.
  - Typical pattern for repeated siblings.

  ```html
  <ul>
    <li *for="item of items">
      <span *print="item"></span>
    </li>
  </ul>
  ```

- `*each`:

  - Keeps the host element as a single container and repeats its children.

  ```html
  <ul *each="item of items">
    <li *print="item"></li>
  </ul>
  ```

Recommendations:

- Use `*for` when the host itself is the repeated unit (list items, cards, rows).
- Use `*each` when the host is a structural wrapper that must stay unique (a `<ul>`, `<tbody>`, `<g>` in SVG, and similar).


#### Best practices

- Prefer `of` for value iteration:

  - Use `item of items` or `(index, item) of items` for arrays.
  - Use `(key, value) of obj` when you need both key and value.

- Use `in` only for keys:

  - `key in obj` is appropriate when you only care about property names.
  - Avoid `(key, value) in expr` with `*each`; the current implementation does not bind the pair as you might expect.

- Keep expressions simple:

  - If you need complex filtering or sorting, consider precomputing the collection in data or in a method instead of writing a very long expression in `*each`.

- Avoid mutating the iterated collection in the body:

  - Modifying the array or object you are looping over while rendering makes behavior harder to reason about.
  - Prefer to build a derived collection and iterate that.

- Use containers that match markup semantics:

  - For table rows, use `*each` on `<tbody>` or `<thead>` and keep `<tr>` as the repeated child.
  - For lists, use `*each` on `<ul>` or `<ol>` only when you explicitly want a single list node.

- Remember the structural restriction:

  - Do not combine `*each` with `*include` or `*import` on the same element.


#### Additional examples

Iterating over an object map:

```html
<serc-rod id="app" data='{
  "users": {
    "u1": { "name": "Alice" },
    "u2": { "name": "Bob" }
  }
}'>
  <dl *each="(id, user) of users">
    <dt *print="id"></dt>
    <dd *print="user.name"></dd>
  </dl>
</serc-rod>
```

Using `*each` on `<tbody>`:

```html
<serc-rod id="table" data='{
  "rows": [
    { "id": 1, "name": "Alpha" },
    { "id": 2, "name": "Beta" }
  ]
}'>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
      </tr>
    </thead>
    <tbody *each="row of rows">
      <tr>
        <td *print="row.id"></td>
        <td *print="row.name"></td>
      </tr>
    </tbody>
  </table>
</serc-rod>
```


#### Notes

- `*each` and `n-each` are aliases; choose one style per project for consistency.
- The expression on `*each` is evaluated as normal JavaScript inside Sercrod’s expression sandbox.
- In the current implementation:
  - `*each` expects arrays, plain objects, or other iterable values.
  - Falsy results behave like an empty collection.
  - `(key, value) in expr` is parsed but not useful; always prefer `(key, value) of expr` when using `*each`.
- Structural combinations where multiple directives compete for the same host’s children (such as `*each` plus `*include` or `*each` plus `*import` on one element) are not supported and should be avoided.
