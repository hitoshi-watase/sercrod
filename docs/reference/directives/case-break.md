### *case.break

#### Summary

`*case.break` is a variant of `*case` used inside `*switch` or `n-switch`.
It behaves like `*case` when matching against the switch value, and in addition it stops evaluating all later `*case` and `*default` branches in the same `*switch` block.
It is effectively syntactic sugar for `*case="expr" *break` on the same element.

Alias:

- `*case.break`
- `n-case.break`

Both names share the same behavior.


#### Basic example

A simple status switch that does not fall through past the matching branch:

```html
<serc-rod id="app" data='{"status": "ready"}'>
  <div *switch="$data.status">
    <p *case="'pending'">Pending...</p>
    <p *case.break="'ready'">Ready</p>
    <p *default>Unknown status</p>
  </div>
</serc-rod>
```

Behavior:

- The host `<div *switch>` evaluates `$data.status` as the switch value.
- The second branch `*case.break="'ready'"` matches that value.
- That branch is rendered.
- Because it is a `*case.break` branch, Sercrod stops there and does not render the `*default` branch.


#### Behavior

`*case.break` participates only as a child of a `*switch` or `n-switch` host:

- It is recognized only on direct element children of a node with `*switch` or `n-switch`.
- Outside of a `*switch` context, `*case.break` and `n-case.break` are not interpreted by the switch logic and have no special effect.

Within a `*switch` block:

- Sercrod walks child elements in DOM order.
- It finds the first branch that should start rendering:
  - A matching `*case` or `*case.break`.
  - Or a `*default` when no earlier case has matched.
- Once rendering has started, Sercrod is in a fallthrough mode:
  - Every subsequent `*case` or `*default` branch is also rendered, until a break-type directive is seen.
- `*case.break` is both:
  - A case branch (its expression is matched against the switch value).
  - A break marker (it stops processing any later branches in this `*switch`).

Conceptually:

- `*case="expr"` means "start here if `expr` matches; then continue rendering later branches."
- `*case.break="expr"` means "start here if `expr` matches; render this branch; then stop, with no further fallthrough."


#### Evaluation timing

Within the host element that has `*switch` or `n-switch`:

1. Sercrod evaluates the switch expression once:

   - It reads the attribute value from `*switch` or `n-switch`.
   - It evaluates that expression and stores the result as the switch value.
   - The value is then exposed to children as `$switch`.

2. Sercrod iterates over child elements in DOM order.

3. For each child:

   - If it does not have `*case`, `n-case`, `*case.break`, `n-case.break`, `*default`, or `n-default`, it is ignored by the switch logic and never rendered by this `*switch`.
   - If no branch has started yet:
     - `*case` / `n-case` / `*case.break` / `n-case.break`:
       - Sercrod evaluates the case expression and compares it to the switch value.
       - If it matches, rendering starts from this branch.
     - `*default` / `n-default`:
       - If no earlier branch has matched, rendering starts from this default.

4. Once a starting branch is chosen (including `*case.break`):

   - Sercrod clones that branch, removes control attributes, and renders it with the augmented child scope (including `$switch`).
   - It then continues in fallthrough mode (see below) unless a break is detected.


#### Case expression semantics

The expression given to `*case.break` is interpreted in the same way as for `*case`.

Given:

- `switchVal` as the evaluated switch value.
- `raw` as the attribute string from `*case.break="raw"`.

Sercrod applies the following rules:

1. It first tries to evaluate the case expression as a normal Sercrod expression, with `$switch` injected into the scope:

   - If the result is a function, Sercrod calls `fn(switchVal, scope)` and uses the truthiness of the return value.
   - If the result is a `RegExp`, Sercrod tests it against `String(switchVal)`.
   - If the result is an array, Sercrod checks whether any element is strictly equal to `switchVal` (using `Object.is` semantics).
   - If the result is an object with a `has` method (for example a `Set`), Sercrod calls `set.has(switchVal)` and uses the result.
   - If the result is a boolean, the boolean itself decides the match.
   - If the result is a string, number, or bigint, Sercrod compares it to `switchVal` using strict identity.
   - For other result types, this step does not produce a match.

2. If evaluation throws, or if you intentionally keep the expression as a simple string, Sercrod falls back to a token list:

   - It splits the raw string on commas or pipes: `"a|b,c"` becomes tokens like `"a"`, `"b"`, `"c"`.
   - It trims empty tokens.
   - For each token `t`:
     - It tries to evaluate `t` as an expression.
     - If that fails, it uses `t` itself as a string literal.
     - It compares the result to `switchVal` using strict identity.
   - If any token matches, the case matches.

Useful patterns:

- Direct equality:

  - `*case.break="'ready'"` matches when `$switch` is strictly `"ready"`.

- Membership in a small set:

  - `*case.break="'pending' | 'queued'"`  
    Matches when `$switch` is `"pending"` or `"queued"`.

- Function-based matching:

  - `*case.break="(val) => val > 0"`  
    Matches if the function returns a truthy value when called with `switchVal` and the current scope.

- Regular expression matching:

  - `*case.break="/^ok-/"` (assuming the expression is parsed to a RegExp)  
    Matches when the string form of `$switch` starts with `ok-`.


#### Scope and `$switch`

Inside a `*switch` block, and inside a `*case.break` branch:

- The child scope is created as a shallow copy of the parent scope plus `$switch`.
- The case expression for `*case.break` is evaluated with `$switch` available.
- The branch content is rendered with the same scope:

  - All original data (for example `$data`, `$root`, `$parent`) remain available.
  - `$switch` holds the value of the `*switch` expression.
  - `*case.break` itself does not create new variables; it only controls whether and where this branch starts and whether execution stops afterward.

You can freely refer to `$switch` inside the branch body:

```html
<div *switch="status">
  <p *case.break="'error'">
    Error: <span *print="$switch"></span>
  </p>
  <p *default>OK</p>
</div>
```


#### Relationship to *case, *default and *break

Within a `*switch` block:

- `*case` and `n-case`:
  - Define branches that start rendering when their expression matches `$switch`.
  - Do not stop fallthrough by themselves.

- `*default` and `n-default`:
  - Define a branch that starts rendering only if no earlier `*case` or `*case.break` has matched.
  - Do not stop fallthrough by themselves.

- `*break` and `n-break` on a branch:
  - If placed together with `*case` or `*default`, they cause the switch to stop after rendering that branch.
  - This is equivalent to "case + break" or "default + break" in JavaScript.

- `*case.break` and `n-case.break`:
  - Combine `*case` and `*break` into a single directive.
  - They match using the same rules as `*case`.
  - When the branch is rendered, they also act as a break marker, stopping the switch from evaluating later branches.

Syntactic equivalence:

- The following two branches are equivalent in behavior:

  - `*case.break="expr"`

  - `*case="expr" *break`

Sercrod implementation treats both forms in the same way:

- For matching, it uses the `*case` / `n-case` / `*case.break` / `n-case.break` expression.
- For breaking, it checks for `*break`, `n-break`, `*case.break`, or `n-case.break` on the original branch element.


#### Fallthrough and break behavior

`*switch` in Sercrod uses a DOM-ordered, fallthrough model similar to JavaScript:

- Sercrod locates the first branch that should start rendering.
- From that branch onward, it renders every subsequent `*case` / `*default` branch until a break is detected.
- A break is detected when the original branch element has any of:
  - `*break`
  - `n-break`
  - `*case.break`
  - `n-case.break`

`*case.break` is therefore the most concise way to express:

- "Start rendering here when this condition holds."
- "Do not allow any further fallthrough."

Example showing fallthrough vs break:

```html
<div *switch="state">
  <p *case="'warm'">Warm</p>
  <p *case="'hot'">Hot</p>
  <p *default>Default</p>
</div>

<div *switch="state">
  <p *case="'warm'">Warm</p>
  <p *case.break="'hot'">Hot only</p>
  <p *default>Default</p>
</div>
```

- If `state` is `"hot"`:
  - In the first block:
    - The `*case="'hot'"` branch starts rendering.
    - There is no break, so the `*default` branch also renders (fallthrough).
  - In the second block:
    - The `*case.break="'hot'"` branch starts rendering and also stops the switch.
    - The `*default` branch does not render.


#### Best practices

- Use `*case.break` when you explicitly want "no fallthrough":

  - It is clearer than writing `*case="expr" *break`.
  - It makes it obvious that this branch is terminal inside the switch.

- Keep case expressions simple:

  - Prefer direct comparisons or small membership sets.
  - Move complex logic to a helper function and call it from the case expression.

- Use `$switch` consistently:

  - When writing more advanced logic, prefer using `$switch` inside the expression rather than repeating the switch expression.
  - For example, `*case.break="(v) => v > 100"` can be easier to read than rewriting the whole expression.

- Avoid redundant `*break` attributes:

  - `*case.break="expr" *break` is allowed but redundant; the break is already implied by `*case.break`.
  - For clarity, choose either `*case="expr" *break` or `*case.break="expr"`, not both.

- Do not rely on non-case children inside `*switch`:

  - Elements without any of `*case`, `n-case`, `*case.break`, `n-case.break`, `*default`, or `n-default` are ignored by the switch logic.
  - Wrap branch content in dedicated case/default elements.


#### Additional examples

Simple status mapping with no fallthrough:

```html
<serc-rod id="status-app" data='{"status":"error"}'>
  <div *switch="$data.status">
    <p *case="'ok'">All good</p>
    <p *case.break="'error'">Something went wrong</p>
    <p *default>Unknown status: <span *print="$switch"></span></p>
  </div>
</serc-rod>
```

Using a function as a case expression:

```html
<serc-rod id="range-switch" data='{"value": 42}'>
  <div *switch="$data.value">
    <p *case="(v) => v < 0">Negative</p>
    <p *case="(v) => v === 0">Zero</p>
    <p *case.break="(v) => v > 0">Positive (and stop)</p>
    <p *default>Unreachable default</p>
  </div>
</serc-rod>
```

Membership via list syntax:

```html
<serc-rod id="role-switch" data='{"role":"admin"}'>
  <div *switch="$data.role">
    <p *case="'guest' | 'anonymous'">Guest mode</p>
    <p *case.break="'user' | 'admin'">Signed-in user</p>
    <p *default>Other role: <span *print="$switch"></span></p>
  </div>
</serc-rod>
```


#### Notes

- `*case.break` and `n-case.break` are only meaningful under a `*switch` or `n-switch` host.
- The case expression of `*case.break` is evaluated with access to `$switch` and all outer scope variables.
- `*case.break` uses exactly the same matching rules as `*case`; it only differs by also acting as a break.
- A branch with `*case.break` will stop fallthrough even if it appears before `*default`, so that default branch will not run.
- For loop control inside `*for` or `*each`, use `*break` rather than `*case.break`; they are separate directives with different purposes.
