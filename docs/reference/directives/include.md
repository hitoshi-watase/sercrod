### *include

#### Summary

`*include` injects the inner content of a named template into the current element.
The host element stays in the DOM as a single wrapper, and only its `innerHTML` is replaced.
It has an alias `n-include`.

`*include` works with templates declared by `*template` (or `n-template`) in the current Sercrod world or ancestor worlds.
After injecting the template content, Sercrod continues to process that content as normal children (conditions, loops, bindings, events, and so on).

Important structural restriction:

- A single element must not combine `*include` with `*each` or `*import`.
  These directives all want to control the host’s children, so they are not allowed on the same element.


#### Basic example

A local template and an include:

```html
<serc-rod id="app" data='{"user":{"name":"Alice","role":"admin"}}'>

  <!-- Template declaration -->
  <template *template="user-card">
    <article class="user-card">
      <h2 *print="user.name"></h2>
      <p *print="user.role"></p>
    </article>
  </template>

  <!-- Include: insert the template here -->
  <section>
    <div *include="user-card"></div>
  </section>

</serc-rod>
```

Behavior:

- The `<template *template="user-card">` defines a reusable template named `user-card`.
- The `<div *include="user-card">` replaces its `innerHTML` with the inner HTML of the template.
- The resulting DOM under `<div>` is equivalent to:

  ```html
  <div>
    <article class="user-card">
      <h2>Alice</h2>
      <p>admin</p>
    </article>
  </div>
  ```

- The included content is then rendered with the same scope as the `*include` host, so `user.name` and `user.role` are available inside the template body.


#### Behavior

Conceptually, `*template` and `*include` have these roles:

- `*template`:
  - Registers a reusable template under a string name.
  - Stores a deep clone of the original element as the template prototype.
  - The template prototype is not rendered by itself.

- `*include`:
  - Finds a registered template by name.
  - Copies the template prototype’s `innerHTML` into the host element.
  - Leaves the host element itself in place.
  - Removes `*include` / `n-include` from the rendered element so children can be processed normally.

Key points:

- `*include` copies only the template’s `innerHTML`, not the template element itself.
  - If the template is `<template *template="card"> ... </template>`, the content between the tags is inserted.
  - If the template is `<div *template="card"> ... </div>`, only the children of that `<div>` are inserted.
- Included content is rendered as if it had been written directly inside the `*include` host.


#### Template name and expression syntax

The value of `*include` is a Sercrod expression that must resolve to a template name string.

Typical patterns:

- Direct string literal:

  ```html
  <div *include="'user-card'"></div>
  ```

- Bare identifier resolved from data:

  ```html
  <serc-rod data='{"currentTemplate":"user-card"}'>
    <div *include="currentTemplate"></div>
  </serc-rod>
  ```

- Expression that computes a name:

  ```html
  <div *include="isAdmin ? 'admin-card' : 'user-card'"></div>
  ```

Resolution rules (as implemented by `_resolve_template_name`):

1. Sercrod first tries to evaluate the raw text as an expression in the current scope, in `include` mode.
   - If evaluation succeeds and yields a non-empty string, that string is used as the template name.
   - Errors such as `ReferenceError` are suppressed (quiet mode), so they do not print console warnings.

2. If expression evaluation does not yield a usable name:
   - If the raw text looks like a simple identifier (letters, digits, underscore, hyphen), Sercrod uses it directly as the name.
   - Otherwise, the name resolution fails.

3. If the final name is empty or no template with that name exists in any accessible world, `*include` fails and behaves as described in the error handling section below.

Practical guidance:

- Prefer explicit string literals (`'card'`) or data-bound strings (`currentTemplate`) for clarity.
- Avoid relying on implicit identifier fallbacks unless you really want to treat the raw attribute text as the template name.


#### Template lookup and worlds

Templates are stored per Sercrod world:

- When you declare `*template="name"` inside a `<serc-rod>` host, Sercrod saves a deep clone of that element as a template prototype in that host’s world.
- `*include` searches for the template name in two stages:
  1. The current world’s registry (`this._template_registry`) if it exists.
  2. Parent worlds via `_lookupTemplateNear(name)`:
     - Sercrod climbs the chain of Sercrod instances (worlds) upward.
     - The first world that has a matching template returns its prototype.

Effect:

- Templates are local to a world, but nested worlds can reuse templates from ancestors.
- You can define shared templates in an outer layout and include them from inner components.


#### Evaluation timing

Within the rendering pipeline, `*include` is evaluated after `*template` registration and before normal child rendering of the host:

- First, `*template` or `n-template` on elements is processed and registered.
- Then, for each node with `*include` or `n-include`:
  1. Sercrod resolves the template name.
  2. If successful, it sets `node.innerHTML` to the template prototype’s `innerHTML`.
  3. It removes `*include` / `n-include` from the rendered element.
- After that, Sercrod proceeds to render the children, which now consist of the included content.

Important:

- The included content is processed in the same evaluation cycle as the host.
- Any directives inside the template body (`*if`, `*for`, `*each`, bindings, event handlers) are evaluated after the include has taken effect.


#### Execution model

At a high level, the implementation behaves as follows for a node `node` with `*include` or `n-include`:

1. Determine include depth:
   - Sercrod uses an internal map `_include_depth_map` plus `_get_nearest_include_depth(node)` to compute the nesting depth of this `*include` relative to surrounding `*include` and `*import` directives.
   - If the depth exceeds the configured maximum (`config.include.max_depth`, default 16):
     - If `config.include.warn_on_element` is `true`, Sercrod marks the rendered element with `sercrod-include-depth-overflow="<max_depth>"`.
     - It removes `*include` / `n-include` from the rendered element.
     - The include is skipped to prevent infinite recursion.

2. If the `*include` value is empty:
   - Sercrod removes `*include` / `n-include` from the source node.
   - No template is inserted.

3. Resolve the template name:
   - Sercrod calls `_resolve_template_name(raw_text, scope, {el: node, mode: "include"})`.
   - If name resolution fails (empty string):
     - If `this.error?.warn` is enabled:
       - Optionally marks the source node with `sercrod-template-not-found="<raw_text>"` when `config.include.warn_on_element` is `true`.
       - Removes `*include` / `n-include` from the source node.
     - The include is skipped.

4. Find the template:
   - If the current world has a template registry and it contains `name`, that template is used.
   - Otherwise, `_lookupTemplateNear(name)` searches parent worlds.
   - If no template is found anywhere:
     - If `this.error?.warn` is enabled:
       - Optionally marks the rendered element with `sercrod-template-not-found="<name or raw_text>"` when `config.include.warn_on_element` is `true`.
       - Removes `*include` / `n-include` from the rendered element.
       - If `config.include.remove_element_if_empty` is false, the host element is still appended, potentially empty.
     - The include is skipped.

5. Inject the template content:
   - If a template is found, Sercrod obtains its prototype `proto`.
   - It sets `node.innerHTML = proto.innerHTML || ""`.
   - It removes `*include` / `n-include` from the rendered element.
   - It does not return early at this point: normal child rendering continues, now processing the included children.

This model keeps `*include` simple and predictable: name resolution, template lookup, then direct HTML injection followed by a standard child-rendering pass.


#### Variable creation and scope layering

`*include` does not create new variables or a new data layer.

- The included template body is rendered in the same scope as the `*include` host.
- All variables and helpers that are visible at the host are also visible in the included content:
  - Data bound to `<serc-rod>` (for example `user`, `items`, `state`).
  - Special helpers such as `$data`, `$root`, `$parent`.
  - Methods defined by `*methods` or similar configuration.

If the template itself defines additional directives (for example `*let`):

- Those directives behave exactly as if they had been written directly inside the host.
- Any variables created by `*let` inside the template body are scoped to the template body and shadow outer variables with the same name.

Guidelines:

- Think of `*include` as a textual template expansion that runs in the current scope.
- Do not expect an isolated component-like scope; for that you can nest a new `<serc-rod>` block inside the template.


#### Parent access

Because `*include` does not introduce a new world or host, parent data access works in the usual way:

- `$root` refers to the root data of the nearest Sercrod host.
- `$parent` refers to the data of the parent Sercrod world if you are inside a nested Sercrod.
- Any plain data objects (for example `state`, `config`) are referenced exactly as in normal templates.

The only change is that the HTML you wrote under `*template` is now located under the `*include` host at render time.


#### Use with conditionals and loops

`*include` is designed to cooperate with `*if`, `*for`, and `*each`, as long as they are on different structural layers.

Host-level condition:

- You can guard an include with `*if` on the same element:

  ```html
  <div *if="user" *include="'user-card'"></div>
  ```

- Evaluation order:
  - Host-level `*if` is processed before `*include`.
  - If the condition is falsy, the element is not rendered at all, and `*include` is never evaluated.

Host-level loops:

- `*for` on the same element as `*include` is allowed and repeats the host:

  ```html
  <ul>
    <li *for="user of users" *include="'user-item'"></li>
  </ul>
  ```

- For each iteration of `*for`:
  - Sercrod evaluates `*include`, injects the `user-item` template into the `<li>`, and then renders its children.
  - The template body can use the loop variable `user`.

Child-level condition and loops:

- Inside included content, you can freely use `*if`, `*for`, and `*each`:

  ```html
  <template *template="user-item">
    <article>
      <h2 *print="user.name"></h2>
      <ul *each="tag of user.tags">
        <li *print="tag"></li>
      </ul>
    </article>
  </template>
  ```

- From the point of view of these directives, there is no difference between inline markup and markup that arrived via `*include`.


#### Relationship with *import

`*import` is the I/O counterpart of `*include`:

- `*include`:
  - Uses templates that are already registered in the current page via `*template`.
  - Works only with in-memory templates.

- `*import`:
  - Resolves a URL from its expression (or from the literal attribute text if it looks like a URL).
  - Fetches HTML using a synchronous `XMLHttpRequest`, with optional configuration from `config.import`:
    - `method` (default `"GET"`).
    - `credentials` (boolean, for `withCredentials`).
    - `headers` (object of request headers).
  - Caches HTML per URL on the class in `_import_cache`.
  - On success, sets `node.innerHTML` to the fetched HTML, then removes `*import` / `n-import`.
  - On failure, can mark the rendered element with `sercrod-import-error` and either keep or drop the host based on `config.include.remove_element_if_empty`.

For the injected HTML, the behavior is intentionally parallel:

- Both `*include` and `*import` end up setting `node.innerHTML` and then letting the standard child rendering logic process the result.


#### Structural restrictions

Because `*include`, `*each`, and `*import` all want to control the host’s children, there are intentional restrictions:

- `*include` and `*each` must not appear on the same element:

  - `*each` treats the host’s original children as the loop body and repeats them.
  - `*include` overwrites the host’s `innerHTML` with template content.
  - Combining them on one element produces undefined behavior and is not supported.
  - Officially, Sercrod does not allow a single element to have both `*each` and `*include`.

- `*include` and `*import` must not appear on the same element:

  - Both want to provide the entire `innerHTML` for the host.
  - The runtime does not merge these operations.
  - A single element must not declare both directives.

- `*include` and `*template` on the same element:

  - If both are written, the `*template` logic runs first, registers the template, and returns without rendering the host.
  - The `*include` on that element is effectively ignored.
  - In practice, this combination is useless and should be avoided.

Recommended patterns:

- If you want to repeat a template, put `*each` on a container and `*include` (or `*import`) on a child element:

  ```html
  <ul *each="user of users">
    <li *include="'user-item'"></li>
  </ul>
  ```

- Or put `*include` / `*import` on a container, and let the imported template contain its own loops.


#### Comparison: *include vs *import

From the template system’s point of view:

- `*include`:

  - Source: a named template in the registry (`*template`).
  - Input: a template name (expression or identifier).
  - Transport: in-memory, no network.
  - Effect: copy `proto.innerHTML` into `node.innerHTML`, then render children.
  - Safety: depth is limited by `include.max_depth` to avoid infinite include loops.

- `*import`:

  - Source: external HTML content (file, endpoint, or module).
  - Input: an URL (expression or URL-like string).
  - Transport: synchronous HTTP (XMLHttpRequest) with a per-class cache.
  - Effect: set `node.innerHTML` to the received HTML string, then render children.
  - Safety: shares the same depth tracking (`_include_depth_map` and `include.max_depth`) to avoid recursive import chains.

Typical usage patterns:

- Use `*include` when:
  - The template is defined in the same document or in a Sercrod world that is already in memory.
  - You want predictable, purely in-memory reuse.

- Use `*import` when:
  - You want to load HTML from another file or service.
  - That HTML may contain `*template` declarations, reusable snippets, or complete fragments.
  - After the import, you can use `*include` to consume any templates defined in the imported content.

The string passed to `*import` is treated purely as an URL from Sercrod’s perspective.
If you use patterns like `"/partials/card.html:card"`, the `:card` part is just part of the URL and is not parsed specially by Sercrod itself.
Any such semantics (for example, serving only one named fragment from a combined file) must be implemented on the server side.


#### Best practices

- Prefer explicit names:
  - Use quoted literals (`'user-card'`) or string-valued data properties for template names.
  - This makes it clear which template is expected and avoids surprises when refactoring.

- Keep templates small and focused:
  - Use `*template` for logical blocks (cards, list items, table rows), not for entire pages.
  - Compose pages by including a few well-defined templates.

- Avoid deep include chains:
  - Although Sercrod has a depth guard (`config.include.max_depth`, default 16), very deep nesting is harder to reason about.
  - If you see `sercrod-include-depth-overflow`, review your include structure.

- Use worlds to structure templates:
  - Define shared templates in outer layouts and local templates closer to the components that use them.
  - Let world-based lookup resolve the nearest appropriate template.

- Do not mix conflicting structural directives:
  - Do not place `*include`, `*each`, and `*import` on the same element.
  - Keep the responsibility of each element clear.


#### Additional examples

Dynamic template selection:

```html
<serc-rod data='{
  "mode": "compact",
  "cards": [1,2,3]
}'>
  <template *template="card-compact">
    <div class="card compact">
      <p>Compact card</p>
    </div>
  </template>

  <template *template="card-full">
    <div class="card full">
      <p>Full card with details</p>
    </div>
  </template>

  <section *for="id of cards">
    <div *include="mode === 'compact' ? 'card-compact' : 'card-full'"></div>
  </section>
</serc-rod>
```

Using a template as a partial inside a layout:

```html
<serc-rod data='{"user":{"name":"Alice"}}'>

  <template *template="layout">
    <header>
      <h1>Sercrod demo</h1>
    </header>
    <main>
      <!-- Slot for content -->
      <div class="content">
        <!-- This area will be further filled by other includes or inline markup -->
      </div>
    </main>
    <footer>
      <small>Footer</small>
    </footer>
  </template>

  <div class="page" *include="'layout'">
    <!-- After include, the header/main/footer structure appears here -->
  </div>

</serc-rod>
```


#### Notes

- `*include` and `n-include` are aliases; choose one style per project for consistency.
- `*include` uses Sercrod’s expression evaluator in `include` mode and suppresses JavaScript-level reference errors.
- Template lookup is world-aware:
  - The current Sercrod world is searched first.
  - Parent worlds are searched next via `_lookupTemplateNear`.
- Depth and error diagnostics:
  - Excessive nesting of `*include` and `*import` can be flagged with `sercrod-include-depth-overflow` or `sercrod-import-depth-overflow` on the rendered element.
  - Missing templates can be flagged with `sercrod-template-not-found`.
  - Failed imports can be flagged with `sercrod-import-error`.
- Structural restrictions are part of the official Sercrod behavior:
  - A single element must not combine `*include` with `*each` or `*import`.
  - `*include` on an element that also has `*template` is effectively ignored for rendering and should be treated as invalid usage.
