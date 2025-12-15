### *for

#### Summary

`*for` repeats the host element for each entry in a list, object, or other iterable.
The host element itself is duplicated as many times as needed, and each clone is rendered with its own iteration scope.
The directive understands JavaScript-like `in` and `of` loop syntax and has an alias `n-for`.

There is also a special host-level form when `*for` is placed directly on a Sercrod host (`<serc-rod>`). In that case the host is not repeated; instead, the inner template is rendered multiple times inside the same host with different scopes.

Structural restriction:

- Do not combine `*for` and `*each` on the same element.
  - In the implementation, `*each` takes precedence and `*for` is ignored.
  - Use either `*for` or `*each`, not both, and prefer moving one directive to a child or parent element if you need both behaviors.


#### Basic example

Classic list items:

```html
<serc-rod id="app" data='{"items":["Apple","Banana","Cherry"]}'>
  <ul>
    <li *for="item of items">
      <span *print="item"></span>
    </li>
  </ul>
</serc-rod>
```

Behavior:

- The `<ul>` is rendered once.
- `*for="item of items"` clones the `<li>` for each element in `items`.
- For each clone, Sercrod renders the `<li>` subtree with a local variable `item` bound to the current value.
- The result is a `<ul>` containing three `<li>` elements as siblings.


#### Behavior

Element-level `*for`:

- `*for` is a structural directive that controls how many times the element itself is rendered.
- The host element and all of its attributes and children are cloned for each iteration.
- The original element acts as a template and is not rendered directly.
- The directive is available as both `*for` and `n-for`; they behave the same.

Host-level `*for` on `<serc-rod>`:

- When you put `*for` on a Sercrod host (`<serc-rod>`), the host is not duplicated.
- Instead, the host clears its content and repeatedly renders its internal template with different iteration scopes.
- This is useful when you want a single Sercrod host that manages multiple repeated blocks of content with a shared outer container.


#### Expression syntax

The expression to the right of `*for` uses a restricted, JS-like loop syntax:

- `value of iterable`
- `(key, value) of iterable`
- `key in object`
- `(key, value) in object` (allowed but not recommended; `of` is clearer)

`key` and `value` must be simple identifiers (no destructuring patterns).

Supported patterns for element-level `*for`:

- Arrays:

  - `item of items`  
    Iterates an array, binding `item` to each element.

  - `(index, item) of items`  
    Iterates an array, binding `index` to the numeric index and `item` to the element.

  - `key in items`  
    Iterates an array-like object by key, binding `key` to the property name as a string. For a normal array this means `"0"`, `"1"`, and so on.

  - `(key, value) in items`  
    Iterates an array-like object by key and value. `key` receives the property name and `value` receives the value at that index.

- Objects:

  - `key in obj`  
    Iterates over enumerable property names of `obj`. `key` receives each property name.

  - `(key, value) in obj`  
    Iterates over enumerable properties of `obj`. `key` receives the property name, `value` receives the value.

  - `value of obj`  
    Iterates over `Object.entries(obj)` and binds `value` to each value. An extra implicit variable `key` is also added when you use the single-variable `value of obj` form.

  - `(key, value) of obj`  
    Iterates over `Object.entries(obj)` and binds both `key` and `value`.

Host-level `*for` on `<serc-rod>` uses the same syntax but normalizes it slightly differently (see the dedicated section below).


#### Value semantics (element-level *for)

Element-level `*for` distinguishes `of` and `in` like JavaScript:

- For arrays with `of`:

  - `item of items`:

    - Sercrod loops with `for (const v of items)`.
    - For each value `v`, it clones the host and binds `item` to `v`.

  - `(index, item) of items`:

    - Sercrod uses `items.entries()`.
    - `index` receives the numeric index.
    - `item` receives the value.

- For objects with `of`:

  - `value of obj`:

    - Sercrod uses `Object.entries(obj)`.
    - For each `[k, v]`, it clones the host and binds:
      - `key` to the property name (implicit when you do not specify a key variable).
      - `value` to the value.

  - `(key, value) of obj`:

    - Sercrod uses `Object.entries(obj)`.
    - `key` receives the property name, `value` receives the value.

- For arrays and objects with `in`:

  - `key in expr`:

    - Sercrod uses `for (const k in expr)`.
    - The single variable receives the key (property name).

  - `(key, value) in expr`:

    - Sercrod uses `for (const k in expr)`.
    - `key` receives the key.
    - `value` receives `expr[k]`.

Deprecation note:

- `(key, value) in expr` is supported for compatibility but is discouraged.
- Sercrod prints a console warning when you use `in` with two variables.
- Prefer `(key, value) of expr` for new code when you need both key and value.


#### Evaluation timing

Element-level `*for` participates in Sercrod’s structural evaluation order inside `renderNode`:

- Text interpolation and static/dynamic handling happen first.
- `*if` and its chain (`*elseif`, `*else`) are evaluated and may select a specific branch.
- `*switch` and its branches (`*case`, `*case.break`, `*default`) are processed.
- `*each` runs before `*for` when both directives are present.
- `*for` is then evaluated on the element if it is still in play.

Important consequences:

- If `*if` or `*switch` is on the same element as `*for`, the conditional logic runs first and can select or skip that element. Once an element is selected by `*if` or a `*case`, the cloned branch is fed back into `renderNode`, where `*for` is then applied inside the clone.
- If both `*each` and `*for` are present on the same element, `*each` runs first and returns early. The `*for` block is never reached in that case. This is why combining `*each` and `*for` on a single element is considered unsupported.

Host-level `*for` is evaluated during the host’s update cycle, before its template is rendered. When a host `<serc-rod>` has `*for`, it clears its content, runs the host-level loop, and calls the internal template renderer once per iteration.


#### Execution model

Element-level `*for`:

1. Sercrod locates the `*for` (or `n-for`) attribute on the element.
2. It parses the expression into `keyName`, `valName`, `modeWord` (`"in"` or `"of"`), and `srcExpr`.
3. It evaluates `srcExpr` in the current scope with `{ el: work, mode: "for" }`.
4. If the result is falsy, `*for` acts as an empty loop and renders nothing.
5. For each entry in the collection (interpreted according to `in` or `of`):
   - Sercrod clones the entire element subtree with `cloneNode(true)`.
   - It removes `*for` and `n-for` from the clone.
   - It merges the iteration variables into the scope for that clone.
   - It calls the internal element renderer on the clone.
6. The clones are appended to the original parent in order.
7. The original element is not appended; it serves only as the template.

Host-level `*for` on `<serc-rod>`:

1. During an update, the host decides whether it should re-render.
2. The host clears its current content (`innerHTML = ""`).
3. It determines the current top-level scope (`_stage` if a staging branch is active, otherwise `_data`).
4. It reads the host’s `*for` or `n-for` expression and parses it with the same `(key, value) in|of expr` pattern.
5. It evaluates the iterable expression with `{ el: this, mode: "update" }`.
6. It normalizes the result into `[key, value]` pairs, using a helper that:
   - Treats `x in array` with a single variable similar to `x of array` for backward compatibility (values rather than keys).
   - For objects, returns `[key, value]` pairs for both `of` and `in`, but emphasizes `of` as the clearer option when you need `(key, value)`.
7. For each `[k, v]` pair:
   - If both `keyName` and `valName` are present, the host calls its template renderer with `{ ...scope, [keyName]: k, [valName]: v }`.
   - If only `valName` is present, it renders with `{ ...scope, [valName]: v }`.
8. The result is a single `<serc-rod>` instance whose children are repeated blocks rendered from the host’s template.


#### Variable creation and scope layering

Element-level `*for`:

- Creates loop variables in the per-iteration scope:
  - `item` in `item of items`.
  - `index` and `item` in `(index, item) of items`.
  - `key` in `key in obj`.
  - `key` and `value` in `(key, value) in obj` or `(key, value) of obj`.
- These variables shadow any outer variables with the same names for the duration of the iteration.
- All original scope entries remain available, including:
  - Host data.
  - `$data`, `$root`, `$parent`, and any global helpers.
  - Methods defined through Sercrod configuration.

Host-level `*for`:

- Works with the same pattern of loop variables, but applies them at the host scope level:
  - Each iteration constructs a new top-level scope for rendering the host’s template.
  - The loop variables are added on top of the base scope (`_stage` or `_data`).
- This allows each iteration to treat the host’s template as a root-level view for a different item.

Guidelines:

- Prefer descriptive names like `user`, `row`, or `entry` rather than very short names when it improves readability.
- Be careful not to unintentionally shadow important data names used elsewhere in the template.


#### Parent access

`*for` does not introduce a dedicated parent reference, but you can still access parent data as usual:

- Through the data tree, for example `state.items`, `config`, or `data.users`.
- Through `$root`, which points to the root Sercrod data.
- Through `$parent`, which points to the nearest ancestor Sercrod host’s data.

Loop variables exist alongside these references and do not prevent you from reading outer scopes.


#### Use with conditionals and loops

You can safely combine `*for` with other directives when they are placed thoughtfully:

- Host-level `*if` and `*switch`:

  - `*if` and `*switch` can appear on the same element as `*for`.
  - The conditional logic is resolved first.
  - Once a branch is selected, that branch is cloned and then inspected again; `*for` on the cloned node runs normally.

  ```html
  <li *if="items && items.length" *for="item of items">
    <span *print="item"></span>
  </li>
  ```

  - In practice, most code is easier to read if you put `*if` on a parent or child rather than combining them on the same element, but the combination is supported.

- Child-level conditions and nested loops:

  - You can use `*if` or nested `*for` / nested `*each` inside the body of a `*for` loop.

  ```html
  <ul>
    <li *for="item of items">
      <span *if="item.visible" *print="item.label"></span>
      <ul *each="tag of item.tags">
        <li *print="tag"></li>
      </ul>
    </li>
  </ul>
  ```

- Interaction with `*each`:

  - Use `*for` when you want to repeat the element itself as a sibling.
  - Use `*each` when you want to keep a single container and repeat its children.
  - Do not put `*for` and `*each` on the same element; as noted above, `*each` will take precedence and `*for` is effectively ignored.


#### Use with templates and *include

`*for` works well with templates and `*include`:

- Typical pattern:

  ```html
  <serc-rod id="app" data='{"items":[{"name":"Ann"},{"name":"Bob"}]}'>
    <template *template="user-item">
      <li>
        <span *print="item.name"></span>
      </li>
    </template>

    <ul>
      <li *for="item of items" *include="'user-item'"></li>
    </ul>
  </serc-rod>
  ```

- In this pattern:
  - `*for` repeats the `<li>` for each `item`.
  - `*include` fills each `<li>` body from the named template, and the included template can use `item`.
- Because `*for` clones the entire element (including structural attributes) before rendering, `*include` runs inside each clone and uses the iteration scope correctly.


#### Comparison with *each

Both `*for` and `*each` iterate collections, but they operate on different structural levels:

- `*for`:

  - Repeats the host element itself.
  - Typical for repeated siblings, such as list items, cards, and table rows.

  ```html
  <ul>
    <li *for="item of items">
      <span *print="item"></span>
    </li>
  </ul>
  ```

- `*each`:

  - Keeps the host element as a single container and repeats its children.
  - Useful when the container must remain unique (for example `<ul>`, `<tbody>`, or SVG groups).

  ```html
  <ul *each="item of items">
    <li *print="item"></li>
  </ul>
  ```

Guideline:

- When in doubt, ask whether you want multiple copies of the container element or just one container with repeated children.
  - Multiple containers: use `*for`.
  - Single container: use `*each`.


#### Host-level *for on <serc-rod> (advanced)

Placing `*for` directly on a Sercrod host is an advanced but powerful pattern:

Basic example:

```html
<serc-rod id="host" *for="user of users" data='{
  "users": [
    { "name": "Alice", "age": 30 },
    { "name": "Bob",   "age": 25 }
  ]
}'>
  <section class="user-card">
    <h2 *print="user.name"></h2>
    <p *print="user.age + ' years old'"></p>
  </section>
</serc-rod>
```

Behavior:

- The `<serc-rod>` element itself appears once in the DOM.
- Its internal template (the `<section>` block) is rendered once per `user`.
- Each iteration receives a scope where `user` refers to the current user.
- This is similar in spirit to `*each` on a top-level container, but it is implemented at the Sercrod host level and uses the host’s template renderer.

Notes on semantics:

- Single-variable `x of expr` is the recommended form for values in host-level `*for`.
- Single-variable `x in expr` is treated as a value loop for arrays for backward compatibility and, with objects, also yields values when you access `x`.
- When you need both key and value, use `(key, value) of expr`. Using `(key, value) in expr` is supported but emits a console warning; `of` is clearer.


#### Best practices

- Prefer `of` for new code:

  - Use `item of items` or `(index, item) of items` for arrays.
  - Use `(key, value) of obj` for objects when you need both key and value.
  - Reserve `in` for cases where you explicitly care about keys and understand the differences.

- Keep loop expressions simple:

  - Complex filtering, sorting, or mapping is easier to maintain when done in data or helper methods rather than written inline in the `*for` expression.

- Avoid mutating the iterated collection while rendering:

  - Modifying the array or object you are looping over during rendering can lead to hard-to-follow behavior.
  - Prefer to compute a derived collection, then iterate over that.

- Choose between `*for` and `*each` explicitly:

  - If your design calls for multiple sibling elements, use `*for`.
  - If your design calls for a single container with repeated children, use `*each`.

- Do not combine `*for` with `*each` on the same element:

  - In current Sercrod, `*each` wins when both are present, so `*for` never runs.
  - For clarity, always keep them on separate elements.


#### Additional examples

Iterating over an object map with both key and value:

```html
<serc-rod id="app" data='{
  "users": {
    "u1": { "name": "Alice" },
    "u2": { "name": "Bob" }
  }
}'>
  <ul>
    <li *for="(id, user) of users">
      <strong *print="id"></strong>
      <span *print="user.name"></span>
    </li>
  </ul>
</serc-rod>
```

Using `*for` on table rows:

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
    <tbody>
      <tr *for="row of rows">
        <td *print="row.id"></td>
        <td *print="row.name"></td>
      </tr>
    </tbody>
  </table>
</serc-rod>
```


#### Notes

- `*for` and `n-for` are aliases; projects should choose one style and use it consistently.
- The expression on `*for` is evaluated as normal JavaScript inside Sercrod’s expression sandbox.
- Element-level `*for` repeats the element itself, while host-level `*for` on `<serc-rod>` repeats the inner template.
- Single-variable `x in array` is treated differently at the host level for backward compatibility; for clarity and predictability, prefer `x of expr` and `(key, value) of expr` in new code.
- Structural combinations where `*each` and `*for` compete for control of the same host element are not supported. Use one structural directive per element.
