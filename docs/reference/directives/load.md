### *load

#### Summary

`*load` loads JSON data from a user-selected file and merges it into the Sercrod host’s data.
If a staged view is active (via `*stage`), the JSON is merged into the stage; otherwise it is merged into the live data.
The directive has an alias `n-load`.

Typical use:

- Put `*load` on a button or other clickable element.
- Optionally specify a list of top-level properties to copy from the JSON.
- Sercrod reads the file via the browser’s file dialog, parses the JSON, merges it into data or stage, and triggers a re-render.


#### Basic example

A simple load button that merges the entire JSON into host data:

```html
<serc-rod id="profile" data='{"user":{"name":"","email":""}}'>
  <p>Name: <span *print="user.name"></span></p>
  <p>Email: <span *print="user.email"></span></p>

  <button type="button" *load>Load profile…</button>
</serc-rod>
```

If the user selects a JSON file like:

```json
{
  "user": {
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

then after loading:

- `user.name` becomes `"Alice"`.
- `user.email` becomes `"alice@example.com"`.
- The view is refreshed automatically.


#### Behavior

- `*load` is an action directive that attaches file-loading behavior to an element.
- The directive works with the browser’s file picker and uses `FileReader` to read the chosen file.
- Only JSON is expected; other file types are not supported by the current implementation.
- The directive merges the parsed JSON into:

  - `_stage`, if the host has a staged view (for example due to `*stage`).
  - `_data`, otherwise.

- The merge strategy depends on the value of the `*load` attribute:

  - No value: merge the entire JSON object into the target object with `Object.assign`.
  - Value present: treat it as a whitespace-separated list of top-level property names and copy only those properties.

- After a successful load, Sercrod dispatches a `sercrod-loaded` event and calls `update()` on the host to re-render the view.

Alias:

- `*load` and `n-load` are aliases. They accept the same syntax and behave identically.


#### Storage and merge semantics

Attribute value:

- If `*load` (or `n-load`) is empty or omitted:

  - The parsed JSON must be an object.
  - Sercrod merges all enumerable properties into `_stage` or `_data`:

    - With stage: `Object.assign(this._stage, json)`
    - Without stage: `Object.assign(this._data, json)`

- If `*load` has a value:

  - The value is split by whitespace into a list of property names:

    - `*load="user settings"`

      becomes `["user","settings"]`.

  - For each property name `p`:

    - With stage: `this._stage[p] = json[p]`
    - Without stage: `this._data[p] = json[p]`

  - Only direct top-level keys are supported; dotted paths or nested selectors are not interpreted.

Error handling:

- The chosen file is read as text and parsed with `JSON.parse`.
- If parsing fails and Sercrod is configured to warn, the runtime logs:

  - `[Sercrod warn] *load JSON parse: ...`

- On parse error, no merge is performed and the view is not updated.


#### File input integration

`*load` works both with native file inputs and with regular clickable elements.

- If the element is an `<input type="file">`:

  - Sercrod reuses the native file input.
  - If the input has no `accept` attribute, Sercrod sets it to `"application/json"` by default.
  - On `change`, the first selected file is read and processed.

- If the element is not an `<input type="file">`:

  - Sercrod attaches a `click` handler to the element.
  - When clicked, Sercrod creates a hidden `<input type="file">`, sets its `accept` attribute, and forwards the selection to `*load`.
  - The temporary file input is not meant to be visible or controlled directly.

Accept attribute:

- If the element has an `accept` attribute, Sercrod respects it.
- If not, Sercrod uses `"application/json"` as the default.
- This influences what the browser shows in the file picker but does not perform additional runtime validation beyond JSON parsing.


#### Stage interaction

`*load` is designed to cooperate with staged editing:

- If the host has an active stage (for example due to `*stage`), `*load` merges into `_stage` instead of `_data`.
- This lets you preview or edit the loaded data in a staged view and then decide when to apply it.

Typical pattern:

```html
<serc-rod id="editor" data='{"doc":{"title":"","body":""}}'>
  <section *stage>
    <label>
      Title:
      <input *input="doc.title">
    </label>

    <label>
      Body:
      <textarea *input="doc.body"></textarea>
    </label>

    <button type="button" *load="doc">Load draft…</button>
    <button type="button" *apply>Apply</button>
    <button type="button" *restore>Restore</button>
  </section>
</serc-rod>
```

In this pattern:

- `*load="doc"` replaces the staged `doc` object with `json.doc` from the file.
- `*apply` copies staged changes back into the live data.
- `*restore` discards staged changes and returns to the last stable state.


#### Evaluation timing

- `*load` is evaluated when Sercrod renders the element that carries it.
- During rendering:

  - Sercrod clones the original element.
  - It attaches the necessary event listeners for file selection.
  - It appends the cloned element to the DOM and returns from the internal render function.

- `*load` does not perform any data changes during rendering itself.
  - Data changes happen later, in response to user interaction (file selection).
- When a file is successfully loaded and merged, Sercrod explicitly calls `update()` on the host to re-run the render pipeline and update the view.


#### Execution model

Conceptually, the runtime behaves like this for `*load`:

1. Sercrod detects `*load` or `n-load` on an element.
2. It clones the element.

   - All attributes and children are copied as-is.
   - The `*load` / `n-load` attribute is preserved on the clone for visibility, but Sercrod does not re-interpret it later.

3. It reads the `*load` attribute:

   - Trims the text.
   - If non-empty, splits it into a list of property names (`props`).
   - If empty, leaves `props` as `null`.

4. It determines the desired `accept` type:

   - Uses the element’s own `accept` attribute if present.
   - Otherwise, defaults to `"application/json"`.

5. It wires file handling:

   - If the cloned element is an `<input type="file">`:

     - Ensures `accept` is set.
     - Adds a `change` listener that calls `handleFile(file)` for the selected file.

   - Otherwise (button, link, etc.):

     - Adds a `click` listener.
     - That listener creates a temporary `<input type="file">`, sets `accept`, and listens for `change`.
     - When a file is chosen, it calls `handleFile(file)`.

6. `handleFile(file)`:

   - Uses `FileReader` to read the file as text.
   - In the `onload` handler:

     - Parses the JSON.
     - Merges it into `_stage` or `_data` according to `props`.
     - Dispatches a `sercrod-loaded` event with details.
     - Calls `update()`.

7. The cloned element is appended to the parent in the rendered DOM; the original template node is not appended.


#### Variable creation

`*load` does not create new template variables:

- It does not add loop variables, local aliases, or special names to the scope.
- All changes happen directly in the host’s `_data` (or `_stage`) object.
- Templates and expressions continue to use the regular data paths (`user`, `settings`, etc.) after the data is updated.


#### Scope layering

`*load` respects the existing scope model:

- It operates on the Sercrod host’s data or stage, not on local loop scopes.
- It does not change how `$data`, `$root`, or `$parent` are injected.
- After a successful load, any expressions that read from the updated data see the new values at the next render.

Because `*load` is an action on the host data, it does not affect how inner scopes are layered; it only changes the values they eventually read.


#### Parent access

`*load` does not introduce a new parent object:

- Parent access via `$parent` and `$root` remains unchanged.
- Any templates that use `$parent` or `$root` simply see updated data after the load and re-render, as long as they reference the affected fields.


#### Use with conditionals and loops

You can place `*load` inside conditional blocks or loops just like any other action element:

- Inside `*if`:

  - The element exists and is interactive only when the `*if` condition is truthy.

  ```html
  <div *if="canLoad">
    <button type="button" *load>Load config…</button>
  </div>
  ```

- Inside loops:

  - Each iteration can have its own `*load` element, although typically you want just one loader per host.

  ```html
  <serc-rod data='{"sections":[{"id":1},{"id":2}]}'>
    <section *each="section of sections">
      <h2 *print="section.id"></h2>
      <button type="button" *load="section">Load section…</button>
    </section>
  </serc-rod>
  ```

Restrictions:

- `*load` is not a structural directive and does not control how many times an element is rendered.
- It is best used for standalone controls (buttons, links, inputs) rather than for elements that also carry structural directives like `*for` or `*each`.
- Combining `*load` with other action directives that also replace the element (such as `*save`, `*post`, or `*fetch`) on the same element is not recommended:

  - Only one branch in the internal evaluation order will run.
  - Other directives on the same element will effectively be ignored.
  - Use separate elements if you need multiple actions.


#### Best practices

- Use dedicated controls:

  - Attach `*load` to buttons or file inputs specifically intended for loading data.
  - Avoid mixing `*load` with other unrelated behaviors on the same element.

- Keep the JSON shape predictable:

  - Decide on a stable JSON schema for exports and imports (for example, via `*save`).
  - Document which top-level properties exist (`user`, `settings`, etc.).

- Use `props` for partial updates:

  - When you want to protect unrelated data from being overwritten, specify only the properties you want to import:

    - `*load="user settings"`

- Combine with staged editing:

  - Pair `*load` with `*stage`, `*apply`, and `*restore` to allow safe previewing of loaded data before committing.

- Keep `*load` elements structurally simple:

  - The element with `*load` is cloned and used as-is.
  - Avoid relying on nested Sercrod directives inside the `*load` element itself; keep its content mostly static (plain text or icons).

- Validate externally if needed:

  - `*load` does basic JSON parsing only.
  - If you require more validation (schema checks, versioning), perform it in code that reacts to `sercrod-loaded`.


#### Examples

Full data import:

```html
<serc-rod id="app" data='{"config":{"theme":"light","lang":"en"}}'>
  <pre *literal="JSON.stringify(config, null, 2)"></pre>
  <button type="button" *load>Load config…</button>
</serc-rod>
```

Partial import:

```html
<serc-rod id="app" data='{"user":{},"settings":{}}'>
  <button type="button" *load="user settings">
    Load user and settings
  </button>
</serc-rod>
```

Custom accept type on a native file input:

```html
<serc-rod id="app" data='{"user":{}}'>
  <input type="file" accept="application/json,.json" *load="user">
</serc-rod>
```


#### Notes

- `*load` and `n-load` are aliases; choose one style for consistency.
- `*load` is designed for browser environments where `FileReader` and file dialogs are available.
- The directive expects JSON text; other content types will fail JSON parsing.
- When JSON parsing fails and warnings are enabled, Sercrod logs a warning and does not modify data.
- After a successful load, Sercrod dispatches a `sercrod-loaded` event:

  - `detail.stage`: `"load"`
  - `detail.host`: the Sercrod host element
  - `detail.fileName`: the selected file name (or `null`)
  - `detail.props`: the property list used for partial merge (or `null`)
  - `detail.json`: the parsed JSON object

  You can listen to this event on the host to perform additional validation or side effects.

- For clarity and maintainability, avoid combining `*load` with other I/O directives (`*save`, `*post`, `*fetch`) on the same element; use separate elements for each distinct action.
