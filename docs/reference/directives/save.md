### *save

#### Summary

`*save` exports the host data (or its staged view) as a JSON file in the browser.
It is typically used on a button inside a `<serc-rod>` host.
When clicked, `*save` collects the host’s current data, builds a JSON string, and starts a download such as `Sercrod-20251205-093000.json`.

By default, `*save` exports the entire host data.
If you provide a list of property names, only those top-level properties are included.


#### Basic example

Save the entire host data:

```html
<serc-rod id="profile" data='{"name":"Alice","age":30}'>
  <button *save>Download profile JSON</button>
</serc-rod>
```

Behavior:

- The `<button>` is cloned and given a click handler by Sercrod.
- When the button is clicked, Sercrod takes the host’s current data and serializes it to JSON.
- A file named like `Sercrod-YYYYMMDD-HHMMSS.json` is generated and downloaded by the browser.


#### Behavior

- `*save` attaches a click handler to the element it is placed on.
- The handler runs in the context of the surrounding Sercrod host and serializes:

  - `this._stage` if it exists, otherwise
  - `this._data`.

- No network request is sent by `*save` itself.
- The resulting JSON is written into a Blob, and a temporary `<a download>` element is used to trigger the browser’s download dialog.
- After the download is initiated, a `CustomEvent("sercrod-saved")` is dispatched from the host for application-specific hooks.

Alias:

- `*save` and `n-save` are aliases and behave identically.


#### Data source and property selection

Data source:

- `*save` always uses host-level data, not per-element scope variables.
- On click:

  - If the host has a staged buffer (`_stage`), `*save` reads from `_stage`.
  - Otherwise, it reads from the committed data object `_data`.

Property selection:

- Without an attribute value:

  - `*save` exports the entire data object (`_stage` or `_data`).

- With a value:

  - The attribute is treated as a whitespace-separated list of top-level property names.
  - These names are not expressions; they are taken as-is and are not evaluated.
  - Only properties that exist on the data object are copied into a new object.

Example (selective save):

```html
<serc-rod id="settings" data='{
  "user": { "name": "Alice", "age": 30 },
  "theme": { "mode": "dark" },
  "debug": true
}'>
  <!-- Only save "user" and "theme" from the host data -->
  <button *save="user theme">Download user+theme</button>
</serc-rod>
```

In this example:

- `src` is `host._stage ?? host._data`.
- If the `*save` attribute is `"user theme"`, Sercrod builds:

  - `data = { user: src.user, theme: src.theme }` (if those properties exist).

- The JSON file contains only `user` and `theme` at the top level.
- Nested paths (such as `user.name`) are not supported by `*save` directly.


#### Evaluation timing

Render-time:

- When Sercrod renders the host, it looks for elements with `*save` or `n-save`.
- For each such element:

  - Sercrod clones the element.
  - Attaches a click handler on the clone.
  - Appends the clone to the parent.
  - Returns from the element renderer without recursing into the children of that clone.

Click-time:

- When the user clicks the `*save` button:

  1. Sercrod reads the `*save` / `n-save` attribute value and parses it into a property list, if present.
  2. Sercrod selects `src = this._stage ?? this._data` from the host.
  3. It builds a plain object:

     - Entire `src` if no property list was provided.
     - A subset object if a property list was provided.

  4. It serializes that object with `JSON.stringify(data, null, 2)`.
  5. It creates a Blob, a temporary `<a>` element, and triggers a download with a timestamped name.
  6. It dispatches the `sercrod-saved` event from the host.

Because the JSON is built at click time, `*save` always reflects the current state of `_stage` or `_data` at the moment of the click.


#### Execution model

Internally, `*save` behaves as follows (conceptually):

1. During render, Sercrod finds an element `work` with `*save` or `n-save`.
2. Sercrod clones `work` into `el`.
3. Sercrod attaches:

   - `el.addEventListener("click", () => { /* build JSON and download */ })`.

4. Sercrod appends `el` to the parent node and returns, without processing `el`’s children for further Sercrod directives.

On click, the handler:

1. Reads the attribute value to obtain a property list (or `null` if empty).
2. Selects `src`:

   - `src = host._stage ?? host._data`.

3. Builds `data`:

   - If there is a property list, `data` is a new object populated only with properties present in `src`.
   - Otherwise, `data` is `src` itself.

4. Serializes `data` with a pretty-printed `JSON.stringify(data, null, 2)`.
5. Creates a Blob of type `application/json`.
6. Creates an `ObjectURL` and a temporary `<a>` element with:

   - `href = url`.
   - `download = "Sercrod-YYYYMMDD-HHMMSS.json"` (in the local time of the browser).

7. Programmatically clicks the anchor to prompt download.
8. Cleans up (removes the anchor from the DOM and revokes the `ObjectURL`).
9. Dispatches `CustomEvent("sercrod-saved", { detail: { ... } })` from the host.


#### Use on nested elements and scope

- `*save` must live inside a Sercrod host to be meaningful, since it reads from the host’s `_stage` or `_data`.
- `*save` does not use per-element scope; it only uses the host’s data object.
- Placing `*save` on a deeply nested element is allowed, but it still always saves the surrounding host’s data, not a subset scoped by `*for` or `*each`.

In other words:

- The location of the `*save` button in the DOM tree does not change the data source.
- It only changes where the button appears in the layout.


#### Events

After starting the download, `*save` dispatches a bubbling, composed `CustomEvent` from the host:

- Event type:

  - `"sercrod-saved"`

- Event detail structure:

  - `detail.stage`: `"save"` (a simple tag for the workflow stage).
  - `detail.host`: the Sercrod host element (`<serc-rod>` instance).
  - `detail.fileName`: the file name used for the download (for example `"Sercrod-20251205-093000.json"`).
  - `detail.props`: the property list array if provided; `null` if no list was specified.
  - `detail.json`: the JSON string that was generated.

Example hook:

```js
document.addEventListener("sercrod-saved", (evt) => {
  const { host, fileName, props, json } = evt.detail;
  console.log("Saved from host:", host.id);
  console.log("File name:", fileName);
  console.log("Props:", props);
  console.log("JSON preview:", json.slice(0, 200));
});
```

You can use this event to:

- Mirror the saved JSON to another storage (for example IndexedDB, localStorage, or a custom API).
- Show a toast notification after the download is triggered.
- Log or audit save operations.


#### Best practices

- Treat `*save` elements as simple buttons:

  - Because the renderer does not recursively process children of `*save` hosts after cloning, avoid placing other Sercrod directives inside the same element.
  - Use plain text or static markup inside the button where possible.

- Use property lists for focused exports:

  - If your host data is large, consider exposing smaller subsets via:

    - `*save="profile settings"`
    - `*save="chart filters"`

- Keep the root data export-friendly:

  - Plan your top-level keys (`user`, `settings`, `rows`, `config`, and so on) so that it is easy to export meaningful subsets by name.

- Combine with `*load` for round trips:

  - Use `*save` to export JSON snapshots.
  - Use `*load` to re-import and merge them later into the same or a different host.

- Use `sercrod-saved` for integration:

  - Attach listeners to `"sercrod-saved"` if you want to route the JSON elsewhere instead of or in addition to the download.


#### Advanced - Using *save with *stage, *apply, *restore, *load, and *post

`*save` is part of a broader data management workflow:

- `*stage`:

  - Enables a staged buffer `_stage` for the host (a working copy of the data).
  - When `_stage` exists, `*save` prefers `_stage` over `_data`.
  - This lets you export the staged view without committing it.

- `*apply`:

  - Copies `_stage` into `_data` and updates the host.
  - Subsequent `*save` clicks, after `*apply`, will see the committed state in `_data`.

- `*restore`:

  - Rolls back `_stage` to the last snapshot, or to `_data` if no snapshot is available.
  - After a restore, `*save` again sees whatever `_stage` currently holds.

- `*load`:

  - Reads JSON from an `<input type="file">` and merges it into `_stage` or `_data`.
  - You can use `*load` to import a JSON file previously exported by `*save`.

- `*post`:

  - Sends host data to a server as JSON over HTTP.
  - `*save` is complementary to `*post`: one saves locally as a file, the other sends over the network.

The core rule is:

- `*save` always targets “the current data view” of the host, prioritizing `_stage` when present.
- This makes it safe to stage edits with `*stage`, try them out, export via `*save`, and later apply or restore as needed.


#### Notes

- `*save` and `n-save` are aliases.
- The value of `*save` is parsed as plain text and split by whitespace; it is not evaluated as an expression.
- When no property list is provided, the entire `_stage ?? _data` object is serialized.
- When a property list is provided, only the listed top-level properties are included if they exist.
- The file name is generated as `"Sercrod-YYYYMMDD-HHMMSS.json"` using the browser’s local time.
- `*save` itself does not change `_stage` or `_data`; it is a read-only export operation.
- There are no special structural restrictions specific to `*save` beyond the general behavior described above; it can be combined with directives such as `*if` on the same element, as long as you keep in mind that `*save` turns that element into a “save button” whose children are not further processed by Sercrod.
