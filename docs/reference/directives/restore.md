### *restore

#### Summary

`*restore` discards staged edits and restores the staged view back to the last stable state of the host data.
It is part of the staged editing flow together with `*stage` and `*apply`, and it only makes sense when the host is configured with `*stage` or `n-stage`.

Alias:

- `*restore`
- `n-restore`


#### Basic example

A typical staged form with apply and restore buttons:

```html
<serc-rod id="profile" data='{
  "user": { "name": "Alice", "email": "alice@example.com" }
}'>
  <form *stage="draft">
    <label>
      Name:
      <input *input="draft.user.name">
    </label>
    <label>
      Email:
      <input *input="draft.user.email">
    </label>

    <button type="button" *apply>Save</button>
    <button type="button" *restore>Reset</button>
  </form>
</serc-rod>
```

Behavior:

- While editing, the view uses a staged copy (`_stage`) derived from the host data.
- `*apply` copies staged changes into the real data (`_data`) and remembers that snapshot as the new stable state.
- `*restore` discards the current staged edits and restores the staged view back to the last stable state:
  - If there has been at least one successful `*apply`, it rolls back to that applied snapshot.
  - Otherwise it rolls back to the original host data.


#### Behavior

Key points:

- `*restore` is a button-like directive:
  - It attaches a click handler that manipulates the host’s internal staged buffer.
  - It does not create or expose new variables in the template scope.
  - The attribute value (if any) is ignored; `*restore` is used as a flag only.

- `*restore` only has an effect when the host Sercrod element has `*stage` or `n-stage`:
  - Without `*stage`, the click handler checks the host and does nothing.

- Interaction with the staged model:
  - The host maintains:
    - `_data`: the canonical data.
    - `_stage`: a staged copy used for editing and rendering while staging is active.
    - `_applied`: the last snapshot of `_data` taken immediately after `*apply`.
  - `*restore` rewrites `_stage` using:
    - `_applied` if it exists (last applied snapshot), otherwise
    - `_data` (the current canonical data).

- Rendering impact:
  - Since the host’s visible scope is `this._stage ?? this._data`, updating `_stage` followed by `update()` immediately reverts the UI to the restored state.


#### Relationship to *stage and *apply

`*restore` is one of three core directives that define the staged editing lifecycle:

- `*stage` on the host:
  - Enables the staged editing model.
  - The host constructs `_stage` as a clone of the initial scope (usually `_data` or a parent-provided scope).
  - The visible scope becomes `_stage` whenever it is present, falling back to `_data` otherwise.

- `*apply` on a child element:
  - Copies the staged content from `_stage` into `_data` when clicked.
  - After a successful apply:
    - `Object.assign(this._data, this._stage)` is performed.
    - The host re-renders.
    - `_applied` is updated to a clone of the new `_data` for use by `*restore`.

- `*restore` on a child element:
  - Uses `_applied` if present, otherwise `_data`, as the base.
  - Clones that base into `_stage` again.
  - Triggers a re-render so the UI reflects the restored state.

In other words:

- `*stage`: prepare a safe workspace.
- `*apply`: commit workspace changes to canonical data and remember that commit.
- `*restore`: discard workspace changes and go back to the last commit (or the original data).


#### Evaluation timing

`*restore` is processed during element rendering after host-level `*if` and other structural checks:

- If the element with `*restore` also has `*if` or `n-if`, the conditional is evaluated first.
  - If the condition is falsy, the element is not rendered and no restore handler is attached.
  - If the condition is truthy, Sercrod proceeds and the `*restore` logic runs.

- When the renderer encounters `*restore`:
  - It clones the current working element (`work`) into a real DOM element (`el`).
  - It attaches a single `click` listener to `el`.
  - It appends `el` to the parent and stops further processing of that element for the current render.

- The `click` handler runs at user interaction time, not at render time.


#### Execution model

Conceptually, for each element with `*restore` or `n-restore`:

1. During render:

   - Sercrod detects that `work` has `*restore` or `n-restore`.
   - It creates `el = work.cloneNode(true)`.
   - It registers:

     - `el.addEventListener("click", handler)`,

     where `handler` is closed over the host instance.

   - It appends `el` to the parent.
   - It returns from the directive branch for this element.

2. When the user clicks the element:

   - The handler checks if the host has `*stage` or `n-stage`.
     - If not, it returns without changes.
   - It calculates the base:

     - `base = this._applied ?? this._data`.

   - It clones `base` into `_stage`:
     - Preferentially via `structuredClone`.
     - Falls back to `JSON.parse(JSON.stringify(base))` if needed.

   - It calls `this.update()` to re-render the host.

3. On re-render:

   - Because `_stage` is now a fresh clone of the base state, the entire staged view is reset to that state.


#### Variable creation and scope layering

`*restore` does not introduce or modify template-level variables:

- No new local variables are created for each element.
- It does not change the scopes used by expressions inside the template directly.
- Instead, it modifies the internal data buffers (`_stage` and indirectly the visible scope) of the host component.

From the perspective of expressions:

- After a successful restore, any expression that reads from the visible scope (for example `user.name`) will see values from the restored staged buffer.
- Special helpers like `$data`, `$root`, and `$parent` are still provided in the usual way by Sercrod’s expression engine.


#### Parent access

`*restore` does not provide a dedicated handle to parent scopes on its own:

- It acts on the enclosing Sercrod host where `*stage` is configured.
- The handler uses internal properties (`this._stage`, `this._data`, `this._applied`) of that host.
- Templates can still rely on `$root` and `$parent` as usual when rendering, but those bindings are independent of `*restore` itself.

The main effect of `*restore` is to redefine the contents of `_stage`, which then becomes the source for subsequent renders.


#### Use with conditionals and loops

You can combine `*restore` with conditionals and loops on the same or surrounding elements, as long as they do not conflict structurally:

- On the same element:

  - `*if` and `*restore` on a button:

    ```html
    <button type="button"
            *if="isDirty"
            *restore>
      Reset changes
    </button>
    ```

    - The button only appears when `isDirty` is truthy.
    - When visible and clicked, it restores the staged data.

- Inside loops:

  - You can put `*restore` in a repeated area if it logically refers to the same staged host:

    ```html
    <serc-rod data='{"rows":[{"id":1},{"id":2}]}' *stage="draft">
      <table>
        <tbody *each="row of draft.rows">
          <tr>
            <td *print="row.id"></td>
            <td>
              <button type="button" *restore>Reset table edits</button>
            </td>
          </tr>
        </tbody>
      </table>
    </serc-rod>
    ```

    - All restore buttons operate on the same staged host.
    - Clicking any of them resets the entire staged view, not just a single row.


#### Best practices

- Use `*restore` only when `*stage` is enabled:

  - Without `*stage` or `n-stage` on the host, `*restore` does not perform any meaningful work.
  - Treat `*restore` as part of a staged editing pattern, not as a global reset.

- Pair `*restore` with `*apply`:

  - `*restore` relies on `_applied` for “last stable state”.
  - Without `*apply`, it falls back to `_data`, which can still be useful as an initial reset.
  - In a typical workflow, you will have:

    - One or more staged inputs bound into the staged scope.
    - A `Save` button with `*apply`.
    - A `Reset` button with `*restore`.

- Avoid mixing unrelated behaviors on the same button:

  - It is technically possible to add other attributes such as `@click` alongside `*restore`, but that will combine event handlers.
  - For clarity and maintainability, keep `*restore` buttons focused on restore behavior and use separate buttons for additional actions.

- Think in terms of “last committed change”:

  - `*restore` does not reconstruct an arbitrary history; it only knows the last successfully applied snapshot.
  - If you need multi-step undo or history, you should build that at the data layer and expose it to Sercrod as part of `_data` or `_stage`.


#### Additional examples

Simple “revert to original data” without any prior apply:

```html
<serc-rod id="simple" data='{"counter": 0}' *stage="draft">
  <p>Value: <span *print="draft.counter"></span></p>

  <button type="button" *restore>Reset</button>
  <button type="button" @click="draft.counter++">Increment</button>
</serc-rod>
```

- On first render:
  - `_stage` is cloned from `_data` (`{ counter: 0 }`).
  - The view shows `0`.
- Clicking `Increment` changes `draft.counter` inside `_stage`.
- Clicking `Reset` clones `_data` into `_stage` again (since `_applied` is unset), bringing the view back to `0`.


Staged form with multiple commits:

```html
<serc-rod id="multi" data='{"value": "initial"}' *stage="draft">
  <input *input="draft.value">

  <button type="button" *apply>Apply</button>
  <button type="button" *restore>Restore</button>
</serc-rod>
```

- After editing the input and clicking `Apply`:
  - `_data.value` becomes the edited value.
  - `_applied` is updated to the new `_data`.
- Further edits only affect `_stage`.
- Clicking `Restore` discards those new edits and clones `_applied` into `_stage`, returning the UI to the last applied value.


#### Notes

- `*restore` and `n-restore` are aliases; choose one style per project and stick to it for consistency.
- The directive does not use its attribute value; any text written in `*restore="..."` is ignored.
- `*restore` is a staged-data helper only:
  - It assumes the host is in staged mode via `*stage` or `n-stage`.
  - It rebuilds the staged buffer from `_applied` or `_data` and re-renders.
- Because it operates on `_stage`, `*restore` affects the visible state immediately, but it does not directly overwrite `_data`.
  - `_data` changes only when `*apply` or other data-mutating mechanisms are invoked.
- There are no additional hard restrictions specific to `*restore` beyond its dependency on `*stage`:
  - It does not conflict with `*include`, `*import`, or other structural directives the way `*each` does, because it does not reshape the host’s children.
