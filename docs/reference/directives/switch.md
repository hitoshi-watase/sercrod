### *switch

#### Summary

`*switch` selects one branch from its direct children based on an expression, then renders that branch and optionally falls through to later branches until a break is reached.
It behaves like a JavaScript `switch` statement with fallthrough, but is expressed as HTML attributes on a single container element.

Key points:

- The element with `*switch` is not rendered itself; only its matching `*case` / `*default` children are rendered.
- Only direct child elements that declare `*case`, `*case.break`, or `*default` (or their `n-` aliases) participate in the switch.
- Fallthrough is explicit and controlled with `*break` or `*case.break` on the same child element.
- The evaluated switch value is exposed to children as `$switch`.

Aliases:

- `*switch` and `n-switch` are aliases.
- Child branch attributes also have `n-` aliases: `*case`, `n-case`, `*case.break`, `n-case.break`, `*default`, `n-default`, `*break`, `n-break`.


#### Basic example

A simple status switch:

```html
<serc-rod id="app" data='{"status":"ready"}'>
  <div *switch="status">
    <p *case="'idle'">Waiting…</p>
    <p *case="'ready'">Ready</p>
    <p *case="'running'">Running</p>
    <p *default>Unknown status</p>
  </div>
</serc-rod>
```

Behavior:

- Sercrod evaluates `status` on the `*switch` element.
- It scans the direct child elements of the `div` in DOM order.
- The first `*case` whose expression matches `status` becomes the entry point.
- That `p` and all subsequent `*case` / `*default` elements are rendered until a break is encountered.
- If no `*case` matches, the first `*default` is used instead.
- The `<div *switch="…">` itself is not rendered; only the chosen branch elements appear in the final DOM.


#### Behavior

`*switch` is a structural directive applied to a single container element.

On each render:

- Sercrod evaluates the `*switch` (or `n-switch`) expression on the host.
- The evaluated value is stored in a local variable `$switch` and passed to all branch expressions and branch bodies.
- Sercrod iterates over the host’s **direct child elements** in DOM order.
- It treats only children that declare:

  - `*case`, `n-case`
  - `*case.break`, `n-case.break`
  - `*default`, `n-default`

  as branches. All other children are ignored for this switch.

Branch selection and fallthrough:

- Before any branch has been selected, Sercrod looks for:

  - The first `*case` / `n-case` / `*case.break` / `n-case.break` whose expression matches the switch value.
  - Or, if no case has matched yet, the first `*default` / `n-default`.

- Once a branch is selected, Sercrod:

  - Clones that child node.
  - Strips the control attributes (`*case`, `*case.break`, `*default`, `*break` and their `n-` aliases) from the clone.
  - Renders the clone as a normal element with `_renderElement`, using a scope that includes `$switch`.

- Sercrod then continues to the **next** eligible branch child (fallthrough) and repeats the process until a break is encountered or there are no more branch children.

Important structural details:

- Only direct child elements participate.
- All descendants inside a branch are rendered normally; they can use any other directives (`*if`, `*for`, `*each`, `*include`, `*import`, bindings, events, etc.).
- Siblings of the `*switch` host element are unaffected.


#### Case expressions

Each `*case` / `n-case` / `*case.break` / `n-case.break` attribute holds an expression used to test against the evaluated switch value.

Expression evaluation:

- Sercrod evaluates the case expression with an extended scope that includes `$switch`:

  - You can reference `$switch` directly inside the case expression if you need it.
  - All other data and helpers available on the switch host are also accessible.

- If the expression evaluates successfully, matching behavior depends on the resulting type:

  - **Function:** Treated as a custom predicate.

    - The result is `true` if `fn($switch, scope)` returns a truthy value.

  - **RegExp:** Treated as a pattern.

    - The result is `true` if `regexp.test(String($switch))` returns `true`.

  - **Array:** Treated as a list of allowed values.

    - The result is `true` if any element of the array matches the switch value.

  - **Set-like object:** Any object with a `.has()` method.

    - The result is `true` if `set.has($switch)` returns `true`.

  - **Boolean:** Used directly.

    - `true` means the case matches, `false` means it does not.

  - **Other values (primitives, objects without `.has`, etc.):**

    - The value is compared to the switch value using Sercrod’s internal equality check.

- If evaluation throws, or none of the above patterns succeed, Sercrod falls back to a simple string-list matcher:

  - The raw attribute text is split by `,` and `|` into tokens.
  - Each token is trimmed and evaluated as an expression when possible.
  - If evaluating a token fails, it is used as a literal.
  - If any token’s result equals the switch value, the case matches.

Common patterns:

- Simple value:

  ```html
  <p *case="'ready'">Ready</p>
  ```

- Multiple string values in one case:

  ```html
  <p *case="'idle' | 'waiting'">Waiting…</p>
  ```

- Predicate function:

  ```html
  <p *case="(val) => val > 10">Large value</p>
  ```

- Regular expression:

  ```html
  <p *case="/^error:/">Error</p>
  ```

- Array / Set of allowed values:

  ```html
  <p *case="['draft','pending']">Not published</p>
  ```


#### Evaluation timing

`*switch` participates in Sercrod’s structural evaluation in this order:

- Host-level `*let` / `n-let` are evaluated first, so they can influence the switch expression and case expressions.

- Host-level `*if` / `*elseif` / `*else` chains are resolved **before** `*switch`:

  - If a `*switch` element is part of a conditional chain, Sercrod first selects the active branch of that chain.
  - It then renders only that chosen branch node, and `*switch` is applied to that branch node as usual.

- After the `*if` chain, Sercrod looks for `*switch` / `n-switch` on the (possibly cloned) working node.

- If `*switch` is present:

  - Sercrod runs `_renderSwitchBlock`, which renders only the selected cases/defaults.
  - The host element itself is not rendered.
  - Sercrod does not proceed to other structural directives on that host (`*each`, `*for`, `*template`, `*include`, `*import`).

- Child directives inside each case/default are evaluated during `_renderElement` for the case clone:

  - `*if`, `*for`, `*each`, `*include`, `*import`, bindings, events, and so on behave as usual inside each branch.
  - Each branch is rendered with its own scope that includes `$switch`.


#### Execution model

Conceptually, the runtime performs these steps for `*switch`:

1. **Evaluate switch expression**

   - Read `*switch` or `n-switch` from the host element.
   - Evaluate the expression with the current effective scope to obtain `switchVal`.

2. **Prepare child scope**

   - Construct `childScope` as a shallow copy of the host scope extended with `$switch: switchVal`.
   - This scope is used both for case-expression evaluation and for rendering branch bodies.

3. **Scan direct children**

   - Collect direct child nodes of the host into an array.
   - Iterate over them in DOM order.
   - Ignore any node that is not an element.
   - For each element, determine whether it is:
     - A default branch (`*default` / `n-default`).
     - A case branch (`*case`, `n-case`, `*case.break`, `n-case.break`).
     - Or not part of the switch at all (no case/default attributes).

4. **Select entry branch**

   - While no branch has been selected (`falling === false`):

     - If the child is a default branch and no earlier case has matched, start fallthrough from this default.
     - Otherwise, if it has a case expression:
       - Evaluate the case expression using `_matchCase` with `$switch`.
       - If it matches, set `falling = true`.
       - If not, skip this child and continue scanning.

5. **Render fallthrough**

   - Once `falling` becomes `true`:

     - Clone the case/default child (`cloneNode(true)`).
     - Strip the control attributes from the clone:
       - `*case`, `n-case`, `*default`, `n-default`, `*case.break`, `n-case.break`, `*break`, `n-break`.
     - Call `_renderElement` on the clone with `childScope` and the parent of the original switch host.
       - The clone’s descendants are rendered normally.

6. **Break handling**

   - After rendering each branch child, Sercrod checks the original child element for break markers:

     - If it has any of `*break`, `n-break`, `*case.break`, `n-case.break`, Sercrod stops the scan and does not consider any later branches.
     - The value of the `*break` attribute is not evaluated by the `*switch` implementation; it is treated as a simple presence marker in this context.

7. **Host element**

   - The original `*switch` node itself is not appended to the output DOM.
   - Only the rendered clones of case/default children appear in the final tree.


#### Variable creation and scope layering

`*switch` does not introduce new data variables by itself, but it adds a special helper:

- `$switch` is injected into the scope used for case expressions and case bodies:

  - Inside `*case` / `*default` branches you can read `$switch` directly.
  - `childScope` also inherits all existing data:

    - Root data bound on `<serc-rod>` (for example `data='{"status":"ready"}'`).
    - Any variables created by `*let` on the switch host or ancestors.
    - Methods and globals configured via Sercrod’s configuration.

Scope behavior:

- When you use `*let` on the `*switch` host, those variables are available to both the switch expression and case expressions, as well as to branch bodies.
- Branch-specific `*let` directives on case/default nodes work as usual and can introduce additional local variables.


#### Parent access

`*switch` runs within the normal Sercrod scope chain:

- `$root` continues to refer to the root data of the Sercrod world.
- `$parent` continues to refer to the nearest ancestor Sercrod host’s data.
- `$switch` is just an additional helper, not a replacement for existing parent or root access.

Inside case/default branches:

- All bindings and expressions see the extended `childScope`, which includes:

  - Normal data access (for example `status`, `user`, `config`).
  - `$root`, `$parent`, other Sercrod helpers.
  - `$switch` with the current switch value.


#### Use with conditionals and loops

`*switch` composes with other control-flow directives, but you need to be aware of where each directive is placed.

Host-level conditionals:

- When `*switch` appears on a node that is also part of a `*if` / `*elseif` / `*else` chain:

  - Sercrod first resolves the conditional chain and selects exactly one branch element.
  - That branch is cloned, stripped of its conditional attributes, and passed to `renderNode`.
  - `*switch` on that chosen branch then executes normally.

Example:

```html
<div *if="mode === 'simple'" *switch="status">
  <p *case="'ready'">Simple / Ready</p>
  <p *case="'running'">Simple / Running</p>
  <p *default>Simple / Unknown</p>
</div>
<div *elseif="mode === 'advanced'" *switch="status">
  <p *case="'ready'">Advanced / Ready</p>
  <p *default>Advanced / Other</p>
</div>
<div *else>
  <p>No switch here</p>
</div>
```

- Only one of the three outer `<div>` elements is chosen by the conditional chain.
- If the chosen branch has `*switch`, it runs on that branch node as usual.

Branches containing loops:

- You can safely use `*for` / `*each` inside case/default branches:

  ```html
  <serc-rod id="app" data='{
    "status":"list",
    "items":["A","B","C"]
  }'>
    <section *switch="status">
      <p *case="'empty'">No items.</p>
      <ul *case="'list'">
        <li *for="item of items" *print="item"></li>
      </ul>
      <p *default>Unknown mode.</p>
    </section>
  </serc-rod>
  ```

- In this example, the `*switch` selects the `<ul>` branch for `"list"`, and then `*for` runs inside that branch to render `<li>` elements.

Loops containing switches:

- You can also put `*switch` inside a loop body:

  ```html
  <ul>
    <li *for="item of items">
      <span *print="item.name"></span>
      <span *switch="item.status">
        <span *case="'active'">Active</span>
        <span *case="'inactive'">Inactive</span>
        <span *default>Unknown</span>
      </span>
    </li>
  </ul>
  ```

- Here, each iteration of the `*for` loop receives its own `*switch` evaluation for `item.status`.


#### Use with templates, *include and *import

`*switch` is itself a structural directive that controls which children are rendered and how they are cloned.
On the **same host element**, Sercrod processes `*switch` **before** other structural directives like `*each`, `*for`, `*template`, `*include`, and any helpers built on top of them (such as `*import`).

Structural restriction on the host element:

- When a node has `*switch` or `n-switch`, Sercrod:

  - Executes the switch block for that node.
  - Does not render the host element itself.
  - Does not run other structural host-level logic such as:

    - `*each` / `n-each`
    - `*for` / `n-for`
    - `*template` / `n-template`
    - `*include` / `n-include`
    - Any higher-level helpers that rely on these (for example, an `*import` helper built on `*include` / `*template`).

- Practically, this means:

  - If you put `*switch` together with `*each`, `*for`, `*include`, `*import`, or `*template` on the same element, `*switch` takes over and the other directive will not behave as you might expect.
  - Sercrod treats the `*switch` host as a pure container for branch children.

Recommended pattern:

- Use `*switch` on a dedicated container element:

  ```html
  <section *switch="view">
    <div *case="'list'">
      <ul *include="'item-list-template'"></ul>
    </div>
    <div *case="'detail'">
      <article *import="'item-detail-template'"></article>
    </div>
    <p *default>Select a view.</p>
  </section>
  ```

- Move loops (`*for` / `*each`) and template includes (`*include`, `*import`) into the individual branch elements, not onto the same element that owns `*switch`.

What is allowed:

- Inside a case/default branch (on the child element), you are free to combine:

  - `*case` / `*default` with `*for`, `*each`, `*include`, `*import`, and other directives.
  - The branch node is cloned and then passed to the normal element renderer, so structural directives on the branch node itself work as usual.


#### Best practices

- Keep the switch host simple:

  - Use `*switch` on a neutral container (such as `<div>`, `<section>`, `<span>`) whose only job is to hold branch elements.
  - Avoid attaching other structural directives to the same host.

- One branch per element:

  - Treat each `*case` / `*default` element as the root of one branch.
  - If you need multiple siblings in a branch, wrap them in a container that carries `*case` or `*default`.

- Prefer simple case expressions:

  - Start with basic patterns such as string literals (`'ready'`), value lists (`'a' | 'b'`), or small predicate functions.
  - Use regular expressions, arrays, or Sets when they clearly simplify your intent.

- Use `$switch` for clarity:

  - When a case expression does more than simple equality, make the dependency on the switch value explicit:

    ```html
    <p *case="(v) => v && v.startsWith('error:')">Error</p>
    ```

- Combine with `*if` only where it simplifies the layout:

  - Prefer a single `*switch` over a long sequence of `*if` / `*elseif` when you are matching on a single value.
  - Use `*if` around `*switch` only when there is a genuine structural difference at a higher level.

- Break explicitly:

  - Use `*case.break` or add `*break` / `n-break` to the last branch you want to render.
  - This makes fallthrough behavior easier to understand.


#### Additional examples

Multiple fallthrough branches:

```html
<serc-rod id="app" data='{"level":"warning"}'>
  <div *switch="level">
    <p *case="'info'">Info: low priority.</p>
    <p *case="'warning'">Warning: check this.</p>
    <p *case.break="'error'">Error: action required.</p>
    <p *default>Fallback message.</p>
  </div>
</serc-rod>
```

- If `level` is `'warning'`, the second `<p>` matches and fallthrough continues, rendering:

  - `Warning: check this.`
  - `Error: action required.`

- Because the third `<p>` uses `*case.break`, rendering stops there and the `*default` branch is not rendered.

Simple default-only switch:

```html
<div *switch="status">
  <p *case="'ready'">Ready</p>
  <p *default>Not ready yet</p>
</div>
```

Using `$switch` inside the branch body:

```html
<div *switch="status">
  <p *case="'error'">
    Status is <strong *print="$switch"></strong>.
  </p>
  <p *default>Everything looks fine.</p>
</div>
```


#### Notes

- `*switch` / `n-switch` are structural and control only which direct children are rendered; the host element itself is not output.
- Only elements marked with `*case` / `n-case` / `*case.break` / `n-case.break` / `*default` / `n-default` participate in the switch; other children of the switch host are ignored.
- `$switch` is available both in case expressions and inside branch bodies.
- `*case.break` and `n-case.break` behave like `*case` / `n-case` with an implicit break: once such a branch is rendered, later branches are not considered for this switch.
- When a branch element has `*break` or `n-break`, it also stops further fallthrough for this switch.
- Combining `*switch` with other host-level structural directives like `*for`, `*each`, `*template`, `*include`, or `*import` on the **same element** is not supported in practice; only `*switch` is applied. Move loops and includes into individual case/default branches or to surrounding elements.
