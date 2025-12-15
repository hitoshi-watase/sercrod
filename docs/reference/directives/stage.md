### *stage

Aliases: `*stage`, `n-stage`  
Category: host-level data control

#### Summary

`*stage` enables a two-phase editing model on a Sercrod host.  
Instead of mutating the host data directly, the runtime creates a deep copy called the staged buffer.  
All bindings inside the host work against this staged buffer, and you can later commit or discard those changes using other directives such as `*apply` and `*restore`.

- Without `*stage`: bindings read and write the host data (`_data`) directly.
- With `*stage`: bindings read and write a staged copy (`_stage`), and the host data is only updated when you explicitly apply changes.

The attribute value of `*stage` or `n-stage` is currently not evaluated. Presence alone enables staging.

#### Basic example

@@@html
<serc-rod data={ user: { name: "Alice", email: "alice@example.com" } } *stage>
  <form>
    <label>
      Name
      <input *input="user.name">
    </label>

    <label>
      Email
      <input *input="user.email">
    </label>

    <p>Staged preview: <span *print="user.name"></span></p>

    <button type="button" *apply>Apply</button>
    <button type="button" *restore>Reset</button>
  </form>
</serc-rod>
@@@

In this configuration:

- Typing into the inputs updates the staged `user` object.
- The host template is evaluated against the staged buffer.
- Clicking `*apply` copies the staged values back to the host data.
- Clicking `*restore` discards staged edits and resets the staged buffer from the last applied state.

#### Behavior

At runtime, Sercrod maintains two internal objects per host:

- `_data`: the stable host data that represents the committed state.
- `_stage`: an optional staged copy used while `*stage` is active.

When a Sercrod host is created:

- `_data` is initialised from the `data` attribute or inherited scope as usual.
- If the host has `*stage` or `n-stage`, and `_stage` is still `null`, the runtime creates a deep copy of `_data` and stores it in `_stage`.

When the host renders:

- The effective scope for expressions is `this._stage ?? this._data`.
- If `_stage` exists, all ordinary bindings and directives inside the host see only the staged copy.
- If `_stage` is `null`, everything behaves like a normal, non staged host.

When inputs bound with `*input` or `n-input` fire:

- The runtime chooses `target = this._stage ?? this._data`.
- The binding expression is evaluated against `target` and then assigned back into `target`.
- If `_stage` exists, input bindings update the staged buffer, not the committed data.

#### Evaluation timing

`*stage` affects when and where data is cloned, but it does not introduce its own expression language or custom timing. The key timings are:

- During initialisation (`connectedCallback`):
  - After `_data` is prepared, if the host has `*stage` or `n-stage` and `_stage` is still `null`, Sercrod deep copies `_data` into `_stage`.
- During each `update()`:
  - For nested hosts that receive a parent scope via `__sercrod_scope`, if the host has `*stage` or `n-stage` and `__sercrod_scope` is set, `_stage` is refreshed from the inherited scope.
- During input events:
  - `*input` and `n-input` always write to `this._stage ?? this._data`.
  - When `_stage` is present, the input handlers skip automatic full host re render, because the form control already reflects the current user input.

No additional scheduling hooks are introduced by `*stage` itself. It changes which object is edited and rendered, not when expressions are evaluated.

#### Execution model

Conceptually, `*stage` splits the host data into:

- Stable state: `_data` (committed, long lived).
- Working state: `_stage` (temporary, editable).

The execution model is:

1. Host initialises `_data`.
2. If `*stage` is present:
   - `_stage` is created as a deep copy of `_data`.
   - All template expressions inside the host see `_stage`.
3. While the user edits:
   - `*input` and `n-input` writes go into `_stage`.
   - Other directives that mutate data (such as `*load`) also prefer `_stage` over `_data`.
4. When the user commits:
   - `*apply` copies `_stage` back into `_data` and refreshes `_stage` from the new committed state.
5. When the user discards:
   - `*restore` throws away the current `_stage` contents and recreates `_stage` from the last committed snapshot.

Internally, Sercrod first tries `structuredClone` to create `_stage`. If that fails, it falls back to `JSON.parse(JSON.stringify(...))`. This means `*stage` is primarily intended for JSON like data (plain objects, arrays, numbers, strings, booleans, and null).

#### Variable creation

`*stage` does not create new variables in the template scope. It only changes which data object is used as the root when resolving existing expressions.

- Identifiers like `user`, `form`, and so on are still defined where they normally are.
- `$root`, `$parent`, and other special values behave as usual.
- There is no additional binding such as `$stage` or similar introduced by this directive in the current runtime.

In other words, the same expressions you would write without `*stage` continue to work. They now read and write from the staged buffer instead of the committed data when staging is active.

#### Scope layering

The behavior of `*stage` depends on whether the Sercrod host is a root host or a nested host.

- Root host:
  - `_data` comes from the host `data` attribute.
  - `_stage` is cloned from `_data` once during initialisation.
  - Subsequent `update()` calls do not automatically overwrite `_stage` from `_data`. The staged buffer is kept until you explicitly overwrite or reset it via `*apply`, `*restore`, or other operations that rebuild `_stage`.

- Nested host (child Sercrod with an inherited scope `__sercrod_scope`):
  - `_data` is a proxied view of the inherited scope.
  - On `update()`, if `*stage` is present and `__sercrod_scope` is available, `_stage` is refreshed from `__sercrod_scope`.
  - When you click `*apply`, changes in `_stage` are written back into `_data` (and therefore into the parent scope), then `_stage` is refreshed from the new committed state.

In both cases, expressions inside the host are evaluated against `this._stage ?? this._data`. Parent scopes above the host are not changed by `*stage` unless you explicitly propagate changes using `*apply` on a nested host or other application specific code.

#### Interaction with bindings and data directives

`*stage` changes the behavior of several other directives that work on host data:

- `*input` / `n-input`:
  - By default, bindings write to `this._stage ?? this._data`.
  - With `*stage` active, all input writes go into `_stage`.
  - The input handler does not automatically trigger a full host re render when `_stage` is present, so derived views are refreshed when you explicitly re render (for example via `*apply`, `*restore`, or `*load`).

- `*load` / `n-load`:
  - When loading JSON, the runtime updates `_stage` if it exists, otherwise `_data`.
  - With `*stage`, this lets you load draft data without touching the committed state until you explicitly apply it.

- `*post` / `n-post`:
  - When serialising data for sending, the runtime uses `this._stage ?? this._data` as the source.
  - With `*stage`, the posted payload is the staged buffer by default.

- `*save` / `n-save`:
  - When generating a downloadable JSON snapshot, the runtime again uses `this._stage ?? this._data`.
  - With `*stage`, the exported file reflects the current staged state.

Other directives that only read data (such as `*print`, `*textContent`, or conditions and loops) automatically see the staged values when `*stage` is present, because they evaluate against the same effective scope.

#### Interaction with *apply and *restore

`*stage` is designed to be used together with `*apply` and `*restore`.

- `*apply`:
  - Available on any descendant element inside a staged host.
  - On click, if `_stage` exists:
    - Copies the staged values into `_data` using `Object.assign`.
    - Calls `update()` on the host.
    - Stores a snapshot of the committed `_data` into an internal `_applied` buffer used by `*restore`.
  - Without `_stage` (no `*stage` on the host), `*apply` does nothing.

- `*restore`:
  - Also available on any descendant element inside a staged host.
  - On click:
    - Only executes if the host has `*stage` or `n-stage`.
    - Recreates `_stage` from `_applied` if available, otherwise from `_data`.
    - Calls `update()` so that the view reflects the restored state.
  - Without `*stage`, `*restore` has no effect.

This trio (`*stage` plus `*apply` plus `*restore`) is the recommended pattern for implementing editable but confirmable forms.

#### Use with conditionals and loops

`*stage` does not introduce any new restrictions on conditionals or loops. Instead, it transparently changes the data that those directives see:

- `*if`, `*for`, and `*each` evaluate their expressions against the effective scope `this._stage ?? this._data`.
- With staging enabled, these directives respond to staged values instead of committed values.

Examples:

- Show a banner when there are unsaved staged changes (assuming your data includes such a flag).

@@@html
<serc-rod data={ form: { dirty: false } } *stage>
  <section *if="form.dirty">
    <p>You have unsaved changes.</p>
  </section>

  <!-- bindings that can toggle form.dirty in the staged buffer -->
</serc-rod>
@@@

- Render a preview list based on staged filters and staged items.

@@@html
<serc-rod data={ filter: "", items: [] } *stage>
  <input *input="filter">

  <ul>
    <li *each="item of items" *if="!filter || item.includes(filter)">
      <span *print="item"></span>
    </li>
  </ul>

  <button type="button" *apply>Apply filter and items</button>
</serc-rod>
@@@

In both cases, the loop and conditional behavior is identical to non staged code, but they operate on staged values.

#### Best practices

- Use `*stage` at the host level for two phase edits:
  - Form drafts that should not be committed until an explicit click.
  - Bulk edits that should be applied or discarded in one step.
  - Import or load flows where the user reviews the loaded data before it becomes effective.

- Keep staged data JSON like:
  - `*stage` uses a deep clone based on `structuredClone` with a JSON fallback.
  - Avoid storing functions, DOM nodes, or complex non serialisable objects in the part of the data you expect to stage.

- Combine with `*apply` and `*restore`:
  - Always provide a clear commit button (`*apply`) and, ideally, a reset button (`*restore`) when using staging.
  - This makes the two phase model obvious in the UI.

- Be explicit about when the view refreshes:
  - With `*stage`, input handlers do not trigger a full host re render on each keystroke.
  - If you need derived non input elements to update live based on staged changes, call `update()` from your own methods or trigger operations (`*load`, `*apply`, `*restore`) that call `update()` internally.

- Restrict `*stage` to Sercrod hosts:
  - In the current runtime, only Sercrod host elements (such as `<serc-rod>` or other Sercrod based custom elements) actually interpret `*stage` or `n-stage`.
  - Adding `*stage` to ordinary elements has no effect from Sercrod’s perspective.

#### Additional examples

Simple staged form with save and reset:

@@@html
<serc-rod data={ profile: { name: "", bio: "" } } *stage>
  <h2>Edit profile (staged)</h2>

  <label>
    Name
    <input *input="profile.name">
  </label>

  <label>
    Bio
    <textarea n-input="profile.bio"></textarea>
  </label>

  <p>Committed name: <span *print="$root.profile.name"></span></p>
  <p>Staged name: <span *print="profile.name"></span></p>

  <button type="button" *apply>Apply to committed profile</button>
  <button type="button" *restore>Discard staged changes</button>
</serc-rod>
@@@

Staged load and post flow:

@@@html
<serc-rod data={ form: {} } *stage>
  <input type="file" *load>
  <button type="button" *post="/api/preview">Send staged form to preview API</button>

  <pre *print="form | json"></pre>

  <button type="button" *apply>Apply staged form to committed data</button>
</serc-rod>
@@@

Here:

- `*load` merges the loaded JSON into `_stage` rather than `_data`.
- `*post` sends the staged data to the server.
- Only when `*apply` is clicked does the committed data change.

#### Notes

- `*stage` is a host level flag. It does not have per field granularity in the current implementation. Once activated, all host level data that bindings touch are read and written via the staged buffer.
- The attribute value of `*stage` or `n-stage` is currently ignored. Use it only as a presence flag. Existing examples that show `*stage="draft"` are effectively equivalent to `*stage`.
- Without `*stage`, directives such as `*apply` and `*restore` safely do nothing, so you can keep button markup in place and enable staging later by adding the host flag.
- Because the staged buffer is a deep copy, large data structures may have a cost when staging is first enabled or when a nested staged host resynchronises from its parent scope. Design your data shape accordingly.
