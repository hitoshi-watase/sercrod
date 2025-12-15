### *else / n-else

#### Summary

`*else` marks the fallback branch of an `*if / *elseif / *else` chain.  
When all previous `*if` and `*elseif` conditions in the same sibling chain are false, Sercrod renders the `*else` branch instead.

`n-else` is a prefix-agnostic alias with identical behavior.


#### Description

`*else` is a structural directive that participates in a contiguous sibling chain together with `*if` and `*elseif`:

- The chain always starts at a sibling whose element has `*if` or `n-if`.
- Zero or more `*elseif` / `n-elseif` branches may follow.
- At most one `*else` / `n-else` is expected at the end of that chain.

At render time, Sercrod:

1. Finds the “head” element for the chain by walking left from the current node until it encounters a sibling with `*if` / `n-if`. If no such element is found, the `*elseif` / `*else` is treated as invalid and ignored.
2. Starting from the head, walks right across siblings as long as each sibling has at least one of `*if`, `*elseif`, or `*else` (or their `n-` equivalents) and they share the same parent. The run of such elements forms a single chain; the next `*if` starts a new chain.
3. Evaluates branches in order:
   - `if` branches first, then `elseif` branches.
   - The first branch whose condition is true becomes the chosen branch.
   - If none of the conditions are true, the `else` branch is chosen (when present).

The `*else` attribute itself never has its value evaluated; Sercrod only checks whether it is present. Any string given as its value is ignored and acts purely as documentation for humans.

Once a branch is chosen, Sercrod clones that element, strips `*if`, `*elseif`, `*else`, and `*let` / `n-let` from the clone, and renders that clone with the computed branch scope into the parent. Exactly one branch per chain is rendered.


#### Basic example

A simple access check with `*if` and `*else`:

```html
<div *if="user && user.isAdmin">
  <p>Welcome, admin.</p>
</div>
<div *else>
  <p>Access denied.</p>
</div>
```

- When `user.isAdmin` is truthy, only the first `<div>` is rendered.
- When `user` is missing or `user.isAdmin` is falsy, the second `<div>` (with `*else`) is rendered instead.
- Both elements share the same parent and form a single chain headed by the first `*if`.


#### Behavior

- **Presence-based directive**  
  `*else` / `n-else` is treated as a boolean marker. Sercrod never reads its value as an expression; only the presence of the attribute matters.:contentReference[oaicite:9]{index=9}

- **Single-branch selection**  
  For each chain, Sercrod selects at most one branch:
  - First matching `*if` or `*elseif` branch wins.
  - If none match, the `*else` / `n-else` branch (if any) is chosen.
  - If there is no `*else` and no condition matches, nothing is rendered for that chain.

- **Template versus clone**  
  The decision is made using the original template elements, but Sercrod renders a clone:
  - The clone has `*if`, `*elseif`, `*else`, and `*let` / `n-let` removed.
  - The clone is then processed as a normal element by `renderNode`.

- **Invalid chains are ignored**  
  - If Sercrod cannot find a head `*if` for a `*else` or `*elseif`, the chain is considered invalid and is ignored; the current node is not rendered as part of any chain.


#### Evaluation timing

- **Chain discovery**  
  When `renderNode` encounters an element with `*if`, `*elseif`, or `*else`, it runs the chain logic exactly once, on the head node of that chain (`node === head`). Any later siblings in the same chain do not re-run the logic themselves.

- **Condition evaluation**  
  For `if` and `elseif` branches:
  - The corresponding attribute (`*if`, `n-if`, `*elseif`, `n-elseif`) is read from the template element.
  - The expression is evaluated with `_eval_cond` against the branch scope derived from the effective scope (and optional branch `*let`).

- **Else evaluation**  
  For `else` branches:
  - There is no condition expression.
  - The branch is selected only if no previous branch has already been chosen.
  - Once the `else` branch is tentatively chosen, iteration ends.

- **Per-update behavior**  
  On each host `update`, the template is re-rendered, the chain is recomputed, and the appropriate branch is re-selected based on the current data. There is no caching of “last chosen” beyond a single render pass.


#### Execution model

- `*else` is a **structural directive**:
  - It controls which sibling element is rendered, but has no effect on DOM mutations beyond the chain.
  - It does not directly modify data; it only selects which subtree to render.

- The chain traversal and selection happen inside the templating engine before any non-structural directives on the chosen clone are processed, so the contents of the chosen branch are then rendered normally (including `*print`, bindings, event handlers, etc.).


#### Variable creation

`*else` / `n-else` does not create any variables on its own.

Within a chain:

- The effective scope for the head `*if` branch is the current scope (`effScope`).
- Each branch can optionally have its own `*let` / `n-let` attribute; when present:
  - Sercrod creates a new branch scope with the current scope as prototype.
  - `eval_let` is executed for that branch to populate the branch scope.
  - That branch scope is used when rendering the chosen clone.

`*else` can therefore see variables defined by its own branch `*let`, but it does not introduce any special names like `$switch` or loop indices by itself.


#### Scope layering

For a typical chain:

- **Base scope**: the effective scope at the point where the chain is rendered (`effScope`).
- **Branch scope**:
  - If a branch has `*let` / `n-let`, Sercrod builds a new scope object that inherits from `effScope` and applies the `let` bindings into it.
  - Otherwise, the branch reuses `effScope` directly.
- **Else branch**:
  - Uses its own branch scope (with or without `*let`), just like `if` and `elseif`.

No additional scope layering is introduced by `*else` itself; it simply participates in the same mechanism as the other branches.


#### Parent access

`*else` does not introduce any new parent-access semantics. Inside expressions used in the chosen branch (for example in `*print` or `*if` nested within the branch), access to:

- Parent scopes,
- Root host data,
- And any Sercrod-specific helper variables

works exactly as it does in any other element. The only responsibility of `*else` is to decide whether this branch is selected as the fallback.


#### Use with conditionals and loops

- **With `*if` / `*elseif`**  
  `*else` must be part of a contiguous run of siblings whose first element is `*if` / `n-if`:
  - Siblings without any of `*if`, `*elseif`, `*else` break the chain.
  - Encountering a new `*if` / `n-if` ends the previous chain and starts a new one.

- **Multiple chains in the same parent**  
  A parent element can host multiple independent chains, each starting at its own `*if`. An `*else` always belongs to the most recent chain whose head is the nearest previous sibling with `*if` / `n-if` and no intervening non-conditional element.

- **Inside loops**  
  `*else` works as expected inside repeated structures such as `*each` or `*for`:
  - Each iteration renders its own copy of the chain.
  - The chain selection runs independently per iteration, based on the iteration’s scope.

- **With `*switch`**  
  `*else` is unrelated to `*switch` / `*case` / `*default`. It is not consulted by the switch machinery; within `*switch`, you should use `*default` for fallback behavior instead of `*else`.


#### Best practices

- Always keep `*else` at the end of a chain, after all `*if` and `*elseif` branches, and with the same parent element.
- Use `*else` for genuinely unconditional fallbacks. If you need a conditional fallback, use an extra `*elseif` instead of an `*else` with a value (since that value is ignored).
- Keep chains contiguous and focused:
  - Avoid inserting unrelated elements between the `*if` head and its `*else`.
  - If you need layout markup between branches, wrap each branch in a container and apply the conditional directive to that container.
- Prefer a single `*else` per chain. While the runtime ignores extra `*else` siblings when a branch has already been chosen, multiple fallback-like elements can be confusing to readers.


#### Examples

##### Multiple chains in the same parent

Two independent chains controlled by different conditions:

```html
<div *if="user">
  <p>Logged in as %user.name%.</p>
</div>
<div *else>
  <p>You are not logged in.</p>
</div>

<div *if="notifications.length > 0">
  <p>You have %notifications.length% notifications.</p>
</div>
<div *else>
  <p>No notifications.</p>
</div>
```

- The first pair (`user` check) forms one chain.
- The second pair (`notifications.length > 0`) forms another, independent chain.
- Each `*else` only belongs to its own chain headed by the preceding `*if`.

##### Using `n-else` with mixed prefixes

You can mix `*if` with `n-else` in the same chain:

```html
<section *if="status === 'ok'">
  <p>All systems go.</p>
</section>
<section n-else>
  <p>Something is wrong.</p>
</section>
```

- The `*if` head uses the `*` prefix.
- The fallback uses the `n-` prefix.
- The implementation checks both `*else` and `n-else` attributes and treats them equivalently.


#### Notes

- `*else` / `n-else` is only meaningful as part of a valid `*if` chain. If Sercrod cannot find a preceding `*if` / `n-if` in the same sibling run, the `*else` is considered part of an invalid chain and is not used in conditional rendering.
- The attribute value of `*else` / `n-else` is ignored; do not rely on it to carry conditions.
- Only one branch per chain is rendered. If you see multiple branches appearing, check that you did not accidentally break the chain by inserting non-conditional siblings or by misplacing `*if`.
- Control attributes `*if`, `*elseif`, `*else`, and `*let` (and their `n-` variants) are removed from the rendered clone, so they never appear in the final DOM.:contentReference[oaicite:23]{index=23}
