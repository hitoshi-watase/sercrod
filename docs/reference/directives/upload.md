### *upload

#### Summary

`*upload` turns any element into an accessible file-upload trigger.  
It creates a hidden `<input type="file">` next to the element, lets the user pick one or more files, and sends them to a server endpoint using `XMLHttpRequest` plus `FormData`.  
On success, the response is stored into `$upload` and optionally into a named variable via `*into`, then a re-render is triggered.

#### Basic example

Upload a single file to `/api/upload` and capture the JSON response into `result`:

```html
<serc-rod data='{"result": null}'>
  <button *upload="'/api/upload'" *into="result">
    Upload file...
  </button>

  <p *if="result">
    <span *print="result.message"></span>
  </p>
</serc-rod>
```

Key points:

- The `*upload` value is a Sercrod expression. In this basic form it evaluates to a string URL.
- When the upload finishes successfully, the response body is assigned to `result` because of `*into="result"`.
- The same response is also exposed through `$upload` as a global one-shot value.

#### Behavior

- When Sercrod sees `*upload` (or its alias `n-upload`) on an element, it:
  - Clones the element (without children).
  - Evaluates the `*upload` expression in the current effective scope.
  - Normalizes the result into an option object `{ url, method, field, with, headers, credentials }`.
  - Ensures the clone is keyboard-clickable (through role and `tabindex`) if it was not already.
  - Creates (or reuses) a hidden `<input type="file" data-sercrod-generated="1">` as a child of the element.
  - Mirrors the element attributes `accept`, `multiple`, and `capture` onto the hidden input.
  - Registers `click` and `keydown` handlers that open the file picker.
  - Registers a `change` handler on the hidden input that starts the upload when files are selected.
- When the user selects files and confirms:
  - Sercrod dispatches a `sercrod-upload-start` event on the host `<serc-rod>` with `detail:{host, el, files, url, with}`.
  - Sercrod sends the files to the configured `url` using `XMLHttpRequest` and `FormData`.
  - As the upload progresses, `sercrod-upload-progress` events are dispatched with `detail:{host, el, loaded, total, percent}` whenever `lengthComputable` is true.
  - When the upload finishes, Sercrod:
    - Parses the text response as JSON if possible; otherwise keeps it as a string.
    - Dispatches `sercrod-uploaded` with `detail:{host, el, response, status}`.
    - Stores the response into `$upload` and/or the `*into` target (described below).
- If anything goes wrong:
  - During initial option evaluation or setup, Sercrod dispatches `sercrod-error` with `detail:{host, el, stage:"upload-init", error}`.
  - During the network request, Sercrod dispatches `sercrod-error` with `detail:{host, el, stage:"upload", error}`.

The `*upload` directive itself does not submit any surrounding `<form>` element and does not use `fetch`. It always uses `XMLHttpRequest` so that upload progress events are available.

#### Option object

The `*upload` value expression must evaluate to either:

- A string  
  - Interpreted as `{ url: "<that string>" }`
- An object  
  - Normalized to:

    - `url` (required) - Target URL for the upload.
    - `method` (optional) - HTTP method, defaults to `"POST"`.
    - `field` (optional) - Form field name for files, defaults to `"file"`.
    - `with` (optional) - Plain object of extra fields to append to the `FormData`.
    - `headers` (optional) - Extra request headers (for example CSRF tokens).
    - `credentials` (optional) - When truthy, enables `xhr.withCredentials`.

If the resolved value is not a string or an object with `url`, Sercrod throws inside `_normalize_upload_opts` and emits a `sercrod-error` with `stage:"upload-init"`.

Files are added to `FormData` as follows:

- For a single file: `fd.append(field, file)`.
- For multiple files: `fd.append(field + "[0]", file0)`, `fd.append(field + "[1]", file1)`, and so on.

Extra keys from `with` are appended directly to the same `FormData` instance.

You normally do not need to set a `Content-Type` header: `XMLHttpRequest` automatically sets the appropriate multipart boundary when sending `FormData`. If you do specify `Content-Type` yourself in `headers`, it will override this default, so use that only if you know exactly what you are doing.

#### Hidden input and host attributes

`*upload` always works via a hidden file input placed as a child of the element that carries `*upload`:

- The hidden input is created lazily once and reused on subsequent re-renders.
- It is positioned far off-screen using fixed positioning so it does not affect layout.
- The element attributes are mirrored:

  - `accept` on the element becomes `accept` on the hidden input.
  - `multiple` on the element becomes `multiple` on the hidden input.
  - `capture` on the element becomes `capture` on the hidden input.

When Sercrod re-binds the same DOM element (for example after an update where the node is reused), the options and the mirrored attributes on the hidden input are updated, but existing event listeners are reused.

#### Evaluation timing

- The `*upload` expression is evaluated during binding:

  - On the first render of the element with `*upload`.
  - On subsequent updates when the same DOM element is re-bound (for example when its `*upload` value or other data dependencies change but the element itself is reused).

- The expression is not re-evaluated on every click.  
  To change the upload target or options dynamically, update your data and let Sercrod re-render so that `_bind_upload` runs again and refreshes the options.

Any error during expression evaluation is reported through `sercrod-error` (`stage:"upload-init"`) and prevents the upload handler from being configured or refreshed.

#### Execution model

1. Sercrod renders the element and binds `*upload`.
2. The user activates the element by click or keyboard.  
   The hidden file input is programmatically clicked and the file picker dialog appears.
3. On file selection, the `change` handler fires:
   - If there are no files (user cancels), nothing happens.
   - Otherwise Sercrod emits `sercrod-upload-start`, builds a `FormData`, and calls `_xhr_upload`.
4. `_xhr_upload` wires up:
   - Progress events (`XMLHttpRequest.upload.onprogress`) to emit `sercrod-upload-progress`.
   - Completion to either resolve with `{status, body}` or reject with an error.
5. On success, Sercrod:
   - Emits `sercrod-uploaded`.
   - Writes the response body into data (see "Variable creation and *into").
   - Schedules a re-render via `update(true)`.
6. After the render cycle finishes, Sercrod internal `_finalize` runs:
   - It resets `$upload` and `$download` to `null`.
   - It clears any variables that were registered via `*into` for this cycle by setting them to `null`.
   - It leaves the rest of the data object untouched.

The upload is purely client-side. Sercrod does not retry failed uploads and does not perform automatic backoff. Such policies should be implemented on top using the exposed events.

#### Variable creation and *into

`*upload` does not create any loop variables or local aliases.  
Instead, it writes to the data object when an upload completes.

- Default behavior (no `*into`):

  - The response body is stored in `$upload`.
  - `$upload` is then reset to `null` by `_finalize` after the render cycle completes.
  - This makes `$upload` a convenient "last upload result" scratch space.

- With `*into` or `n-into` on the same element:

  - Sercrod reads the attribute value (for example `*into="result"`).
  - On success, the response is assigned to `this._data[result]`.
  - The key is recorded internally so that `_finalize` can later clear it by writing `null`.
  - `$upload` is also populated on the first truthy response, if it was not already set.

In other words, `*into` provides a one-shot local variable for the response, while `$upload` is a shared, short-lived global.

Example:

```html
<serc-rod data='{"profile": null}'>
  <button *upload="'/api/profile/upload-avatar'" *into="profile">
    Upload avatar
  </button>

  <div *if="profile">
    <p>Avatar updated.</p>
    <p *print="profile.url"></p>
  </div>
</serc-rod>
```

If you need to persist the response beyond a single render cycle, copy it from `$upload` or the `*into` target into a more permanent field (for example `state.last_upload`) inside an event handler or a computed expression.

#### Scope layering and parent access

The `*upload` expression is evaluated in the same effective scope as other data directives:

- It sees the current host data.
- It sees variables introduced by surrounding `*let`.
- Inside loops (`*for`, `*each`), it sees the loop variables for the current iteration.
- It can access outer data through normal property access (for example `parent.user.id` if you exposed `parent` yourself).

`*upload` does not change the scope for its children: the element content is rendered with the same scope that was used to evaluate the `*upload` expression.

#### Use with conditionals and loops

`*upload` can be combined with conditional rendering and loops, with a few points to keep in mind.

- Wrapping in `*if`:

  - It is often useful to show or hide the upload button based on state:

    ```html
    <button *if="can_upload" *upload="'/api/upload'">
      Upload file
    </button>
    ```

  - When the `*if` condition switches from false to true, the element is re-created and `*upload` is bound again, re-evaluating its expression.

- Inside `*for` or `*each`:

  - You can generate multiple upload buttons from a list:

    ```html
    <button
      *each="folder in folders"
      *upload="{ url: '/api/upload', with: { folder_id: folder.id } }"
    >
      Upload to <span *print="folder.name"></span>
    </button>
    ```

  - Each instance gets its own hidden input and its own options.  
    Uploaded files for each button update data independently (often via different `*into` targets).

- Combining with other control directives on the same element:

  - As with other Sercrod directives, only one structural control branch is applied per element during rendering.
  - In practice, you should avoid mixing `*upload` on the same element with other directives that also want to own rendering (for example `*template`, `*include`, `*import`).
  - Use wrapping elements instead:

    ```html
    <div *if="ready">
      <button *upload="'/api/upload'">Upload</button>
    </div>
    ```

This pattern keeps the responsibility of each directive clear and predictable.

#### Events and UI integration

`*upload` is designed to be driven from events:

- `sercrod-upload-start` - Fired on the host `<serc-rod>` when an upload begins.

  - `detail.host` - The host element instance.
  - `detail.el` - The element that has `*upload`.
  - `detail.files` - The selected files.
  - `detail.url` and `detail.with` - The resolved URL and extra payload.

- `sercrod-upload-progress` - Fired as the upload proceeds (when the browser can compute total size).

  - `detail.loaded` / `detail.total` - Bytes sent vs total.
  - `detail.percent` - Rounded percentage from 0 to 100.

- `sercrod-uploaded` - Fired when the upload completes successfully.

  - `detail.response` - Parsed JSON or plain string body.
  - `detail.status` - HTTP status code.

- `sercrod-error` - Fired on errors.

  - `detail.stage` is `"upload-init"` if the options could not be evaluated or normalized.
  - `detail.stage` is `"upload"` for network or HTTP-level errors.

You can handle these events using Sercrod event attributes on the element with `*upload`. For example:

```html
<button
  *upload="'/api/upload'"
  @sercrod-upload-start="log('upload started', $event.detail)"
  @sercrod-upload-progress="progress = $event.detail.percent"
  @sercrod-uploaded="last_result = $event.detail.response"
>
  Upload file
</button>
```

This lets you drive progress bars, disable other controls while an upload is active, or copy the response into long-lived state.


#### Server-side contract for *upload

`*upload` is slightly different from `*post`, `*fetch`, and `*api` on the request side, but it benefits from the same “Sercrod API style” on the response side.

Server-side expectations:

- Request shape:

  - Sercrod always sends files using `multipart/form-data` via `XMLHttpRequest` and `FormData`.
  - Files are placed under a configurable field name:
    - Default: `"file"`.
    - Custom: the `field` property of the `*upload` option (for example `field: "avatar"`).
  - When multiple files are allowed, Sercrod appends them as `field[0]`, `field[1]`, and so on.
  - Any extra data passed through the `with` option is appended to the same `FormData` as simple text fields.

- Response shape:

  - The HTTP response body is read as text and then:
    - Parsed as JSON when possible.
    - Left as a plain string when JSON parsing fails.
  - The resulting value is stored directly into:
    - `$upload` (global, short-lived).
    - And, if `*into="name"` is present, `data[name]` for the current host.
  - There is no `URL[:prop]` shorthand for `*upload`. If you want to expose only a particular property, design your JSON envelope accordingly or copy the property into another field after the upload.

Recommended approach on the server:

- Treat `*upload` endpoints as file-plus-metadata variants of the same Sercrod API style:

  - Accept `multipart/form-data` with:
    - One or more file fields under a known field name.
    - Optional additional fields corresponding to the `with` payload.
  - Always return a JSON response for both success and application-level errors.
  - Reuse the same JSON envelope that you use for `*post` / `*fetch` / `*api`, so that `*into` and `$upload` can be wired consistently.

Benefits:

- You can use a single “Sercrod API style” on the backend:

  - File uploads (`*upload`) and pure JSON calls (`*post`, `*fetch`, `*api`) share the same response contract.
  - Monitoring and logging can treat all Sercrod endpoints uniformly.
  - Frontend code can handle upload results in the same way it handles other API responses.

- For existing upload endpoints:

  - You can typically integrate by:
    - Matching the expected field name using the `field` option.
    - Adding any legacy flags or identifiers through the `with` option.
    - Adjusting the handler to always return a JSON envelope.
  - This lets you gradually align older upload handlers with the Sercrod API style without breaking existing behavior.


#### Best practices

- Prefer server endpoints that accept `multipart/form-data` and do not require you to manually craft `Content-Type` headers.
- Use the element `accept` attribute to restrict selectable file types (for example `accept="image/*"`).
- Add `multiple` when you want to allow multiple files in a single upload.
- Add `capture` for camera or microphone capture on supporting mobile browsers.
- Keep the upload element simple and clearly labeled so that users discover it easily.
- Treat `*into` and `$upload` as short-lived slots: copy anything you need to preserve into stable data fields.
- Handle errors via `@sercrod-error` on the host or by listening for `sercrod-error` and showing user-friendly messages.


#### Notes

- Alias attribute `n-upload` behaves identically to `*upload` and exists for environments where `*` is inconvenient in attribute names.
- `*upload` uses `XMLHttpRequest` instead of `fetch` so that upload progress is observable. You should not mix this with separate manual `fetch` logic for the same file input; keep the flow inside Sercrod.
- `*upload` does not submit a surrounding `<form>`. If you need to send other form fields along with the files, pass them through the `with` option or design a dedicated endpoint that accepts both.
- The hidden file input is internal to Sercrod. Do not try to style or access it directly; always wire your UI and logic to the element that carries `*upload`.
