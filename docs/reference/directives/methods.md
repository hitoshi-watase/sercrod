### *methods

#### Summary

`*methods` and `n-methods` import global functions into a Sercrod host so that they can be called from expressions inside that host.

- The attribute value is a space-separated list of names.
- Each name refers to either:
  - a function on `window`, or
  - an object on `window` whose function properties should be imported.
- Imported functions are injected into the expression scope for this host.
- `*methods` is not a structural directive. It does not change the DOM. It only changes which functions are visible to expressions.

`*methods` and `n-methods` are aliases. They behave identically.


#### Basic example

Single global function:

```html
<script>
  // Define a global helper
  function toLabel(value){
    return `Value: ${value}`;
  }
</script>

<serc-rod id="app" data='{"value": 1}' *methods="toLabel">
  <p *print="toLabel(value)"></p>
</serc-rod>
```

Object of functions:

```html
<script>
  // Group helpers under a single global object
  window.calc = {
    inc(x){ return x + 1; },
    double(x){ return x * 2; }
  };
</script>

<serc-rod id="app" data='{"value": 2}' *methods="calc">
  <p *print="inc(value)"></p>
  <p *print="double(value)"></p>
</serc-rod>
```

In this example:

- `*methods="calc"` looks up `window.calc`.
- Because it is an object, Sercrod imports each function property as a top-level name in the expression scope:
  - `inc` and `double` become available directly.
- There is no implicit `calc` variable in expressions. You call `inc(value)`, not `calc.inc(value)`.


#### Behavior

`*methods` is an attribute on the Sercrod host element:

- It is observed by the custom element class via `observedAttributes`.
- When the attribute changes, the value is split into tokens and stored as `_methods_names`.
- When Sercrod evaluates expressions or `*let` blocks inside this host, it uses `_methods_names` to inject functions into the evaluation scope.

Key properties:

- The attribute is read-only from the template’s point of view. It does not create or modify DOM nodes.
- Changing `*methods` does not trigger a re-render by itself.
  - It only affects which functions are visible to future expression evaluations in this host.
- Import is non-destructive:
  - If a name already exists in the evaluation scope, `*methods` does not overwrite it.


#### Configuration syntax

`*methods` and `n-methods` accept a space-separated list of identifiers:

- On the Sercrod host:

  ```html
  <serc-rod
    id="app"
    data='{"value": 10}'
    *methods="toLabel calc"
  >
    ...
  </serc-rod>
  ```

- Equivalent alias:

  ```html
  <serc-rod
    id="app"
    data='{"value": 10}'
    n-methods="toLabel calc"
  >
    ...
  </serc-rod>
  ```

Resolution for each token `name`:

- If `window[name]` is a function:
  - The function is injected as `name` into the expression scope.
- Else if `window[name]` is an object (non-null):
  - For each property `k` in `window[name]`:
    - If `window[name][k]` is a function and that `k` is not already defined in the scope, it is injected as `k`.
- Other cases (non-function primitives, null, undefined) are ignored.

The import model is intentionally simple:

- You can import a single function, or
- You can import many functions at once via a global object, with their keys as function names in the scope.


#### Evaluation timing

`*methods` influences expression evaluation at the point where Sercrod builds the sandbox for each expression.

- For general expressions (such as `*if`, `*for`, `*each`, `*input`, interpolations, and most bindings), Sercrod calls `eval_expr(expr, scope, opt)`:
  - It creates a `merged` scope object from the current `scope`.
  - It injects special values such as `$data` and `$root`.
  - It injects `$parent` if needed.
  - It then injects functions from `*methods` via `_methods_names`.
  - Finally, it injects Sercrod’s internal methods from `_internal_methods`.

- For `*let`, Sercrod calls `eval_let(expr, scope, opt)`:
  - It starts from the current `scope`.
  - It injects `$parent` if needed.
  - It injects functions from `*methods`.
  - It injects internal methods.
  - It then evaluates the `*let` expression and writes back into the appropriate target.

Important points:

- The `*methods` attribute is not re-evaluated on every expression; rather, its tokenized list `_methods_names` is reused.
- Actual function lookup (`window[name]`) happens at evaluation time, based on the current global state.
- If `*methods` changes at runtime:
  - `_methods_names` is updated when the attribute changes.
  - Future calls to `eval_expr` and `eval_let` reflect the new method list.
  - No automatic re-render is triggered just by changing `*methods`.


#### Execution model

In pseudocode, evaluation with `*methods` looks like this:

- For `eval_expr` (used by directives such as `*if`, `*for`, `*each`, bindings):

  1. Start with `merged = { ...scope }`.
  2. Inject reserved helpers:
     - `$data` from this host’s `data`.
     - `$root` from the root host’s `data`, if any.
     - `$parent` from the nearest ancestor Sercrod host’s `data`, if not already set.
  3. For each `name` in `_methods_names`:
     - If `window[name]` is a function and `merged[name]` is undefined:
       - Inject `merged[name] = window[name]`.
     - Else if `window[name]` is a non-null object:
       - For each `k` in `window[name]`:
         - If `window[name][k]` is a function and `merged[k]` is undefined:
           - Inject `merged[k] = window[name][k]`.
  4. For each `k` in `Sercrod._internal_methods`:
     - If `merged[k]` is undefined:
       - Inject the built-in helper as `merged[k]`.
  5. Evaluate the expression in `with(merged){ return (expr) }`.

- For `eval_let`:

  1. Start from `scope` (the target scope for `*let`).
  2. If `$parent` is not yet set, inject it.
  3. Inject methods from `_methods_names` using the same logic as in `eval_expr`.
  4. Inject internal methods from `_internal_methods` where names are still free.
  5. Evaluate the `*let` expression in a dedicated sandbox and commit assignments according to its mode.

This model guarantees:

- Expressions cannot accidentally see arbitrary global variables unless you explicitly import them via `*methods` or put them into `data`.
- Internal helpers are always available unless you intentionally override them.
- The evaluation environment is stable and predictable.


#### Scope and resolution order

When you call `foo()` inside an expression on a host with `*methods`, Sercrod resolves `foo` in the following effective order:

1. Local scope (loop variables, `*let` bindings, and similar).
2. Host `data` and any stage buffer associated with it.
3. `$parent` and `$root` references (if you explicitly use those names).
4. Functions imported via `*methods` and `n-methods`:
   - First, functions from global functions listed directly in `_methods_names`.
   - Then, functions from global objects listed in `_methods_names`.
5. Internal helpers from `_internal_methods` (only if the name is still free).

Collisions:

- If `data` defines `double`, and `*methods` also exposes a function named `double`, the `data` entry wins.
- If two method containers both define `format`, only the first one listed in `*methods` is used for `format`.
  - Later containers cannot overwrite existing names; imports only fill gaps.

This allows you to:

- Keep built-in helpers available by default.
- Override them explicitly in your own data or method containers when you need a different implementation.


#### Use with conditionals, loops, and bindings

`*methods` affects any directive that relies on `eval_expr` or `eval_let` inside this host. That includes:

- Conditional directives:
  - `*if`, `*elseif`, `*else` conditions can call imported methods.

- Loop directives:
  - `*for` and `*each` loop conditions and item expressions can call imported methods.

- Data directives:
  - `*let` expressions can call imported methods when computing derived values.
  - `*input`, `*value`, and similar binding directives can call imported methods for formatting or parsing.

Example: formatting in conditionals and loops

```html
<script>
  window.userHelpers = {
    isAdult(user){ return user.age >= 18; },
    displayName(user){ return `${user.last}, ${user.first}`; }
  };
</script>

<serc-rod
  id="users"
  data='{"users":[{"first":"Ann","last":"Lee","age":22},{"first":"Bob","last":"Smith","age":15}]}'
  *methods="userHelpers"
>
  <ul *each="user of users">
    <li *if="isAdult(user)">
      <span *print="displayName(user)"></span>
    </li>
  </ul>
</serc-rod>
```

Example: derived values via `*let`

```html
<script>
  function priceWithTax(price, rate){
    return Math.round(price * (1 + rate));
  }
</script>

<serc-rod
  id="cart"
  data='{"price": 1000, "taxRate": 0.1}'
  *methods="priceWithTax"
>
  <p *let="total = priceWithTax(price, taxRate)">
    Subtotal: <span *print="price"></span><br>
    Total: <span *print="total"></span>
  </p>
</serc-rod>
```


#### Use with events

Event handlers (`@click`, `@input`, and similar) are evaluated via a different helper (`eval_event`), which has a built-in window fallback.

- Event expressions already see `window` by default.
- This means you can call global functions directly from event handlers even without `*methods`.

Example:

```html
<script>
  function logClick(message){
    console.log("clicked:", message);
  }
</script>

<serc-rod id="app" data='{"label":"Hello"}'>
  <button @click="logClick(label)">
    Click
  </button>
</serc-rod>
```

This works even without `*methods`, because:

- `eval_event` checks `window` if a name is not in the local base scope or parent data.

Where `*methods` still helps:

- For consistency between events and non-event expressions.
  - With `*methods`, you can call the same helpers in `*if`, `*let`, loops, and events.
- For central control:
  - Using `*methods` makes it explicit which global helpers are considered part of a host’s public API.

In short:

- Events can access `window` directly.
- Non-event expressions require `*methods` (or explicit data) if you want to use global helpers.
- Using `*methods` across the board keeps your templates more predictable and self-documenting.


#### Best practices

- Prefer method containers for related helpers:

  - Group related functions into global objects and import them as a unit.

  ```html
  <script>
    window.str = {
      upper(s){ return String(s).toUpperCase(); },
      lower(s){ return String(s).toLowerCase(); }
    };
  </script>

  <serc-rod data='{"name":"Ann"}' *methods="str">
    <p *print="upper(name)"></p>
  </serc-rod>
  ```

- Keep the list small and explicit:

  - Avoid importing large, unfiltered libraries directly into the expression scope.
  - Instead, expose a curated wrapper object with only the helpers you actually use.

- Avoid name collisions:

  - Choose method names that are unlikely to collide with data keys or other helpers.
  - When using multiple containers in `*methods`, order them so that the most important ones appear first.

- Keep methods side-effect aware:

  - Expressions are often re-evaluated during updates.
  - Prefer methods that are pure or idempotent for use in `*if`, `*for`, `*each`, and formatting.
  - Reserve side-effect-heavy operations for event handlers or dedicated APIs.

- Do not rely on `*methods` outside Sercrod hosts:

  - The attribute is only observed on the Sercrod custom element.
  - Using `*methods` on a normal HTML element has no effect.


#### Examples

Multiple containers:

```html
<script>
  window.math = {
    add(a, b){ return a + b; },
    mul(a, b){ return a * b; }
  };

  window.format = {
    asCurrency(yen){
      return `${yen} JPY`;
    }
  };
</script>

<serc-rod
  id="checkout"
  data='{"unitPrice": 1200, "quantity": 3}'
  *methods="math format"
>
  <p *let="total = mul(unitPrice, quantity)">
    Total: <span *print="asCurrency(total)"></span>
  </p>
</serc-rod>
```

Overriding internal helpers:

- Sercrod injects internal helper methods after `*methods`.
- If you want to override a built-in helper, you can define a function with the same name in data or import it via `*methods` before it would be filled from `_internal_methods`.

Example (conceptual):

```html
<script>
  window.helpers = {
    htmlEscape(s){
      // Your own implementation
      return String(s).replace(/[&<>"]/g, "_");
    }
  };
</script>

<serc-rod
  id="app"
  data='{"text": "<b>unsafe</b>"}'
  *methods="helpers"
>
  <p *print="htmlEscape(text)"></p>
</serc-rod>
```

Here, if Sercrod has a built-in `htmlEscape`, your version imported via `*methods` will be used instead, because expression scopes are filled from data and imported methods before `_internal_methods`.


#### Notes

- `*methods` and `n-methods` are attributes on the Sercrod host. They are not general-purpose directives for arbitrary elements.
- The attribute value is parsed as a space-separated list each time it changes.
- For each name, Sercrod looks at `window[name]` at evaluation time:
  - Functions are imported as-is under their own name.
  - Objects contribute their function properties as top-level names.
- Imported methods affect:
  - `eval_expr` (conditions, loops, bindings).
  - `eval_let` (local variable definitions).
  - They do not change how `eval_event` falls back to `window`, although using `*methods` keeps usage consistent.
- Imports only fill missing names. They never overwrite existing entries in the scope, data, or previously imported methods.
- Internal helpers from `_internal_methods` are always available as a last resort, unless you override them via data or `*methods`.
- There is no special runtime handling for `type="application/sercrod-methods"` by itself. How you define and attach functions to `window` is up to your application; `*methods` simply imports those global functions into Sercrod’s expression scope.
