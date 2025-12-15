### *import

#### Summary

`*import` loads HTML from an external URL and injects it into the current element’s `innerHTML`.
The imported HTML is then processed by Sercrod in the same render pass, so any directives inside the imported content (`*if`, `*for`, `*each`, `*include`, `*template`, and so on) are evaluated as usual.

Key points:

- `*import` and `n-import` are aliases.
- The directive resolves a URL string, fetches HTML with a synchronous XMLHttpRequest, caches the response per URL, and replaces the host’s inner content.
- Infinite or deeply nested `*include` / `*import` chains are guarded by a depth limit.
- A single element must not combine `*import` with `*each` or `*include`. Putting multiple structural directives on the same host is unsupported and leads to undefined behavior.


#### Basic example

Load a simple partial file:

```html
<serc-rod id="app" data='{"user":{"name":"Alice"}}'>
  <section *import="'/partials/user-card.html'"></section>
</serc-rod>
```

Behavior:

- Sercrod evaluates the expression `'/partials/user-card.html'` and resolves it to a URL string.
- It performs a synchronous HTTP request to that URL (with optional configuration).
- If the request succeeds and returns non-empty HTML, Sercrod assigns that HTML to `section.innerHTML`.
- Sercrod then continues rendering the `<section>` subtree, so any directives inside `user-card.html` are processed in the same pass.


#### Behavior

At a high level, `*import` does the following when encountered on an element:

1. It resolves a URL from the attribute value, using expression evaluation and simple heuristics.
2. It checks the current include/import nesting depth and refuses to exceed a configured `max_depth`.
3. It performs a synchronous HTTP request to download HTML from the resolved URL.
4. If HTML is successfully obtained, it replaces the element’s `innerHTML` with the fetched HTML.
5. It removes `*import` / `n-import` from the element.
6. It does not return early after filling `innerHTML` so that normal child rendering (including directives inside the imported HTML) can run immediately.

Alias:

- `*import` and `n-import` behave identically.
- Use one style consistently across your project.


#### URL resolution

The value of `*import` is interpreted as a URL in two steps:

1. **Expression evaluation**

   Sercrod first tries to evaluate the raw attribute value as an expression:

   - It calls `eval_expr(raw_text, scope, { el: node, mode: "import", quiet: true })`.
   - If the evaluation result is not `null` or `undefined`, Sercrod converts it to a string and trims it.
   - If the trimmed string is non-empty, that string becomes the URL.

   This allows patterns such as:

   ```html
   <serc-rod id="app" data='{"base":"/partials","name":"user-card.html"}'>
     <section *import="base + '/' + name"></section>
   </serc-rod>
   ```

2. **Fallback to raw text**

   If expression evaluation does not yield a usable string, Sercrod falls back to the raw attribute text and checks whether it “looks like a URL”:

   - The raw text must not contain whitespace.
   - If it starts with `http://` or `https://`, or
   - If it starts with `./`, `../`, or `/`, or
   - If it contains a dot `.` or a slash `/`,

   then the raw text is treated as the URL.

If neither step produces a non-empty URL string, or the URL becomes the literal `"false"`, the import is treated as invalid:

- The element’s `*import` / `n-import` attributes are removed.
- Depending on configuration, Sercrod may mark the element with `sercrod-import-invalid`.
- The element may or may not be kept in the DOM, depending on `remove_element_if_empty` (see configuration below).


#### Network loading and caching

Once a URL is resolved, `*import` uses a synchronous XMLHttpRequest to fetch HTML:

- It reads `this.constructor._config.import` (if present) to configure the request:

  - `method`: HTTP method, default is `"GET"`.
  - `credentials`: boolean, default is `false`. If `true`, `xhr.withCredentials` is set.
  - `headers`: plain object with additional HTTP headers.

- Responses are cached per URL in a class-level map:

  - If a cached entry exists and is non-empty, Sercrod skips the network request and uses the cached HTML.
  - If the cache is empty for that URL, Sercrod performs a network request and, on success, stores the response text.

Error handling:

- If the HTTP status code is not in the `2xx` range, Sercrod does not cache the response and may mark the element with `sercrod-import-error="<status>"`, depending on `warn_on_element`.
- If an exception occurs during the request, Sercrod may mark the element with `sercrod-import-error="exception"`, again depending on configuration.
- If no HTML is obtained (empty string), the import is considered failed:
  - `*import` / `n-import` are removed.
  - The element may be kept or dropped based on `remove_element_if_empty` (see below).

Note:

- Because `*import` uses a synchronous request, it can block the main thread during network I/O.
- For large or remote resources, consider server-side rendering, static generation, or pre-fetching strategies instead of heavy runtime imports.


#### Depth management and recursion guard

`*import` shares its depth tracking with `*include`:

- Sercrod maintains a numeric “include/import depth” in an internal WeakMap.
- Each `*include` or `*import` increments the depth relative to the nearest ancestor `*include`/`*import`.

Configuration:

- `this.constructor._config.include.max_depth` (or an internal `_include_max_depth`) limits the allowed depth.
- If a `*import` would exceed this `max_depth`:

  - When `warn_on_element` is true, the element is marked with `sercrod-import-depth-overflow="<max_depth>"`.
  - The `*import` / `n-import` attributes are removed.
  - Depending on configuration, the element may be appended in its current (unfilled) state, or import is simply skipped.

Practical meaning:

- You can safely use nested includes and imports, but extremely deep or cyclic chains will be stopped.
- This prevents infinite recursion between templates that import or include each other.


#### Evaluation timing

Within the host rendering pipeline, `*import` runs after template registration and `*include`, but before literal-only blocks:

- `*template` on the same element is processed first.
  - If an element has `*template`, it is treated as a template declaration and is not rendered; `*import` on the same element will effectively never run.
- `*include` is handled before `*import`.
- `*import` then resolves and injects HTML into the element’s `innerHTML`.
- After that, Sercrod continues normal child rendering, which means:
  - Directives inside the imported HTML are evaluated in the same pass.
  - Binding directives, event handlers, and nested loops inside the imported content work as expected.

The `*import` directive itself is one-time per render pass:

- Once processed, `*import` / `n-import` are removed, so the same element will not re-import content during the same render cycle.
- Re-imports only occur if the surrounding Sercrod host re-renders from scratch or if the element is re-created.


#### Execution model

The internal steps for `*import` are roughly:

1. **Depth and configuration**

   - Read include-related config (`max_depth`, `warn_on_element`, `remove_element_if_empty`).
   - Compute this element’s depth based on the nearest ancestor `*include` / `*import`.

2. **Depth check**

   - If depth exceeds `max_depth`, handle overflow (mark the element if configured, remove directive, optionally keep the element) and stop.

3. **Resolve raw text**

   - Read `*import` / `n-import` as `raw_text`.
   - If `raw_text` is empty, remove the attribute and stop.

4. **Resolve URL**

   - Attempt expression evaluation for `raw_text`.
   - If that yields no usable string, treat `raw_text` as a potential URL and apply simple heuristics.
   - If no URL can be chosen or the result is `"false"`, treat import as invalid, remove the directive, and stop (optionally marking the element).

5. **Fetch HTML**

   - Use class-level cache for the URL.
   - If not cached yet, perform a synchronous HTTP request with configured method, headers, and credentials.
   - If response status is `2xx`, treat `responseText` as HTML and cache it.
   - On error or exception, optionally mark the element, then stop if there is no HTML.

6. **Inject HTML and clean up**

   - Assign `node.innerHTML = html`.
   - Remove `*import` / `n-import` attributes from the element.
   - Do not return here; instead, let the renderer continue to process the new children so that directives inside the imported HTML are executed.


#### Scope and interaction with imported HTML

`*import` does not create new variables or new scope layers by itself:

- The imported HTML is treated as if it had been written inside the element from the start.
- Directives inside the imported content see the same scope as any other child of the host element:

  - They can access host data (for example `user`, `items`, `state`).
  - They can access `$data`, `$root`, `$parent`, and any injected methods.

If you want imported content to have a specific scope:

- Place `*import` on an element that already has the right data and context.
- Or combine import with `*let` or `*stage` on the same Sercrod host (but not on the same element if the directives would conflict structurally).

`*import` itself does not inject any new names into the scope.


#### Use with *template, *include, and *each

`*import` is one of several structural directives that take control of a host element’s children:

- `*template` registers a template and skips rendering the original element.
- `*include` resolves a template name and replaces the host’s `innerHTML` with the template’s body.
- `*import` fetches HTML from a URL and replaces the host’s `innerHTML` with the fetched content.
- `*each` transforms the host’s children into a loop body.

Because they all try to own the same inner content, there are important restrictions:

1. **`*import` with `*template` on the same element**

   - In the current implementation, `*template` is processed first and returns early.
   - That means `*import` on the same element never runs.
   - Treat this combination as unsupported; pick one or separate the responsibilities into different elements.

2. **`*import` with `*include` on the same element**

   - `*include` and `*import` both want to replace the host’s `innerHTML`.
   - The runtime does not merge their behaviors.
   - Putting both on the same element is unsupported and leads to undefined behavior.
   - Use either `*include` (for local templates) or `*import` (for external HTML), but not both on one tag.

3. **`*import` with `*each` on the same element**

   - `*each` expects to use the host’s original children as a loop body.
   - `*import` wants to overwrite those children with imported HTML.
   - The implementation does not coordinate these operations.
   - Therefore, a single element must not combine `*each` and `*import`. This combination is explicitly unsupported and should be avoided.

Supported pattern examples:

- `*import` on a container element, then use loops inside the imported HTML:

  ```html
  <section *import="'/partials/user-list.html'"></section>
  ```

- `*each` on the container and `*import` on a child:

  ```html
  <ul *each="user of users">
    <li *import="'/partials/user-row.html'"></li>
  </ul>
  ```

  Here:

  - `<ul>` is the loop container.
  - `<li>` is the template body per iteration.
  - The imported snippet can freely use `user` from the loop scope.

- `*import` to bring in a block that defines or uses `*template` inside:

  ```html
  <section *import="'/partials/templates.html'"></section>
  ```

  The imported HTML may register templates with `*template`, which can be used later by `*include` elsewhere.


#### Configuration

`*import` reads settings from the Sercrod constructor’s config object:

- `this.constructor._config.include`:

  - `max_depth`: maximum allowed depth for nested `*include` / `*import` (default is 16 if not overridden).
  - `warn_on_element`: if true, errors related to include/import depth or URL resolution are recorded as attributes on the element (for example `sercrod-import-depth-overflow`, `sercrod-import-invalid`, `sercrod-import-error`).
  - `remove_element_if_empty`: if true, elements whose include/import fails may be omitted entirely instead of being kept as empty placeholders.

- `this.constructor._config.import`:

  - `method`: HTTP method used for import requests (default `"GET"`).
  - `credentials`: boolean, mapped to `xhr.withCredentials`.
  - `headers`: object with additional headers, applied via `xhr.setRequestHeader`.

These configuration values are optional; if you do not set them, Sercrod uses sensible defaults.


#### Best practices

- Prefer `*include` for in-document templates:

  - When your content already lives in the same document, `*template` plus `*include` is usually simpler and faster than `*import`.

- Use `*import` for coarse-grained external HTML:

  - Import whole blocks or sections (cards, lists, layout pieces) rather than tiny fragments.
  - Each `*import` implies a synchronous request when not cached.

- Keep URLs simple and explicit:

  - Use quoted string literals or short expressions.
  - If you need to encode multiple pieces of information (for example file and section name), do it in the URL and let the server interpret it; Sercrod does not parse `":name"` postfixes in any special way.

- Avoid heavy or large imports during interaction:

  - Because `*import` is synchronous, it can introduce noticeable pauses for remote or slow resources.
  - For interactivity, prefer data-driven updates, JSON APIs, or pre-rendered HTML instead of repeated imports.

- Respect structural restrictions:

  - Do not put `*import` on the same element as `*each` or `*include`.
  - Avoid combining `*import` and `*template` on the same element; only `*template` will take effect.


#### Additional examples

Dynamic URL based on data:

```html
<serc-rod id="app" data='{"lang":"en","page":"about"}'>
  <main *import="`/pages/${lang}/${page}.html`"></main>
</serc-rod>
```

Using headers and credentials via config (conceptual sketch):

```js
Sercrod._config = Sercrod._config || {};
Sercrod._config.import = {
  method: "GET",
  credentials: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest"
  }
};
```

Then:

```html
<section *import="'/secure/partial.html'"></section>
```


#### Notes

- `*import` and `n-import` are aliases.
- The directive uses Sercrod’s expression sandbox for URL resolution but ultimately treats the resolved value as a plain string.
- Sercrod does not implement any special parsing for suffixes like `:card` in URLs. Such patterns are treated as part of the URL string and must be interpreted by your server if you use them.
- Infinite include/import recursion is prevented by a configurable depth limit that applies to both `*include` and `*import`.
- Structural combinations where multiple directives try to control the same host’s children (such as `*import` plus `*each`, or `*import` plus `*include`) are not supported and should be considered invalid usage.
