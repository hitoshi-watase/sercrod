### *lazy

#### Summary

`*lazy` is a small flag directive that makes Sercrod less aggressive about full re-renders.

It has two main roles:

- On a Sercrod host (`<serc-rod>`):
  - When `*lazy` is active, normal internal updates do not rebuild the host template.
  - The host only propagates changes to child Sercrod instances and runs `*updated` hooks.
  - A full rebuild still happens on forced updates.

- On a form control with `*input` / `n-input`:
  - `*lazy` controls whether a `change` event triggers a full host re-render or only a child update.
  - The attribute may be a simple boolean flag or an expression that decides laziness at runtime.

The alias `n-lazy` behaves the same as `*lazy`.


#### Basic example

Delayed host re-render for a form input:

```html
<serc-rod id="app" *lazy data='{"form":{"name":""}}'>
  <h2>Profile</h2>

  <label>
    Name:
    <input type="text" *input="form.name">
  </label>

  <p>Preview: <strong *print="form.name"></strong></p>
</serc-rod>
```

In this example:

- Typing in the input updates `form.name`.
- Because the host `<serc-rod>` has `*lazy`, internal updates do not rebuild the host template.
- Instead, child bindings (such as `*print`) are updated and `*updated` hooks run, but the outer DOM structure stays stable.


#### Behavior

`*lazy` does not create variables; it only changes how and when Sercrod decides to re-render.

There are two independent behaviors:

1. Host-level `*lazy` (on `<serc-rod>` or another Sercrod-based host)

- Checked inside `update(force, caller, evt, isInit)`.
- Implementation:

  - Sercrod reads

    - `lazyAttr = this.getAttribute("*lazy") || this.getAttribute("n-lazy")`

    and then

    - `isLazy = (this.hasAttribute("*lazy") || this.hasAttribute("n-lazy")) && String(lazyAttr ?? "").toLowerCase() !== "false"`

  - There is no expression evaluation at the host level.
  - Presence of the attribute with no value, or with any value except `"false"`, enables laziness.
  - If `isLazy` is true and `force` is false:

    - The host skips its own template rebuild.
    - It calls `_updateChildren(false, this)` so that child Sercrod hosts see the new data.
    - It calls `*updated` hooks.
    - It finalizes and returns from `update` early.

  - If `force` is true or `isLazy` is false:

    - The host clears its content and fully rebuilds from the stored template.

Effectively, host-level `*lazy` says:

- "On normal reactivity-driven updates, do not tear down and rebuild this host; only propagate to children and call hooks."
- "On explicit forced updates (for example `update(true, ...)`, initial render, or certain targeted operations), rebuild as usual."

2. Input-level `*lazy` (on elements with `*input` / `n-input`)

- Checked in the `*input` binding logic for each bound node.
- Implementation:

  - Sercrod reads

    - `LazyAttr = node.getAttribute("*lazy") ?? node.getAttribute("n-lazy")`

    then:

    - If the element has `*lazy` / `n-lazy` and the attribute value is empty or `null`, `isLazy = true`.
    - Otherwise it tries `this.eval_expr(LazyAttr, scope, { el: node, mode: "Lazy" })`:
      - If evaluation succeeds, `isLazy = Boolean(result)`.
      - If evaluation throws, it falls back to string semantics:
        - `isLazy = String(LazyAttr).toLowerCase() !== "false"`.

- For `input` events on text-like controls:

  - When `tag === "INPUT"` and `type` is neither `"checkbox"` nor `"radio"`, Sercrod:

    - Updates the bound data (`assign_expr`).
    - If the host is not staging (`!this._stage`):

      - If `*eager` / `n-eager` is truthy (`isEager`), it calls `this.update()` ? full host re-render.
      - Otherwise it calls `_updateChildren(true, this)` ? child-only update (the comment describes this as the default "lazy" behavior).

  - In this path, `isLazy` is not consulted; laziness is controlled by the absence of `*eager`.

- For `change` events (checkbox / radio / select / other):

  - After mapping the new UI value back into the model and calling `assign_expr`, Sercrod checks `isLazy` for that control.
  - If the host is not staging (`!this._stage`):

    - If `isLazy` is false (no `*lazy` / `n-lazy`, or expression evaluates to false):

      - Sercrod calls `this.update()` ? full host re-render.

    - If `isLazy` is true:

      - Sercrod calls `_updateChildren(false, this)` ? propagating to child Sercrod hosts without rebuilding the host.

So on a control that uses `*input`:

- `*lazy` / `n-lazy` is only consulted for the `change` event path.
- `*eager` / `n-eager` is only consulted for the `input` event path.
- Both are ignored when the host is currently using a stage buffer (`*stage`), because the event handlers guard on `if(!this._stage)` before scheduling any update.


#### Evaluation timing

- Host-level `*lazy`:

  - Evaluated on every call to `update(...)` on the host.
  - Only the literal string value matters; there is no expression evaluation.
  - A host whose `*lazy` attribute changes between updates will reflect that change the next time `update` runs.

- Input-level `*lazy`:

  - Evaluated when the `*input` binding logic runs for that node.
  - Sercrod computes `isLazy` using the current `scope`:

    - If the expression evaluates successfully, its boolean value is cached for that run.
    - If evaluation fails, the fallback string logic is used.

  - On each re-render where the input node is recreated, the `*lazy` expression is re-evaluated.


#### Execution model

1. Host-level flow (simplified):

- Some internal change occurs (for example, data mutation through the reactive proxy, or an event handler that calls into data).
- Sercrod schedules or calls `update(force=false, caller, evt, isInit=false)` on the host.
- Inside `update`:

  - It computes `isLazy` from the host attributes.
  - If `force` is false and `isLazy` is true:

    - It skips the host’s template rebuild.
    - It calls `_updateChildren(false, this)` so that child Sercrod hosts refresh.
    - It calls `_call_updated_hooks(evt, isInit)` so `*updated` hooks still run.
    - It calls `_finalize()` and returns.

  - Otherwise:

    - It clears `innerHTML`.
    - It rebuilds the host content from the stored template using the current scope.
    - It then updates children and runs `*updated` as part of the normal flow.

2. Input-level flow for text-like `<input>`:

- User types into the input; the `input` event fires.
- Sercrod:

  - Computes `nextVal`, doing some type normalization (for example numbers).
  - Applies `input_in` filters.
  - Assigns the value into the model (`assign_expr` on `inputExpr`).
  - If the host is not staging (`!this._stage`):

    - If `isEager` is true (`*eager` or `n-eager`):

      - Calls `this.update()` ? full host re-render.

    - Otherwise:

      - Calls `_updateChildren(true, this)` ? child-only update.

- Later, when the input loses focus, a `change` event may fire and follow the generic `change` path described below.

3. Input-level flow for `change` (checkbox / radio / select / others):

- User changes the control and the `change` event fires.
- Sercrod:

  - Derives `nextVal` from the control (for example mapping checkbox arrays, radio selection, or select values).
  - Applies `input_in` filters and writes into the model.
  - If the host is not staging (`!this._stage`):

    - If `isLazy` is false:

      - Calls `this.update()` ? full host re-render from template.

    - If `isLazy` is true:

      - Calls `_updateChildren(false, this)` ? child-only propagation.

At all times:

- If the host uses a stage buffer (`*stage` / `n-stage`), `!this._stage` is false and neither branch schedules automatic updates. In staged forms, commit timing is controlled by `*stage` and `*apply`, not by `*lazy` or `*eager`.


#### Variable creation

`*lazy` does not create or modify any variables:

- It does not introduce new names into the expression scope.
- It does not change the behavior of `*let`, `*for`, `*each`, or other data directives.
- It only affects how frequently Sercrod calls `update` and what kind of updates (host vs. children) are performed.


#### Scope layering

`*lazy` does not change scope layering:

- The same scope rules apply as without `*lazy`:

  - `$root` and `$parent` still point to the same objects.
  - Data objects bound via `data="..."` or `*let` remain unchanged.
  - Methods registered via `*methods` are unaffected.

The only interaction with scope is when `*lazy` on an input uses an expression, for example:

```html
<input *input="form.name" *lazy="form.mode === 'slow'">
```

In this case:

- `form.mode === 'slow'` is evaluated in the same scope in which `*input` is evaluated.
- The expression does not create new variables; it simply decides whether the input should behave lazily for `change` events on that render.


#### Parent access

`*lazy` does not change how parent data are accessed:

- Parent and root data are still accessible with `$parent` and `$root`.
- The presence or absence of `*lazy` does not affect which data object is used as the evaluation root for other directives.

You can freely use `$parent` or `$root` inside expressions for `*lazy` when used on inputs, but they are not required.


#### Use with conditionals and loops

`*lazy` is not a structural directive, so it does not compete with `*if`, `*for`, or `*each` for control of the DOM.

- It can appear on the same element as:

  - `*if`, `*elseif`, `*else`
  - `*for`, `*each`
  - `*include`, `*import`, `*template`
  - Event directives like `@click`

- On a host `<serc-rod>`:

  - `*lazy` is read by the host’s `update` implementation.
  - Structural directives on child elements continue to work as usual.
  - There is no special ordering rule; `*lazy` only affects whether the host rebuilds its template on a given update.

- On an input:

  - `*lazy` only has an effect if the same element also has `*input` / `n-input`.
  - There is no special structural interaction with `*if` or loops; `*lazy` simply changes how strongly that control drives updates.


#### Best practices

- Use host-level `*lazy` for heavy containers:

  - When a Sercrod host is expensive to rebuild but its child Sercrod hosts can cheaply update themselves, `*lazy` reduces unnecessary work.
  - Typical examples include dashboards or pages that host multiple independent Sercrod widgets.

- Use input-level `*lazy` for commit-style controls:

  - On `checkbox`, `radio`, or `select` elements, `*lazy` can prevent every change from triggering a full host re-render.
  - This is useful when a single `change` would otherwise cause a large subtree to rebuild.

- Prefer `*eager` when you want immediate feedback:

  - For text inputs where you want the entire host to react on every keystroke, use `*eager` instead of relying on the default lazy behavior.

- Avoid placing `*lazy` where it has no effect:

  - On elements that are not Sercrod hosts and do not use `*input` / `n-input`, `*lazy` is ignored.
  - Keeping `*lazy` only on hosts and input controls makes intent clearer.

- Keep expressions simple:

  - When using `*lazy="expr"` on inputs, keep the expression short and readable.
  - For complex conditions, prefer to compute a boolean field in your data (for example `form.isSlow`) and reference that.


#### Additional examples

Host-level `*lazy` on a widget:

```html
<serc-rod id="counter" *lazy data='{"count":0}'>
  <button @click="count++">Increment</button>
  <p>Count is <span *print="count"></span></p>
</serc-rod>
```

Behavior:

- Clicking the button updates `count`.
- The host is marked `*lazy`, so internal updates do not rebuild the host template.
- Child bindings re-evaluate and only the printed value changes.

Conditional lazy input:

```html
<serc-rod id="form-app" data='{
  "form": { "name": "", "mode": "slow" }
}'>
  <label>
    Name:
    <input type="text"
           *input="form.name"
           *lazy="form.mode === 'slow'">
  </label>

  <p>Mode: <span *print="form.mode"></span></p>
</serc-rod>
```

Behavior:

- When `form.mode` is `"slow"`, `*lazy` on the input is truthy and `change` events only trigger child updates.
- If `form.mode` becomes `"fast"` (and the expression evaluates to false), `change` events trigger full host updates again.

Lazy checkbox:

```html
<serc-rod id="flags" data='{"flags":{"debug":false}}'>
  <label>
    <input type="checkbox"
           *input="flags.debug"
           *lazy>
    Debug mode
  </label>

  <section *if="flags.debug">
    <h2>Debug panel</h2>
    <p>Extra diagnostics are now visible.</p>
  </section>
</serc-rod>
```

Behavior:

- Toggling the checkbox updates `flags.debug`.
- Because the checkbox has `*lazy`, Sercrod uses the child-update path for the `change` event instead of rebuilding the host.
- The `*if` condition is re-evaluated and the debug section appears or disappears accordingly.


#### Notes

- `*lazy` and `n-lazy` are aliases.
- On hosts, `*lazy` is a simple string-based flag; there is no expression evaluation.
- On inputs with `*input` / `n-input`, `*lazy` may be:

  - A bare attribute (enabled), or
  - An expression that decides laziness, with a fallback to string-based `"false"` semantics.

- `*lazy` does not create variables or change scope; it only influences how and when Sercrod schedules host and child updates.
- There are no forbidden directive combinations specific to `*lazy`. The only limitation is that it is only meaningful:

  - On Sercrod hosts (where it affects `update`), and
  - On controls that use `*input` / `n-input` (where it affects `change` handling).
