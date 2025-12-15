### *log

#### Summary

`*log` evaluates an expression and logs its result together with the expression and a short host snippet.
It is meant as a lightweight debugging helper for Sercrod templates.
The alias `n-log` behaves the same.

- On normal elements, `*log` prints to the browser console.
- On `<pre *log>`, `*log` writes a formatted debug block into the `<pre>` element itself.

Logging is side-effect free with respect to Sercrod data: `*log` does not modify the host’s data.


#### Basic example

Console logging a value:

```html
<serc-rod id="app" data='{"user":{"name":"Alice","age":30}}'>
  <div *log="user"></div>

  <p>
    Hello,
    <span *print="user.name"></span>
  </p>
</serc-rod>
```

Behavior:

- On first render, Sercrod evaluates `user` in the host scope.
- In the browser console, it prints the value of `user` (an object), the expression string `"user"`, and a compact snippet of the `<div *log>` element.
- The `<div>` itself stays empty in the DOM.


Using `<pre *log>` to display logs on the page:

```html
<serc-rod id="debug" data='{"items":[1,2,3]}'>
  <pre *log="items"></pre>
</serc-rod>
```

Behavior:

- Sercrod evaluates `items`.
- Instead of logging to the console, it writes a formatted block into the `<pre>` element as plain text.
- The output includes the value of `items`, the expression, and a snippet of the `<pre *log>` itself.


#### Behavior

Core behavior:

- `*log` evaluates an expression in the current Sercrod scope.
- It formats three pieces of information:
  - The value of the expression (or the scope when no expression is given).
  - The expression string itself (or the literal `(scope)` when omitted).
  - A compact snippet of the element that carries `*log`.

Where the log is sent:

- On `<pre *log="...">` or `<pre n-log="...">`:
  - Sercrod writes a multi-line debug message into `pre.textContent`.
  - The content is plain text, not HTML, so markup is not interpreted.
- On any other element:
  - Sercrod prints to the browser console using `console.log`.
  - The debug entry starts with `[Sercrod log]` and then prints the value, expression, snippet, and any error.

Single-shot semantics:

- Each `*log` element logs exactly once per Sercrod host instance.
- On subsequent updates of the same host, the same `*log` element is skipped by an internal `+logged` flag.
- Newly created elements with `*log` (for example from loops or conditionals) will log once when they first appear.


#### Expression rules

The attribute value of `*log` is a standard Sercrod expression:

- Typical usage:

  - `*log="user"`  
  - `*log="user.name"`  
  - `*log="items.length"`  
  - `*log="state"`  

- The alias `n-log` is identical in behavior:

  - `n-log="user"` can be used instead of `*log="user"`.

Expression is optional:

- If an expression is provided:

  - Sercrod calls `eval_expr(expr, scope, { el, mode: "log" })`.
  - The result is used as the value to log.

- If the attribute value is empty or missing:

  - Sercrod uses the whole current scope as the value to log.
  - The expression label in the output becomes `(scope)`.

Value formatting:

- For `null` or `undefined`:

  - The internal value and string are treated as empty.
  - The log entry still includes the expression and snippet.

- For objects:

  - The console receives the live object value when not using `<pre>`.
  - For `<pre *log>`, Sercrod also tries to build a pretty JSON string using `JSON.stringify(value, null, 2)`.
  - If `JSON.stringify` fails (for example because of circular references), the string becomes `[Sercrod warn] JSON stringify failed`.

- For primitive values (string, number, boolean):

  - The value is converted to a string and used for both console and `<pre>` output.

Error handling:

- If evaluation throws an error:

  - The value becomes a message like `[Sercrod warn] *log eval error: ...`.
  - The expression and snippet are still shown.
  - The error message is included in the console entry or `<pre>` text.


#### Evaluation timing

`*log` is tied to the lifecycle of the Sercrod host:

- After the host completes its normal render (`_renderTemplate`) and the internal flag index is rebuilt, Sercrod schedules log evaluation.
- The actual logging is triggered in a `requestAnimationFrame` callback:

  - This means the DOM tree is fully updated and painted by the time `*log` runs.
  - The snippet for the element (a compact `outerHTML` summary) reflects the final rendered markup.

- `*log` runs after:

  - Structural directives (such as `*if`, `*for`, `*each`, `*switch`).
  - Data bindings and attribute bindings.
  - The `*man` hooks.

- Because logging is single-shot per element, a later data change does not cause the same `*log` element to log again.
  - If you need to observe later states, you can:
    - Place `*log` on elements created conditionally or through loops so that a new element appears when state changes.
    - Or use your own event handlers and `console.log` in JavaScript.


#### Execution model

Internally, Sercrod executes `*log` roughly as follows:

1. During render, Sercrod builds an index of elements that carry `*log` or `n-log`.
2. After the host render and index rebuild, Sercrod schedules `_call_log_hooks(scope)` inside `requestAnimationFrame`.
3. When `_call_log_hooks` runs:
   - If `this.log` is `false`, it aborts immediately (global log-off for this host).
   - It takes all elements indexed under the `*log` flag.
4. For each element `el`:
   - If `el` already has a `+logged` flag, it is skipped.
   - Otherwise, Sercrod sets the `+logged` flag on `el`.
   - Sercrod reads `expr` from `*log` or `n-log`.
   - It evaluates `expr` (if provided) in the current scope, or uses `scope` directly when there is no expression.
   - It computes:
     - `val`: the value used for console output.
     - `str`: the text representation (pretty JSON for objects when possible).
     - `html`: a compact summary of `el.outerHTML`, collapsed whitespace and limited to 256 characters.
5. Depending on the element type:
   - If `el.tagName === "PRE"`:
     - Sercrod builds a multi-line debug string with:
       - A prefix line such as `[Sercrod pr]`.
       - The stringified value.
       - A line indicating the expression or `(scope)`.
       - A line containing the snippet.
       - An optional line for the error message when evaluation failed.
     - Sercrod assigns this string to `el.textContent`.
   - Otherwise:
     - Sercrod calls `console.log` with a formatted block including:
       - A label `[Sercrod log]`.
       - The value, expression (or `(scope)`), snippet, and optional error message.

This model guarantees that each `*log` node contributes at most one entry and that the entry reflects the post-render state of the DOM.


#### Scope and variables

`*log` does not introduce new variables or change existing ones.

- It reads the current scope as-is and evaluates the expression in that scope.
- All usual scope features are available:
  - Data defined on the host (`data` attribute).
  - `$data`, `$root`, `$parent`, and other special injections.
  - Methods defined through `*methods` or global helpers.

Because `*log` is read-only with respect to data:

- It is safe to attach `*log` to elements that also use data bindings, conditions, or loops.
- It will not interfere with expression results for other directives.


#### Use with conditionals and loops

`*log` composes naturally with other directives:

- With `*if`:

  - If `*if` on the same element or an ancestor removes the element from the DOM, there is nothing to log.
  - If the element is rendered, `*log` will run once for that element.

  ```html
  <div *if="debugMode" *log="state">
    <!-- This block is logged only when debugMode is truthy -->
  </div>
  ```

- Inside loops:

  - You can place `*log` on elements in `*for` or `*each` bodies to log each iteration once.

  ```html
  <ul *each="item of items">
    <li *log="item" *print="item.label"></li>
  </ul>
  ```

  - Each `<li>` logs once when it first appears, using the `item` from that iteration.

- With event handlers:

  - `*log` does not react to events; it is evaluated only after render.
  - For event-driven logging, use `console.log` or `_log` from your own handlers instead.


#### Best practices

- Use `<pre *log>` when you want visible debug output on the page:

  - Helpful in environments where the browser console is not easily accessible.
  - Keeps the content as plain text, so you can safely inspect JSON or other structured data.

- Use `*log` sparingly in production:

  - Logging is controlled by the `log` flag on the Sercrod host instance.
  - You can disable all `*log` output for a host by setting `host.log = false` in JavaScript.

- Prefer simple expressions:

  - `*log` is most useful for inspecting the shape of objects and the values of key fields.
  - Avoid very complex expressions; instead, log the data from which they are derived.

- Combine with scopes:

  - Use `*log="$data"` to inspect the entire host data.
  - Use `*log="$root"` when you want to see the root Sercrod data tree.
  - Use `*log="$parent"` inside nested hosts to understand parent-child relationships.


#### Examples

Inspect the entire host data:

```html
<serc-rod id="app" data='{"user":{"name":"Alice"},"debug":true}'>
  <pre *log="$data"></pre>
</serc-rod>
```

Inspect a subset of state:

```html
<serc-rod id="app" data='{"state":{"step":1,"status":"idle"}}'>
  <div *log="state.status"></div>
</serc-rod>
```

Log per item in a list (console only):

```html
<serc-rod id="list" data='{"items":[{"id":1},{"id":2},{"id":3}]}'>
  <ul>
    <li *for="item of items" *log="item.id">
      Item <span *print="item.id"></span>
    </li>
  </ul>
</serc-rod>
```


#### Notes

- `*log` and `n-log` are aliases; choose a consistent style for your project.
- `*log` is a diagnostic directive:
  - It does not update data.
  - It does not participate in structural decisions (unlike `*if`, `*for`, or `*each`).
- Logging is controlled per Sercrod host via the `log` property:
  - `this.log` defaults to `true` in the host constructor.
  - Setting `host.log = false` (where `host` is a Sercrod element) disables `*log` output for that host.
- Each element with `*log` logs only once per host instance due to the internal `+logged` flag.
- There are no special combination restrictions for `*log`:
  - It can share the same element with other directives such as `*if`, `*for`, `*each`, `*print`, `@events`, and so on.
  - It does not compete for ownership of the host’s children in the way structural directives like `*include` or `*import` do.
