### *case / *case.break

#### Summary

`*case` marks a branch inside a `*switch` / `n-switch` block.
The branch is rendered when the `*switch` expression matches the case condition.
`*case.break` is sugar for “case plus break”: it behaves like `*case`, and additionally stops evaluating later branches.

Key points:

- `*case` and `*case.break` only have an effect as direct children of an element with `*switch` or `n-switch`.
- When a case matches, rendering starts at that branch and continues for later siblings (“fallthrough”) until a break is encountered.
- Branches without any `*case`, `*case.break`, `*default`, or `n-default` are ignored by the switch engine.


#### Basic example

Simple switch over a status value:

```html
<serc-rod id="app" data='{"status":"ready"}'>
  <div *switch="status">
    <p *case="'idle'">Idle</p>
    <p *case="'ready'">Ready</p>
    <p *default>Unknown</p>
  </div>
</serc-rod>
```

Behavior:

- The `<div *switch="status">` itself is not rendered.
- `status` is evaluated once, and its value is exposed to children as `$switch`.
- `*case="'ready'"` matches the value `"ready"`, so that `<p>` is rendered.
- No `*break` is present, but there are no later branches in this example, so nothing else is rendered.


#### Behavior

Inside a `*switch` / `n-switch` host:

- Only direct element children that carry one of:
  - `*case`
  - `n-case`
  - `*case.break`
  - `n-case.break`
  - `*default`
  - `n-default`
  are treated as switch branches.
- Other children (elements without these attributes, or deeper descendants) are ignored by the switch engine.

Selection and fallthrough:

- The switch host evaluates its own `*switch` / `n-switch` expression to produce a value `switchVal`.
- It then scans its direct children in DOM order.
- The first child that satisfies either:
  - a matching `*case` / `*case.break` / `n-case` / `n-case.break`, or
  - a `*default` / `n-default` when no previous branch has matched,
  becomes the starting point.
- That starting branch and all later branches are rendered (“fallthrough”) until a break is hit.

Cloning and attributes:

- For each branch that is rendered, the original child element is cloned.
- On the clone, control attributes are removed:
  - `*case`, `n-case`, `*case.break`, `n-case.break`
  - `*default`, `n-default`
  - `*break`, `n-break`
- The clone is then passed to Sercrod’s normal rendering pipeline with a scope that includes `$switch`.


#### Case expression semantics

`*case` and `*case.break` both use the same matching engine.
They evaluate their attribute value in the current scope (augmented with `$switch`) and compare it to the `*switch` value.

The raw attribute string is processed as follows:

1. Sercrod first tries to evaluate the full expression:

   - The expression is evaluated using `eval_expr(raw, {...scope, $switch: switchVal})`.
   - If evaluation succeeds, the resulting value `v` is matched by type.
   - If evaluation throws, Sercrod falls back to a string-based list mechanism (see below).

2. If evaluation succeeded, the result `v` is matched according to its type:

   - Function:

     - If `typeof v === "function"`, Sercrod calls `v(switchVal, scope)`.
     - If the call returns a truthy value, the case matches.

   - Regular expression:

     - If `v` is a `RegExp`, Sercrod tests `v.test(String(switchVal))`.
     - If the test returns `true`, the case matches.

   - Array:

     - If `Array.isArray(v)` is true, the case matches when any array element is strictly equal to `switchVal` (using `Object.is`).

   - Objects with `has`:

     - If `v` is an object and has a `has` method (for example a `Set`), Sercrod calls `v.has(switchVal)`.
     - If `has` returns truthy, the case matches.

   - Boolean:

     - If `v` is a boolean, its value is used directly.
     - `true` means the case matches; `false` means it does not.

   - Primitive string / number / bigint:

     - For `typeof v` in `{ "string", "number", "bigint" }`, Sercrod compares `v` and `switchVal` with `Object.is`.
     - `Object.is` is used rather than `===`, so `NaN` matches `NaN`, and `+0` and `-0` are distinguished.

   - Any other type:

     - If `v` does not fit any of the above categories, the case does not match.

3. If evaluation failed (expression threw), Sercrod falls back to a token list:

   - The raw string is split on commas and pipes: `/[,|]/`.
   - Each token is trimmed; empty tokens are ignored.
   - For each token `t`:
     - Sercrod tries to evaluate `t` as an expression.
     - If that evaluation fails, it falls back to treating `t` as a string literal.
     - The token value `vv` is then compared to `switchVal` with `Object.is`.
     - If any `vv` matches `switchVal`, the case matches.

This means you can write all of the following:

- Simple literal:

  ```html
  <p *case="'ready'">Ready</p>
  ```

- Multiple values with an array:

  ```html
  <p *case="['ready','done']">Finished</p>
  ```

- Regular expression:

  ```html
  <p *case="/^admin-/">Admin section</p>
  ```

- Predicate function:

  ```html
  <p *case="(value, scope) => value > 10">Large</p>
  ```

- Comma- or pipe-separated list:

  ```html
  <p *case="'ready' | 'done'">Finished</p>
  <p *case="'draft, pending'">Not final</p>
  ```


#### Evaluation timing

Within the host that has `*switch` / `n-switch`:

- The `*switch` expression is evaluated once to obtain `switchVal`.
- This happens as part of the structural rendering phase, after any host-level `*if` / `*elseif` / `*else` chain has been resolved.
- The `*switch` host does not render itself; only its children (cases and default) are rendered.
- For each candidate case branch, the case expression is evaluated when needed:
  - Cases are evaluated in DOM order, stopping at the first branch that matches or the first default that is reached with no matches.
  - Once a starting branch is found, later cases are not evaluated for matching; they participate only in fallthrough rendering.


#### Execution model

At a high level, the switch engine works like this for `*case` and `*case.break`:

1. Evaluate `switchVal` from the host’s `*switch` / `n-switch` expression.
2. Prepare a child scope:
   - Clone the current scope.
   - Inject `$switch = switchVal`.
3. Scan the host’s direct element children in DOM order.
4. For each child `c`:
   - Determine whether it is:
     - a `*case` / `n-case` / `*case.break` / `n-case.break` branch, or
     - a `*default` / `n-default` branch, or
     - neither.
   - Ignore children that are neither case nor default.
5. Before rendering has started (no branch selected yet):
   - If `c` is a default branch:
     - Start rendering from this branch (`falling = true`).
   - Else if `c` is a case branch:
     - Evaluate the case expression with `$switch` in scope.
     - If the match succeeds, start rendering from this branch (`falling = true`).
     - If it does not match, skip this child.
6. After rendering has started (`falling = true`):
   - Clone `c`.
   - Strip control attributes (`*case`, `n-case`, `*case.break`, `n-case.break`, `*default`, `n-default`, `*break`, `n-break`) from the clone.
   - Render the clone with the child scope (which includes `$switch`).
   - Check for break:
     - If the original child `c` has `*break`, `n-break`, `*case.break`, or `n-case.break`, stop the switch here and do not render later branches.

As a result:

- `*case` without `*break` participates in fallthrough: later branches are also rendered.
- `*case.break` behaves as `*case` plus an implicit `*break`.
- A branch with `*break` (or `n-break`) stops rendering after that branch, regardless of the value of the `*break` attribute.


#### Variable creation and scope layering

`*case` and `*case.break` do not create new local variables by themselves.
Instead, they rely on the scope prepared by the switch host:

- `$switch` is injected by the switch host and is available in:
  - case expressions.
  - default branches.
  - the body content of all rendered branches.
- All existing scope variables (from the Sercrod host and outer scopes) remain available.
- Case expressions may introduce additional values via normal Sercrod expressions (for example, calling functions or reading from the data model), but `*case` does not persist any new names into the shared scope.

The scope used inside each branch is effectively:

- A shallow clone of the incoming scope, plus `$switch`.


#### Use with *default and *break

`*case` interacts closely with `*default` and `*break` inside the same `*switch` block.

- `*default` / `n-default`:

  - A default branch is picked only if no earlier case branch has matched.
  - If a default branch is the starting point, it participates in fallthrough exactly like any other branch.
  - The runtime does not enforce that there is only one default; for clarity, you should keep at most one default per switch.

- `*break` / `n-break` on a branch:

  - In a switch context, `*break` is treated as a flag, not as a conditional:
    - If a branch carries `*break` or `n-break`, the switch stops after that branch is rendered.
    - The attribute value is not inspected by the switch engine.
  - This is separate from how `*break` is used in loops; here it simply means “stop fallthrough now”.

- `*case.break` / `n-case.break`:

  - Sugar for `*case="expr" *break`.
  - The expression part participates in case matching exactly like `*case`.
  - The presence of `.break` also marks the branch as a break point:
    - If it is selected as the starting branch, rendering stops after this branch.
    - If rendering has already started earlier and execution reaches a `.break` branch in fallthrough, it will render that branch and then stop.

Example with fallthrough and break:

```html
<serc-rod id="app" data='{"level":2}'>
  <div *switch="level">
    <p *case="1">Level 1</p>
    <p *case="2">Level 2</p>
    <p *case="3" *break>Level 3 (stop here)</p>
    <p *default>Level is 4 or more</p>
  </div>
</serc-rod>
```

- When `level` is `2`:
  - Rendering starts at `*case="2"`.
  - The branch for `2` is rendered.
  - The branch `*case="3" *break` is also rendered.
  - Because of `*break` on the `3` branch, the `*default` branch is not rendered.


#### Use with conditionals and loops

Branches can freely combine `*case` with other directives:

- `*if` on the same element:

  - The case still participates in branch selection based on its case expression.
  - Once selected, the cloned element is rendered by the normal pipeline; any `*if` on that element is evaluated as usual.
  - This means a selected case can still be hidden by a false `*if`.

- `*for`, `*each`, and other structural directives inside the branch:

  - You can place loops inside the body of a branch:

    ```html
    <div *switch="$data.mode">
      <section *case="'list'">
        <ul *each="item of items">
          <li *print="item.label"></li>
        </ul>
      </section>
      <section *default>
        <p>No list available.</p>
      </section>
    </div>
    ```

  - You can also put `*for` or `*each` on the same element as `*case`:

    ```html
    <div *switch="view">
      <ul *case="'list'" *each="item of items">
        <li *print="item.label"></li>
      </ul>
      <p *default>Select a view.</p>
    </div>
    ```

    In this pattern:

    - The `<ul>` is chosen as the branch when `view` is `"list"`.
    - After selection, `*each` is evaluated on the cloned `<ul>` as usual.

- Nested switches:

  - A case branch can itself contain another `*switch` / `n-switch` block; the inner switch sees its own `$switch` value.
  - Outer `$switch` remains accessible via the parent scope if you store it in data or pass it through.


#### Best practices

- Prefer simple case expressions where possible:

  - Literal values (`'ready'`, `1`, `"admin"`) keep the logic easy to read.
  - Arrays, sets, regular expressions, and predicate functions are powerful but should be used where they clearly add value.

- Use `*case.break` for the common “match and stop” pattern:

  - This keeps the markup compact:

    ```html
    <p *case.break="'ready'">Ready</p>
    ```

- Use fallthrough intentionally:

  - If you omit breaks, later branches will be rendered as part of the same switch pass.
  - Use this to group related output or to build a sequence of messages.
  - Avoid “accidental fallthrough” by placing `*break` or using `*case.break` where you expect a strict one-branch behavior.

- Keep branch ordering explicit:

  - Sercrod always processes branches in DOM order.
  - Place more specific cases before more general ones when using patterns such as regular expressions or predicate functions.

- Keep switch blocks shallow:

  - Since only direct children of the `*switch` host participate as branches, keep the branch markers (`*case`, `*case.break`, `*default`) at the top level under the host.
  - Nested `*case` under additional wrappers are not seen by the switch engine.


#### Additional examples

Multiple values and regular expression:

```html
<serc-rod id="router" data='{"path":"/admin/users"}'>
  <div *switch="path">
    <p *case="['/', '/home']">Home</p>
    <p *case="/^\\/admin\\//">Admin area</p>
    <p *default>Unknown path</p>
  </div>
</serc-rod>
```

Predicate function:

```html
<serc-rod id="grader" data='{"score":82}'>
  <div *switch="score">
    <p *case="value => value >= 90">Grade A</p>
    <p *case="value => value >= 80">Grade B</p>
    <p *case="value => value >= 70">Grade C</p>
    <p *default>Needs improvement</p>
  </div>
</serc-rod>
```

Here the first predicate that returns `true` determines the starting branch, and fallthrough behavior applies as usual.


#### Notes

- `*case`, `n-case`, `*case.break`, and `n-case.break` are only meaningful as direct children of a `*switch` / `n-switch` host.
  - Outside that context, they are treated as normal attributes and have no special effect.

- `$switch` is injected by the switch host and is available:
  - Inside case expressions.
  - Inside default branches.
  - Inside the rendered content of all selected branches.

- The runtime does not enforce a single default branch.
  - For readability and to avoid surprising fallthrough, it is recommended to keep at most one `*default` / `n-default` per switch.

- In a switch context, `*break` / `n-break` on a branch is treated as a flag; the attribute value is not inspected for match conditions.
  - Expression-based break behavior belongs to loop contexts and is documented separately.

- `*case.break` / `n-case.break` are pure sugar for “case plus break”.
  - They share the same expression semantics as `*case` / `n-case`.
  - They additionally guarantee that the switch stops after rendering that branch.
