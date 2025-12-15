### *default

#### Summary

`*default` is the fallback branch for `*switch` when no `*case` matches.
It participates in a JavaScript-like switch/fall-through model:

- The `*switch` host evaluates an expression once and exposes it as `$switch` to its children.
- The runtime walks child elements in DOM order.
- Rendering starts at the first matching `*case` or, if none match, at the first `*default`.
- From that point it falls through and renders subsequent branches until a break is encountered.

`*default` has an alias `n-default` with the same behavior.


#### Basic example

A simple switch with a default branch:

```html
<serc-rod id="app" data='{"status":"idle"}'>
  <div *switch="status">
    <p *case="'ready'">Ready</p>
    <p *case="'error'">An error occurred</p>
    <p *default>Unknown status</p>
  </div>
</serc-rod>
```

Behavior:

- `*switch="status"` evaluates to `"idle"`.
- No `*case` matches `"idle"`.
- Rendering starts from the first `*default` and falls through (in this example there are no later branches).
- The result is a single `<p>` with “Unknown status”.


#### Behavior

`*default` marks an element as part of the default region of a `*switch` block:

- It has no expression; it does not compare values.
- If no `*case` has started rendering yet and the runtime encounters a `*default`, it starts rendering from that branch.
- If rendering has already started from an earlier `*case` or `*default`, later `*default` branches are treated as part of the fall-through region and are rendered normally.
- `*default` is recognized only inside a `*switch` (or `n-switch`) host and only on its direct child elements.

Alias:

- `*default` and `n-default` are interchangeable; they are treated the same by the switch engine.


#### Evaluation timing

`*default` is evaluated as part of the `*switch` pass, not as an independent directive:

- The `*switch` host evaluates its expression once, before examining children.
- The result of the expression is stored as `$switch` in the child scope.
- The switch engine then walks the host’s child elements (direct children) in DOM order:
  - If it finds a `*case` or `*case.break` whose condition matches `$switch`, it starts rendering from that element.
  - If it reaches a `*default` while rendering has not yet started, it starts rendering from that `*default`.
  - Once rendering has started, subsequent `*case`, `*case.break`, and `*default` elements are part of the fall-through region until a break is seen.

Outside of a `*switch`:

- `*default` has no special scheduling or evaluation.
- It is parsed as an attribute, but there is no separate handler outside `_renderSwitchBlock`, so it does not act as a condition or fallback on its own.
- In practice, you should treat `*default` as “only meaningful directly under a `*switch` or `n-switch` host”.


#### Execution model

The `*switch` execution model (simplified):

1. On the host element that has `*switch` or `n-switch`:
   - Evaluate the switch expression in the current scope to produce `switchVal`.
   - Prepare a `childScope` that includes the original scope plus `$switch: switchVal`.

2. Walk each direct child element of the `*switch` host in DOM order:
   - Compute two flags for each child:
     - `isDefault` if it has `*default` or `n-default`.
     - `caseRaw` if it has any of `*case`, `n-case`, `*case.break`, or `n-case.break`.
   - If neither `isDefault` nor `caseRaw` is present, the child is not a switch branch and is skipped at this stage.

3. Before rendering starts (`falling === false`):
   - If `isDefault` is true:
     - Start rendering from this branch: set `falling = true`.
   - Else if there is a `caseRaw`:
     - Use the internal `_matchCase` helper to compare the case expression with `switchVal`.
     - If it matches, start rendering from this branch: set `falling = true`.
     - If it does not match, skip this child and continue scanning.

4. Once rendering has started (`falling === true`):
   - Clone the branch element.
   - Remove control attributes from the clone:
     - `*case`, `n-case`
     - `*default`, `n-default`
     - `*case.break`, `n-case.break`
     - `*break`, `n-break`
   - Render the clone normally with `childScope` as the scope and append it to the parent.

5. Break handling:
   - After rendering a branch, determine if it has any break-related attributes:
     - `*break`, `n-break`
     - `*case.break`, `n-case.break`
   - If any of these are present on the original branch, stop processing further branches in this `*switch` block.

Notes about `*default` in this model:

- There is no expression to match; its role is simply:
  - “Start the fall-through region here if nothing has matched before.”
- If a `*default` appears after a matching `*case`, it is rendered as part of the fall-through region, similar to how `default:` can appear after other labels in a JavaScript `switch`.


#### Variable creation and scope layering

`*default` does not introduce any new variables by itself.

Inside a `*default` branch:

- You can access everything that is normally visible in the scope:
  - Data bound on the Sercrod host (`data` or similar).
  - Special helpers like `$data`, `$root`, and `$parent`.
  - Methods injected via `*methods` or other configuration.
- You can also access `$switch`, which is injected by the surrounding `*switch` host.

Typical usage:

```html
<div *switch="status">
  <p *case="'ready'">Ready</p>
  <p *case="'error'">Error: <span *print="$switch"></span></p>
  <p *default>Unknown status "<span *print="$switch"></span>"</p>
</div>
```

Here, the default branch reports the unknown value by reading `$switch` from the child scope.


#### Parent access

`*default` does not change the way parent data is accessed:

- `$parent` (if present) still refers to the nearest ancestor Sercrod host’s data.
- `$root` still refers to the outermost Sercrod host’s data.
- Regular data paths (such as `state`, `config`, or `data.something`) behave as usual.

In other words, `*default` only affects where rendering starts and how branches fall through; it does not introduce a new “parent” concept.


#### Use with conditionals and loops

Inside a `*default` branch you can freely use other directives:

- `*if` and `*elseif`:

  ```html
  <div *switch="status">
    <p *case="'ready'">Ready</p>
    <p *default *if="status">
      Status "<span *print="status"></span>" is not recognized
    </p>
  </div>
  ```

  In this example:
  - `*default` determines that this branch participates in the switch.
  - `*if` further refines whether the default branch contents are actually shown.

- `*for`, `*each`:

  ```html
  <div *switch="status">
    <section *case="'ok'">All good</section>
    <section *default>
      <h2>Problems detected</h2>
      <ul *each="msg of messages">
        <li *print="msg"></li>
      </ul>
    </section>
  </div>
  ```

  Here:
  - The `*default` section becomes active when no `*case` matches.
  - Inside that default block, `*each` is used normally to list messages.

- Nested `*switch`:

  - You can nest another `*switch` inside a default branch if you want a second-level decision.
  - The inner `*switch` has its own `$switch`, independent of the outer one.


#### Use with *case, *case.break, and *break

`*default` participates in the same fall-through model as `*case` and `*case.break`:

- Start of rendering:

  - If a `*case` or `*case.break` matches the switch value, it becomes the starting point.
  - If no case matches and a `*default` is present, the first `*default` becomes the starting point.
  - If there is neither a matching `*case` nor a `*default`, the `*switch` block renders nothing from its branches.

- Fall-through:

  - After the starting branch, each subsequent sibling that has either `*case`, `*case.break`, or `*default` is rendered in order until a break is found.
  - This matches the “fall-through until break” style from JavaScript.

- Break from default:

  - A `*default` branch can have `*break` or `n-break` to stop fall-through after itself:

    ```html
    <div *switch="status">
      <p *case="'ok'">OK</p>
      <p *default *break>Unknown status</p>
      <p>Will not be rendered if default was used</p>
    </div>
    ```

  - Similarly, `*case.break` or `n-case.break` on any branch stops rendering after that branch, so any later `*default` is ignored in that case.

Sercrod-specific constraints and recommendations:

- Do not put `*default` and `*case` / `*case.break` on the same element.
  - The implementation will effectively treat the element as a default branch and ignore the case condition.
  - For clarity and maintainability, keep each branch either a case or a default, not both.
- Use at most one `*default` per `*switch` block.
  - Multiple defaults are technically treated as part of the fall-through region, but they are confusing to read.
  - Prefer a single default region that covers all fallback content.


#### Best practices

- Place `*default` at the end of the switch block:

  - While the implementation supports a JavaScript-like fall-through model, placing the default at the end makes the flow easier to understand.
  - This also matches common expectations from other languages.

- Keep default content focused on the “unknown” case:

  - Use the default branch to handle “anything else” clearly.
  - Show the unexpected value via `$switch` if it helps debugging or UX.

- Use explicit breaks when you want no fall-through:

  - If you want the default branch to be the only fallback, add `*break` to it so that later branches are skipped.
  - Similarly, use `*case.break` for cases that must not fall through.

- Treat `*default` as “inside switch only”:

  - Only use `*default` on direct children of a `*switch` / `n-switch` host.
  - Avoid using it as a generic conditional or as an alternative to `*if`; it is not designed for that.

- Avoid mixing control concerns on the same element:

  - Do not combine `*default` with `*switch`, `*case`, or `*case.break` on the same element.
  - Let each branch element have exactly one switch-related role: either `*case`/`*case.break` or `*default`.


#### Additional examples

Default with a detailed fallback view:

```html
<serc-rod id="dashboard" data='{
  "mode": "unknown",
  "knownModes": ["list","detail"]
}'>
  <section *switch="mode">
    <div *case="'list'">
      <h2>List view</h2>
      <!-- ... -->
    </div>

    <div *case="'detail'">
      <h2>Detail view</h2>
      <!-- ... -->
    </div>

    <div *default>
      <h2>Unsupported mode</h2>
      <p>
        Mode "<span *print="$switch"></span>" is not supported.
      </p>
      <p>Supported modes are:</p>
      <ul *each="m of knownModes">
        <li *print="m"></li>
      </ul>
    </div>
  </section>
</serc-rod>
```

Default plus break to isolate fallback:

```html
<div *switch="status">
  <p *case="'ok'" *break>OK</p>

  <p *default *break>
    Status "<span *print="$switch"></span>" is not OK
  </p>

  <p>
    This paragraph is never rendered, because all branches break.
  </p>
</div>
```


#### Notes

- `*default` and `n-default` are aliases and behave identically inside a `*switch` block.
- `*default` has no expression; it only controls where the switch’s fall-through rendering can start.
- `*default` is only meaningful as a direct child of a `*switch` or `n-switch` host.
- The switch engine uses the same fall-through and break concepts as a JavaScript `switch` statement:
  - Start at the first matching `*case` or the first `*default` when nothing matches.
  - Continue rendering subsequent branches until a break is encountered.
- For clarity and maintainability:
  - Use one `*default` per `*switch` block.
  - Place it last.
  - Avoid mixing `*default` with other switch-role attributes on the same element.
