### *innerHTML

#### Summary

`*innerHTML` sets the DOM `innerHTML` property of an element from a Sercrod expression.
It is the low-level directive for inserting HTML markup as a string.
The alias `n-innerHTML` behaves identically.

Use `*innerHTML` when you already have an HTML string and you want to insert it as markup, not as plain text.
Unlike `*print` or `*textContent`, `*innerHTML` does not escape the value; it passes it through the global `html` filter and then assigns it directly to `el.innerHTML`.


#### Basic example

A simple example that renders an HTML fragment stored in data:

```html
<serc-rod id="app" data='{
  "contentHtml": "<strong>Hello</strong> <em>world</em>!"
}'>
  <p *innerHTML="contentHtml"></p>
</serc-rod>
```

Behavior:

- The `contentHtml` string is evaluated from the current scope.
- Sercrod calls the global `html` filter with that value.
- The result is assigned to the `<p>` element’s `innerHTML`.
- The `<p>` ends up containing `<strong>Hello</strong> <em>world</em>!` as real HTML, not as text.


#### Behavior

Core behavior:

- `*innerHTML` is a structural output directive that controls the inner markup of the host element.
- For each render of the host:
  - Sercrod evaluates the expression on `*innerHTML` in the current scope.
  - If the result is `null` or `false`, it is treated as an empty string.
  - Otherwise the raw value is passed to the global `html` filter:
    - `html(raw, { el, expr, scope })`.
  - The filter result is assigned to `el.innerHTML`.

Aliases:

- `*innerHTML` and `n-innerHTML` are aliases.
- They share the same evaluation pipeline; the only difference is the attribute name.

Relationship to `*print` and `*textContent`:

- `*print` and `*textContent` set `textContent` through the `text` filter.
- `*innerHTML` sets `innerHTML` through the `html` filter.
- `*print` and `*textContent` escape or normalize text; `*innerHTML` does not.
- If an element has both `*print`/`*textContent` and `*innerHTML`, the `*print`/`*textContent` branch runs first and returns, so `*innerHTML` on that element is effectively ignored.
  - In practice you should not combine them on the same element.


#### Evaluation timing

Within the rendering pipeline of a single element:

- Host-level `*if` and conditional chains (`*if`, `*elseif`, `*else`) are resolved first.
  - If the host `*if` condition evaluates to false, the element (and its directives) are skipped entirely; `*innerHTML` is not evaluated.
- `*include` and `*import` (if present on the same element) run earlier than `*innerHTML`.
  - They may rewrite `node.innerHTML` of the template but do not prevent `*innerHTML` from running.
- `*print` and `*textContent` run before `*innerHTML`.
  - If they match, they set `textContent`, append the element to the parent, and return; no later output directive runs.
- If none of the earlier output directives return, `*innerHTML` is evaluated.
- After `*innerHTML`, Sercrod continues with attribute bindings, style bindings, and finally recursive child rendering from the original template node.

Important consequence:

- The HTML string inserted by `*innerHTML` is not traversed by Sercrod’s renderer.
  - Sercrod still walks `node.childNodes` from the template, not the newly inserted HTML string.
  - Any Sercrod directives that appear inside the inserted HTML string are not compiled or bound by Sercrod.


#### Execution model

Conceptually, for an element `<div *innerHTML="expr">` the runtime behaves like this:

1. Clone the template node (without children) into `el`.
2. Resolve any earlier host-level directives (for example `*if`, `*include`, `*import`, `*literal`, `*rem`, `*print`, `*textContent`).
3. When the `*innerHTML` branch is reached:
   - Read the attribute value `expr` from the host.
   - Evaluate it with `eval_expr(expr, scope, { el: node, mode: "innerHTML" })`.
   - Map `null` or `false` to an empty string, otherwise use the returned value as `raw`.
   - Build a context object `{ el, expr, scope }`.
   - Call `Sercrod._filters.html(raw, ctx)` and assign the result to `el.innerHTML`.
4. Recursively render the original template children:
   - For each `child` in `node.childNodes`, call `renderNode(child, scope, el)`.
   - This may append Sercrod-generated child content after the HTML inserted by `*innerHTML`.
5. At the end of `_renderElement`, if `cleanup.directives` is enabled in the global config:
   - All attributes that are known Sercrod directives (including `*innerHTML` and `n-innerHTML`) are removed from `el`.
6. Append `el` to the parent and run any log hooks.

The inserted HTML string is therefore a one-shot, low-level injection step; Sercrod does not automatically apply its own directives inside that string.


#### Variable creation and scope layering

`*innerHTML` does not create new variables.

Its expression is evaluated in the normal Sercrod scope:

- The current data bound to the host (for example from `data` on `<serc-rod>`).
- Special injected variables:
  - `$data` for the current host’s data object.
  - `$root` for the root Sercrod host data.
  - `$parent` for the nearest ancestor Sercrod host data.
- Methods exposed via `*methods` or the global method injection mechanism.
- Internal helper methods registered in `Sercrod._internal_methods`.

There is no per-directive scope layering; `*innerHTML` simply looks at whatever is currently visible in the merged scope.


#### Parent access

`*innerHTML` does not alter parent relationships:

- You can read values from the root or parent using `$root` and `$parent` in the expression.
- The inserted HTML string does not introduce a new Sercrod scope; it is just markup.

Example:

```html
<serc-rod id="app" data='{
  "post": { "id": 1, "summaryHtml": "<p>Summary</p>" }
}'>
  <article>
    <header>
      <h1 *print="$parent.title"></h1>
    </header>
    <section *innerHTML="post.summaryHtml"></section>
  </article>
</serc-rod>
```

Here, `*innerHTML` sees `post.summaryHtml` from the current scope.
The `<h1>` can still use `$parent` or `$root` as usual.


#### Use with conditionals and loops

`*innerHTML` composes well with structural directives when they target different elements:

- Host-level condition:

  - If the same element has `*if` and `*innerHTML`, `*if` acts as a gate.

  ```html
  <section *if="post && post.summaryHtml" *innerHTML="post.summaryHtml"></section>
  ```

  - If the condition is falsy, the section is not rendered and `*innerHTML` is not evaluated.

- Child-level condition:

  - You can keep `*innerHTML` on a parent and put `*if` on children defined in the template.

  ```html
  <div *innerHTML="introHtml">
    <p *if="showNote" class="note">This note is rendered by Sercrod.</p>
  </div>
  ```

  - The `introHtml` string is injected as markup.
  - The `<p>` is still rendered or skipped by Sercrod based on `showNote`.

- Loops:

  - You can use `*innerHTML` inside a `*for` or `*each` loop body:

  ```html
  <ul *each="item of items">
    <li>
      <h3 *print="item.title"></h3>
      <div *innerHTML="item.summaryHtml"></div>
    </li>
  </ul>
  ```

  - Each iteration gets its own `<div>` whose HTML is taken from `item.summaryHtml`.

  - You can also put `*innerHTML` on the loop container if you want a static wrapper per loop, but usually it is clearer to keep HTML injection on child elements.


#### Use with templates, *include, and *import

`*innerHTML` shares the same low-level insertion mechanism (`innerHTML`) as `*include` and `*import`, but with different responsibilities:

- `*include`:
  - Resolves a named `*template`.
  - Copies the template’s `innerHTML` into `node.innerHTML` (the template node), not directly into `el`.
  - Leaves element tags and attributes in place.
  - Does not return; it allows Sercrod to walk the inserted template children and process their directives.

- `*import`:
  - Fetches HTML from a URL (using a synchronous XHR, with optional caching).
  - Writes the fetched HTML into `node.innerHTML`.
  - Removes `*import` / `n-import` from `el`.
  - Also relies on later child rendering to process any directives inside the imported HTML.

- `*innerHTML`:
  - Evaluates an expression to get an HTML string.
  - Passes it through the `html` filter.
  - Writes the result directly into `el.innerHTML`.
  - Does not touch `node.innerHTML`; Sercrod still walks the original template children.

Combined effect when used together:

- If you put `*include` or `*import` and `*innerHTML` on the same element:

  - `*include` / `*import` runs first and rewrites `node.innerHTML` for the template.
  - Later, `*innerHTML` sets `el.innerHTML` from the expression value.
  - Finally, Sercrod recursively renders `node.childNodes` (now coming from the include/import) into `el`.

  This means the final element can contain:

  - The markup produced by `*innerHTML` (through the `html` filter).
  - Plus additional children generated from the included/imported template.

- Although this is well-defined in the current implementation, it produces two separate sources of children on the same element and can be difficult to reason about.
  - In practice it is clearer to separate responsibilities:
    - Use `*include` / `*import` on one element.
    - Use `*innerHTML` on a nested element inside the included or imported content, or on a sibling container.

Recommendation:

- Treat `*innerHTML` as a low-level primitive for HTML injection.
- Use `*include` and `*import` for Sercrod-managed templates and remote HTML.
- Avoid designing APIs that rely on mixing them on the same element unless you have a very specific reason and fully understand the combined behavior.


#### Security and the html filter

The `html` filter is the main hook for controlling how HTML strings are inserted:

- Default definition in the runtime:

  - `html(raw, ctx) => raw`.

- Responsibilities:

  - This filter is the extension point for:
    - Sanitizing HTML to prevent XSS when values come from untrusted input.
    - Post-processing HTML strings before insertion (for example, rewriting links, adding attributes, or delegating to another HTML engine).

- When `html` throws:

  - If `error.warn` is enabled on the Sercrod instance, the runtime logs a warning:

    - It includes the message, the expression, the scope, and the element.

  - The element’s `innerHTML` is set to an empty string.

Guidelines:

- Never pass untrusted user input directly to `*innerHTML` without a proper sanitizer in the `html` filter.
- For trusted static or server-generated HTML, `*innerHTML` can be used as-is.
- For Markdown or other formats:
  - Convert them to HTML in normal JavaScript (for example, `renderMarkdownToHtml(text)`).
  - Apply sanitization and then return the safe string.
  - Sercrod simply calls your function through the expression.

Example with an external sanitizer:

```html
<script>
  function safeHtmlFromMarkdown(md){
    const html = renderMarkdownToHtml(md);     // your own converter
    return sanitizeHtml(html);                // your own sanitizer
  }
</script>

<serc-rod id="doc" data='{"bodyMd": "# Title"}'>
  <article *innerHTML="safeHtmlFromMarkdown(bodyMd)"></article>
</serc-rod>
```


#### Best practices

- Prefer `*print` or `*textContent` for plain text.
  - Use `*innerHTML` only when you intentionally need markup injection.

- Use the `html` filter for security:
  - Override `Sercrod._filters.html` to integrate a sanitizer when working with any untrusted input.

- Keep responsibilities separate:
  - Avoid combining `*innerHTML` with `*print` or `*textContent` on the same element; only one of them will take effect.
  - Avoid designing components that rely on mixing `*innerHTML` with `*include` or `*import` on the same element; prefer nesting instead.

- Keep expressions simple:
  - If HTML strings need complex assembly, build them in normal JavaScript functions and call those functions from `*innerHTML`.
  - This keeps templates readable and logic testable.

- Be aware of re-renders:
  - On each re-render of the host, `*innerHTML` rebuilds the inner markup from scratch.
  - Any state stored only inside the injected HTML (for example, manual event listeners or form values) may be lost unless you manage it separately.

- Do not expect Sercrod to process directives inside injected HTML:
  - The inserted string is not parsed by Sercrod.
  - If you need Sercrod directives inside dynamic content, use `*include` or `*import` so that `node.innerHTML` is updated before child rendering.


#### Additional examples

Fallback summary:

```html
<serc-rod id="post" data='{
  "post": {
    "title": "Post title",
    "summaryHtml": null
  }
}'>
  <h2 *print="post.title"></h2>
  <div *innerHTML="post.summaryHtml || '<p>No summary available.</p>'"></div>
</serc-rod>
```

- If `summaryHtml` is `null` or `false`, the expression falls back to the HTML snippet.
- `0` or an empty string are not treated as `null`/`false` by the directive and will still be inserted.

Combining `*include` with `*innerHTML` on nested elements:

```html
<template *template="post-card">
  <article class="post-card">
    <h2 *print="post.title"></h2>
    <div class="summary" *innerHTML="post.summaryHtml"></div>
  </article>
</template>

<serc-rod id="list" data='{"posts":[
  { "title": "First",  "summaryHtml": "<p>First summary</p>" },
  { "title": "Second", "summaryHtml": "<p>Second summary</p>" }
]}'>
  <section *each="post of posts">
    <div *include="'post-card'"></div>
  </section>
</serc-rod>
```

- `*include` copies the `post-card` template into the innerHTML of the `<div>`.
- Inside that template, `*innerHTML` injects `post.summaryHtml` as markup.
- This pattern keeps Sercrod templates in control while using `*innerHTML` only where HTML strings already exist.


#### Notes

- `*innerHTML` and `n-innerHTML` are functionally identical; choose one naming style per project.
- The directive maps `null` and `false` to an empty string; other values (including `0` and empty strings) are passed to the `html` filter as-is.
- Errors in the `html` filter produce an optional console warning and clear the element’s innerHTML.
- Inserted HTML strings are not scanned for Sercrod directives; they are treated as plain DOM content.
- When `cleanup.directives` is enabled, `*innerHTML` and `n-innerHTML` attributes are removed from the output DOM like other Sercrod directives.
