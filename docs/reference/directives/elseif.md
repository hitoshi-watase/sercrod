### *elseif

#### Summary

`*elseif` defines an else-if branch inside a `*if / *elseif / *else` chain. Only one branch of the chain is rendered. The attribute form `n-elseif` is available and behaves identically.:contentReference[oaicite:0]{index=0}

The short built-in manual text describes it as:

- “else-if branch paired with a preceding *if or *elseif.”:contentReference[oaicite:1]{index=1}


#### Description

`*elseif` is a structural directive that participates in a sibling chain together with `*if` and `*else`. The chain is evaluated from left to right:

- The left-most `*if` (or `n-if`) in the group is the head of the chain.:contentReference[oaicite:2]{index=2}
- Each `*elseif` (or `n-elseif`) provides an additional condition that is only checked if all previous `*if` / `*elseif` conditions were false.
- An optional `*else` can be used as a final fallback when no condition in the chain matched.:contentReference[oaicite:3]{index=3}

The engine guarantees that at most one branch of a chain is rendered. All decisions are made at the head `*if` node; each branch is then cloned or skipped as needed.:contentReference[oaicite:4]{index=4}


#### Basic example

```html
<ul>
  <li *if="score >= 90">Grade A</li>
  <li *elseif="score >= 80">Grade B</li>
  <li *elseif="score >= 70">Grade C</li>
  <li *else>Grade F</li>
</ul>
```

In this example:

- If `score >= 90`, only the first `<li>` is rendered.
- If not, but `score >= 80`, only the second `<li>` is rendered.
- If not, but `score >= 70`, only the third `<li>` is rendered.
- Otherwise, only the `*else` branch is rendered.

Semantically it works like a classic `if / else if / else` chain in JavaScript.:contentReference[oaicite:5]{index=5}


#### Behavior

##### Chain formation (how *elseif joins *if)

`*elseif` never works alone. It must be part of a chain headed by a `*if` (or `n-if`) on a preceding sibling:

- For every element, Sercrod checks whether it has any of `*if`, `*elseif`, or `*else` (or their `n-` forms).:contentReference[oaicite:6]{index=6}
- If the current element has `*if` / `n-if`, it is considered the head of a chain.
- If the current element has `*elseif` or `*else` (no `*if`), Sercrod searches to the left among previous siblings for the nearest element that has `*if` or `n-if`.:contentReference[oaicite:7]{index=7}
  - The search stops early if it encounters a sibling that has none of `*if`, `*elseif`, or `*else`. In that case, the `*elseif` cannot join a chain through that sibling.
  - If a suitable `*if` is found, that `*if` becomes the head of the chain for this `*elseif`.

If Sercrod cannot find a preceding `*if` for a `*elseif` (or `*else`), that element is treated as an invalid chain and is completely ignored during rendering.:contentReference[oaicite:8]{index=8}

**Important Sercrod-specific constraint**

Because chain membership is determined only through adjacent conditional siblings:

- All branches belonging to a chain must be consecutive siblings that all carry one of `*if`, `*elseif`, or `*else` (or their `n-` forms).
- Any non-conditional element between them terminates the chain.

For example:

```html
<div *if="mode === 'view'">View</div>
<p>separator</p>
<div *elseif="mode === 'edit'">Edit</div>
```

Here the second `div` is **not** part of the first `*if` chain because the `<p>` in between does not have conditional attributes. The `*elseif` cannot find a valid `*if` head and is therefore ignored.

##### Head-only evaluation

Once the head `*if` is known, Sercrod enforces the following rule:

- Only the head `*if` node actually evaluates and resolves the whole chain.
- When `renderNode` is called on a `*elseif` or `*else` node that belongs to a chain, it immediately returns without rendering, because the head has already handled the chain.:contentReference[oaicite:10]{index=10}

This guarantees that the chain is evaluated exactly once, from its head.

##### Collecting the chain

Starting from the head `*if`, Sercrod walks to the right through sibling elements and collects all consecutive conditional siblings belonging to the same chain:

- Each element that has `*if` / `*elseif` / `*else` (or `n-` forms) is added as a branch:
  - `type: "if"` for `*if` / `n-if`
  - `type: "elif"` for `*elseif` / `n-elseif`
  - `type: "else"` for `*else` / `n-else`
- The scan stops when:
  - It encounters an element with none of the conditional attributes, or
  - It encounters another `*if` / `n-if`, which starts a completely new chain.

If the collected list is empty (which should not normally happen once a head is found), nothing is rendered.:contentReference[oaicite:12]{index=12}

##### Branch selection and *elseif conditions

Once Sercrod has the ordered list of branches, it selects exactly one branch:

1. For each branch in order (`if`, then zero or more `elseif`s, then optional `else`):
   - Sercrod starts from the current effective scope (`effScope`).
   - If the branch element has `*let` / `n-let`, Sercrod creates a new branch-local scope that inherits from `effScope`, evaluates the `*let` code into this new scope, and uses it as `branchScope` for this branch only.
2. If the branch type is `"else"`:
   - It is selected only if no previous `if` / `elseif` was selected.
   - After selecting `else`, Sercrod stops looking at later branches.:contentReference[oaicite:15]{index=15}
3. If the branch type is `"if"` or `"elif"`:
   - Sercrod chooses the correct attribute name:
     - For `"if"`: `*if` or `n-if`.
     - For `"elif"`: `*elseif` or `n-elseif`.
   - It reads the expression string from that attribute. Empty strings are treated as “no condition” and will not match.
   - If there is a non-empty expression, it evaluates the condition via the internal `_eval_cond` helper on the `branchScope`.
   - If `_eval_cond` returns true, this branch is selected and no further branches are considered.

If no branch is selected (all conditions are falsy and there is no `*else`), nothing is rendered for this chain.

##### Rendering the chosen branch

When a branch (which may be `*elseif`) has been chosen:

- Sercrod clones the corresponding element node (deep clone, including its children).
- On the clone, it removes the structural control attributes:
  - `*if` / `n-if`
  - `*elseif` / `n-elseif`
  - `*else` / `n-else`
  - `*let` / `n-let`
- It then calls `renderNode` again on this clone with the selected `outScope` (either the branch-local scope or the previous `effScope`).
- The original template nodes (including the original `*elseif` template) are not rendered directly; they act only as templates.

As a result, the output DOM contains only the chosen branch, without `*if`, `*elseif`, `*else`, or branch-local `*let` attributes.

##### n-elseif

The `n-elseif` attribute is a direct alias of `*elseif`:

- Chains treat `*elseif` and `n-elseif` identically when detecting branches and evaluating conditions.
- Manual entries and user documentation treat `*xxx` and `n-xxx` as the same directive.


#### Evaluation timing

`*elseif` conditions are evaluated during the structural rendering phase of `renderNode`, after `*let` and `*global` have updated the effective scope but before other structural directives like `*switch`, `*each`, and `*for` run on the same host node.

Condition evaluation uses `_eval_cond`, which wraps the general `eval_expr` helper:

- First, the expression is evaluated as a Sercrod expression with `eval_expr`, using a scope that includes:
  - The current branch scope (including local `*let` variables).
  - `$data` for the host data.
  - `$root` for root data.
  - `$parent` injected from the nearest ancestor Sercrod host.
  - Any methods configured via `*methods` and built-in internal methods.
- Then `_eval_cond` normalizes the value into a boolean:
  - `false`, `null`, and `undefined` are false.
  - Numbers are false only when `0` or `NaN`.
  - Strings are false when empty or equal (case-insensitive) to `"false"`, `"0"`, `"null"`, or `"undefined"`. All other non-empty strings are true.
  - Any other values are converted with JavaScript `Boolean(...)`.:contentReference[oaicite:24]{index=24}
- If evaluating the expression throws an error, `_eval_cond` falls back to:
  - Interpreting literal `"true"` and `"false"` strings directly.
  - Otherwise logging a warning (when enabled) and returning false.:contentReference[oaicite:25]{index=25}

This means `*elseif="flag"` and `*elseif="'false'"` behave differently: `flag` depends on the runtime value of `flag`, but the literal string `"false"` is considered falsy by the helper.


#### Execution model

Sercrod’s overall update flow re-renders the host’s children from the stored template on each update call.:contentReference[oaicite:26]{index=26} Within that flow, a `*if / *elseif / *else` chain is a structural (“returning”) directive group:

- The chain decides which branch (if any) to render.
- Exactly one branch is cloned and rendered; the others are ignored.
- Because the entire DOM subtree is reconstructed from the template on each update, the active `*elseif` branch can change between updates.

The clone of the chosen branch then runs all non-structural directives (such as `*print`, `:class`, event bindings, etc.) as part of regular element rendering.


#### Variable creation

`*elseif` itself does not create variables, but it interacts closely with `*let` on the same element:

- When a branch (including `*elseif`) has a `*let` or `n-let` attribute:
  - Sercrod creates a new local scope whose prototype is the current effective scope (`effScope`).
  - It runs `eval_let` in this new scope, allowing the branch to define local variables.
  - This branch-local scope is then used to evaluate the `*if` / `*elseif` condition and to render the chosen branch if it is selected.
- Branch-local variables do **not** leak into the outer host or into other branches.

Example:

```html
<div *if="user">
  <p *let="full = user.first + ' ' + user.last">
    Hello, %full%!
  </p>
</div>
<div *elseif="guest">
  <p *let="label = 'Guest ' + guest.id">
    Hello, %label%!
  </p>
</div>
<div *else>
  <p>Hello, anonymous visitor.</p>
</div>
```

In this pattern, `full` and `label` exist only inside their respective branches.


#### Scope layering

`*elseif` uses the same scope layering as `*if`:

- The starting scope for chain evaluation is the effective scope (`effScope`) after top-level `*let` and `*global` on the host element have run.
- Each branch can further extend this scope with a branch-local `*let`.
- Expressions inside `*elseif` have access to:
  - Host data via `$data`.
  - Root data via `$root`.
  - Parent host data via `$parent`.
  - Shared methods from `*methods` and internal utilities.

If a `*if / *elseif / *else` group is nested inside loops (`*for`, `*each`) or inside other components, the loop/parent scopes are simply part of the normal scope chain and are available to the `*elseif` condition.


#### Parent access

Because `eval_expr` injects `$parent` into the evaluation scope when it is not already defined, `*elseif` conditions can safely refer to properties of the parent Sercrod host’s data.

Typical patterns:

```html
<div *if="$parent.mode === 'edit'">Edit in parent context</div>
<div *elseif="$parent.mode === 'view'">View in parent context</div>
<div *else>Other mode</div>
```

This works regardless of whether the chain is inside loops, nested components, or other control structures.


#### Use with conditionals and loops

`*elseif` is designed to be combined with other control structures by **nesting**, not by mixing multiple structural directives on the same element.

Common patterns include:

- `*for` with an inner `*if / *elseif / *else` chain:

  ```html
  <ul>
    <li *for="item in items">
      <span *if="item.status === 'ok'">OK: %item.name%</span>
      <span *elseif="item.status === 'pending'">Pending: %item.name%</span>
      <span *else>Unknown: %item.name%</span>
    </li>
  </ul>
  ```

- `*switch` outside, `*if / *elseif / *else` inside a case:

  ```html
  <div *switch="view">
    <section *case="'detail'">
      <div *if="item">Showing details</div>
      <div *elseif="fallbackItem">Showing fallback</div>
      <div *else>No item selected</div>
    </section>
    <section *default>
      Default view
    </section>
  </div>
  ```

In these patterns, the outer constructs (`*for`, `*switch`) decide which subtree is rendered, and the inner `*if` chain refines the result inside that subtree. The scopes provided by the outer structures are available to the `*elseif` conditions via normal scope inheritance.


#### Best practices

- **Keep branches adjacent.**  
  Never insert non-conditional elements between `*if`, `*elseif`, and `*else` branches. Any such element will terminate the chain and can cause `*elseif` to become an invalid chain that is silently ignored.

- **Always start with *if.**  
  Do not start a chain with `*elseif` or `*else`. They must have a preceding `*if` / `n-if` in the same parent to be valid.

- **Use *else for catch-all cases.**  
  When you need a fallback, use `*else` instead of `*elseif="true"`. The helper `_eval_cond` treats literal `"true"` and `"false"` specially only in error situations; using `*else` makes the intent clearer and avoids surprises.:contentReference[oaicite:33]{index=33}

- **Keep conditions simple and predictable.**  
  Remember that strings like `"false"` and `"0"` are treated as false by `_eval_cond`. Prefer real booleans or simple comparisons like `value > 0`, `flag === true`, or `status === 'ok'`.:contentReference[oaicite:34]{index=34}

- **Use branch-local *let for clarity.**  
  When a branch needs derived values, define them with `*let` on the branch itself so the scope is clearly limited to that branch.

- **Prefer nesting over mixing structural directives on one element.**  
  While Sercrod defines an order for processing structural directives, it is clearer and less error-prone to keep one structural directive per element and nest structures in the DOM tree instead of stacking them on the same tag.


#### Examples

##### Example 1: Multi-mode display

```html
<div>
  <p *if="mode === 'view'">Viewing %item.title%</p>
  <p *elseif="mode === 'edit'">Editing %item.title%</p>
  <p *elseif="mode === 'create'">Creating a new item</p>
  <p *else>Please select a mode.</p>
</div>
```

Behavior:

- Exactly one `<p>` is rendered based on `mode`.
- If `mode` is none of `"view"`, `"edit"`, or `"create"`, the fallback `*else` is used.

##### Example 2: Branch-local *let

```html
<section>
  <h2>Order summary</h2>

  <p *if="order">
    <span *let="total = order.price * order.qty">
      Total: %total%
    </span>
  </p>

  <p *elseif="draft">
    <span *let="estimate = draft.price * draft.qty">
      Estimated total: %estimate%
    </span>
  </p>

  <p *else>
    No order or draft found.
  </p>
</section>
```

Here:

- Only one of the paragraphs is rendered.
- `total` and `estimate` variables are branch-local and cannot be seen outside their own branch.

##### Example 3: Avoiding invalid chains

```html
<div *if="status === 'ok'">OK</div>
<div *elseif="status === 'warn'">Warning</div>

<!-- This element breaks the chain -->
<hr>

<div *elseif="status === 'error'">Error</div>
<div *else>Unknown</div>
```

In this layout:

- The first two `div` elements form a valid `*if / *elseif` chain.
- The `<hr>` breaks the chain.
- The later `*elseif` and `*else` do not see the first `*if` as their head, so they form invalid chains and are ignored. Only the first chain participates in rendering.

To fix this, keep the branches adjacent:

```html
<div *if="status === 'ok'">OK</div>
<div *elseif="status === 'warn'">Warning</div>
<div *elseif="status === 'error'">Error</div>
<div *else>Unknown</div>

<hr>
```


#### Notes

- `*elseif` always belongs to a chain with `*if`; it is never evaluated on its own. If it cannot find a preceding `*if` or `n-if` in the same parent without crossing non-conditional siblings, the element is silently ignored.:contentReference[oaicite:37]{index=37}
- `n-elseif` is simply the attribute form of the same directive; all semantics, including chaining and condition evaluation, are identical.
- Only one branch of a chain is ever rendered. If no condition matches and there is no `*else`, the entire chain produces no output.
- Conditions are evaluated using the same expression semantics as other directives, with `$data`, `$root`, `$parent`, and configured methods all available in scope.
