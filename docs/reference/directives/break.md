### *break

#### Summary

`*break` is a control directive used inside `*switch` blocks.
It stops the `*switch` fallthrough after the current branch has been rendered.
The alias `n-break` behaves the same.

In addition, `*case.break` is a shorthand that combines `*case` and `*break` on a single element:

- `*case.break="expr"` is equivalent to `*case="expr" *break`.


#### Basic example

A typical `*switch` with a breaking case:

```html
<serc-rod id="app" data='{"status":"ready"}'>
  <div *switch="status">
    <p *case="'idle'">Idle…</p>

    <!-- Match "ready" and then stop evaluating later branches -->
    <p *case.break="'ready'">Ready</p>

    <!-- Never rendered, because the previous branch breaks -->
    <p *case="'ready'">Also ready (not reached)</p>

    <!-- Never reached in this example -->
    <p *default>Unknown status</p>
  </div>
</serc-rod>
```

Conceptually:

- `*case.break="'ready'"` matches when `status === "ready"`.
- That branch is rendered.
- Because it is a breaking branch, the `*switch` stops and later siblings are not evaluated or rendered.


#### Behavior

`*break` and `*case.break` are interpreted only in the context of `*switch`:

- Location:

  - Only direct child elements of a `*switch` host are considered.
  - Text nodes and non-element nodes are ignored.

- Branch types:

  - `*case` or `n-case` define a normal case.
  - `*case.break` or `n-case.break` define a case that also breaks after rendering.
  - `*default` or `n-default` define the fallback branch if no case matched.

- Breaking rules:

  - If a branch element has `*break` or `n-break`, the `*switch` stops after rendering that branch.
  - If a branch element uses `*case.break` or `n-case.break`, the `*switch` stops after rendering that branch.
  - Later siblings in the `*switch` body are not evaluated or rendered.

Important limitations:

- `*break` does not evaluate its attribute value in `*switch` blocks.
  - `*break="expr"` is treated the same as `*break` without a value.
- As of the current implementation, `*break` does not stop `*for` or `*each` loops.
  - The internal short text may mention loops, but loop control is not wired to `*break`.
  - Placing `*break` inside a `*for` or `*each` body has no special effect on those loops.

Aliases:

- `*break` and `n-break` are equivalent.
- `*case.break` and `n-case.break` are equivalent.


#### Evaluation timing

`*break` participates in the evaluation of `*switch` as follows:

- The `*switch` host evaluates its expression once and stores the result in `$switch` for children.
- Sercrod walks the direct child elements of the `*switch` host from top to bottom.
- It decides when to start "falling through" (rendering) by matching `*case` and `*case.break` against `$switch`, or by reaching `*default`.
- Once falling has started:

  - Each child element in the fallthrough range is rendered in order.
  - After rendering each such branch, Sercrod checks the original branch element for:
    - `*break` or `n-break`
    - `*case.break` or `n-case.break`
  - If any of those are present, the walk stops and no further children of the `*switch` are processed.

Notes:

- The check for `*break` and `*case.break` happens after rendering the branch, but it is based on the original element’s attributes.
- The clone used for rendering has control attributes removed so they do not leak into the final HTML.


#### Execution model

Conceptually, for a `*switch` host:

1. Evaluate the `*switch` expression and store it as `$switch` for children.
2. Collect the direct child elements.
3. Iterate over those children in DOM order.

   - Determine whether each child is:
     - A `*case` or `n-case` branch.
     - A `*case.break` or `n-case.break` branch.
     - A `*default` or `n-default` branch.
     - Something else (ignored by the switch controller).

4. Until the first matching branch is found, nothing is rendered.
5. Once a matching branch (or `*default`) is found, enter "fallthrough" mode:

   - For each branch in fallthrough mode:
     - Clone the original node.
     - Strip control attributes (`*case`, `*default`, `*case.break`, `*break`, and their `n-` aliases).
     - Render the clone with the child scope (which includes `$switch`).
     - Inspect the original node for breaking attributes:
       - `*break`, `n-break`, `*case.break`, or `n-case.break`.
     - If any breaking attribute is present, stop the loop.

6. Other non-branch child nodes (such as comments or text) are ignored by the switch controller.

There is no separate execution path for `*break` outside of `*switch`; other directives do not consult it.


#### Variable creation

`*break` does not create any variables:

- It does not introduce new names into the scope.
- It does not affect `$switch`, `$data`, `$root`, or `$parent`.
- It is purely a structural control flag for `*switch`.

Similarly, `*case.break` uses the same expression as `*case`:

- The value of `*case.break="expr"` is evaluated by the same mechanism that handles `*case="expr"`.
- No additional variables are created by using `.break`.


#### Scope layering

In a `*switch` block:

- Child branches are evaluated with a scope that merges:

  - The parent scope at the point where the `*switch` appears.
  - A `$switch` property that holds the evaluated value of the `*switch` expression.

- `*break` and `*case.break` do not change the scope.
- Using `*break` does not affect variable visibility or lifetime; it only shortens which branches are processed.


#### Parent access

`*break` does not alter the way parents are accessed:

- Branch bodies can still access:

  - Host data via whatever property names you used in `data`.
  - `$root` for the root Sercrod host’s data.
  - `$parent` for the nearest ancestor Sercrod host’s data.
  - Methods injected via `*methods` or configuration.

- `*break` does not expose any special information about the `*switch` beyond what `$switch` already provides.


#### Use with conditionals and loops

Within `*switch` bodies:

- You can combine `*break` or `*case.break` with normal conditionals and content:

  - `*if` inside the branch body is independent of `*break`.
  - Nested `*switch` blocks inside the body work as usual; their own `*break` only affects the inner switch.

Example pattern with an inner `*if`:

```html
<div *switch="status">
  <p *case.break="'ready'">
    <span *if="$root.showLabel">Ready</span>
  </p>
  <p *default>Other status</p>
</div>
```

Interaction with `*for` and `*each`:

- As of the current implementation:

  - `*break` has no special effect on `*for` or `*each` loops.
  - Loops do not consult `*break` when iterating.
  - Writing `*break="expr"` inside a `*for` or `*each` body does not stop the loop.

- If you need to stop rendering items based on a condition, you must express that either by:

  - Pre-filtering the collection.
  - Using conditionals (`*if`) inside the loop body.
  - Or reorganizing your data so that the loop naturally contains only the items you want to show.


#### Best practices

- Prefer `*case.break` for "match and break":

  - Use `*case.break="expr"` when you want:
    - The branch to act like a case.
    - The switch to stop after that branch.

- Use `*break` on a branch only when you need to:

  - Separate the matching logic from the breaking logic.
  - For example, when the decision to break is expressed structurally rather than by choosing `.break`.

- Keep `*break` close to `*case`:

  - Treat `*case="expr" *break` as equivalent to `*case.break="expr"`.
  - Choose one style per codebase for readability.

- Do not rely on `*break` in loops:

  - Even though the short text mentions loops, there is no loop control implemented for `*break` at this time.
  - Express loop cutoffs using data and conditionals instead of `*break`.

- Limit `*break` to child elements of `*switch`:

  - Placing `*break` on elements that are not direct children of a `*switch` host has no special effect.
  - In such locations, it behaves as a non-interpreted attribute.


#### Examples

Unconditional break with `*break`:

```html
<serc-rod id="app" data='{"status":"processing"}'>
  <div *switch="status">
    <p *case="'processing'" *break>Processing…</p>
    <p *case="'processing'">Also processing (not reached)</p>
    <p *default>Fallback (not reached)</p>
  </div>
</serc-rod>
```

- The first `*case` matches and renders.
- Because it also has `*break`, the following branches are skipped.

Mixed fallthrough with one breaking branch:

```html
<serc-rod id="app" data='{"status":"multi"}'>
  <div *switch="status">
    <p *case="'multi'">First line</p>
    <p *case="'multi'">Second line</p>
    <p *case.break="'multi'">Third line, then break</p>
    <p *case="'multi'">Fourth line (not reached)</p>
    <p *default>Default (not reached)</p>
  </div>
</serc-rod>
```

- All three `*case` branches for `"multi"` are rendered in order until the `.break` case.
- After the `.break` branch, the `*switch` stops and no further siblings are evaluated.


#### Notes

- `*break` and `n-break` are aliases that only have meaning inside `*switch` children.
- `*case.break` and `n-case.break` are equivalent shorthands for `*case + *break`.
- The current implementation:

  - Removes control attributes (`*case`, `*default`, `*case.break`, `*break`, and their `n-` aliases) from the clones that are actually rendered, so these do not appear in the final HTML.
  - Checks for breaking attributes on the original nodes only.
  - Does not connect `*break` to `*for` or `*each` loops.

- If you need loop-level early termination, use data modeling and conditionals rather than `*break`.
