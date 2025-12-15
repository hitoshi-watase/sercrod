### *compose

#### Summary

`*compose` composes the contents of a single element from the result of an expression and writes it into the element as HTML via the `html` filter.
It is the structural counterpart of `*innerHTML` and has an alias `n-compose`.

Key ideas:

- The expression is evaluated once per render in the normal Sercrod expression sandbox.
- The result is passed through `Sercrod._filters.html(raw, ctx)` and then assigned to `innerHTML` of the rendered element.
- `*compose` does not create new local variables; it only consumes the current scope.
- At runtime it shares the same pipeline as `*innerHTML`, but projects are expected to give `*compose` a higher-level meaning (for example, composing from templates, partials, or hosts) by customizing the `html` filter.

Alias:

- `*compose` and `n-compose` are aliases; they accept the same syntax and behave identically.


#### Basic example

A basic composition from a precomputed HTML string:

```html
<serc-rod id="app" data='{
  "cardHtml": "<div class=&quot;card&quot><h2>Title</h2><p>Body</p></div>"
}'>
  <section class="wrapper">
    <div class="slot" *compose="cardHtml"></div>
  </section>
</serc-rod>
```

Behavior:

- Sercrod evaluates `cardHtml` in the current scope.
- The result is passed through `Sercrod._filters.html` and becomes the `innerHTML` of the `<div class="slot">`.
- The `<section>` and `<div>` themselves are created as normal elements; only the `<div>`’s content is supplied by `*compose`.


#### Behavior

At a high level, `*compose`:

- Targets the **children** of the host element, not the element itself.
- Evaluates its expression once per render of the host.
- Treats `null` and `false` as “empty content”.
- Uses the `html` filter to transform the raw result into the final HTML string.

Details:

- Host element:

  - The host element is cloned and appended to the parent as usual.
  - All other bindings on the host (`:class`, `:style`, attribute bindings, `n-class`, `n-style`, etc.) still apply.

- Content:

  - The expression on `*compose` is evaluated in the current scope.
  - The value is normalized:

    - If `v` is `null` or `false`, it is treated as `""`.
    - Otherwise the value is passed as-is to the `html` filter.

  - The final `innerHTML` of the rendered element is:

    - `el.innerHTML = Sercrod._filters.html(raw, { el, expr, scope })`.

- Default filter:

  - By default, `Sercrod._filters.html` returns `raw` as-is.
  - That means, without customization, `*compose` behaves like “evaluate an expression and insert the result as raw HTML”.

- Interaction with children:

  - `*compose` runs **before** Sercrod recursively renders the template’s child nodes.
  - After `innerHTML` is set, Sercrod still walks `node.childNodes` (the template children) and renders them into the same element.
  - In common usage, you normally give the host no children when using `*compose`, or treat those children as optional “extra” content.


#### Evaluation timing

Within `_renderElement`, `*compose` takes part in the following order:

- The host must first survive structural directives:

  - `*if` / `n-if` on the same element are evaluated earlier; if they fail, the element is not rendered and `*compose` is not reached.
  - Structural loops like `*for` / `n-for` and `*each` / `n-each` are processed earlier and return after they finish, so `*compose` never runs on elements where those loops took effect.

- Scalar text directives have priority:

  - `*print` / `n-print` and `*textContent` / `n-textContent` are evaluated before `*compose`.
  - When any of those directives run, they set `textContent`, append the element, and return; `*compose` is skipped entirely.

- Static text with `%...%` expansion also runs before `*compose`:

  - If there is exactly one text child and it contains `%` markers, Sercrod uses `_expand_text`, appends the result, and returns.

- Only when the element has not been handled by the above cases does Sercrod check for `*compose` / `n-compose` or `*innerHTML` / `n-innerHTML`.

After `*compose`:

- Sercrod continues with:

  - `*class` / `n-class`, `*style` / `n-style`.
  - Other attribute bindings.
  - Recursive rendering of `node.childNodes`.
  - Any `postApply` work for things like `<select>`.

Implications:

- `*compose` is **non-structural**; it does not short-circuit rendering.
- It is best thought of as a “content injection” step in the later part of the element pipeline.


#### Execution model

Conceptually, the engine behaves as follows when it hits `*compose`:

1. Decide which attribute to read:

   - If the element has any of `*compose`, `n-compose`, `*innerHTML`, or `n-innerHTML`, one of those names is chosen as `srcAttr`.
   - Only one attribute is used; others are ignored for this step.

2. Read the expression:

   - `expr = node.getAttribute(srcAttr)`.

3. Evaluate the expression:

   - `v = eval_expr(expr, scope, { el: node, mode: "compose" or "innerHTML" })`.
   - Any variables in the expression are resolved from the merged scope and special helpers.

4. Normalize the result:

   - If `v` is `null` or `false`, treat it as `""`.
   - Otherwise, use it as `raw`.

5. Call the `html` filter:

   - `ctx = { el, expr, scope }`.
   - `htmlString = Sercrod._filters.html(raw, ctx)`.

6. Write into `innerHTML`:

   - `el.innerHTML = htmlString`.

7. On error:

   - If evaluation or filtering throws, Sercrod logs a `[Sercrod warn] html filter:` message (when `error.warn` is enabled).
   - `el.innerHTML` is set to an empty string.

After that, the standard rendering pipeline continues, including child rendering and post-apply actions.


#### Integration with the html filter

`*compose` is tightly coupled with the `html` filter:

- Default behavior:

  - The built-in `html` filter is:

    - `html: (raw, ctx) => raw`

  - So by default, `*compose="expr"` is equivalent to:

    - `el.innerHTML = exprResult`.

- Custom behavior:

  - Before Sercrod starts, you can define `window.__Sercrod_filter.html` to override the `html` filter:

    - `Sercrod._filters` is initialized by merging the built-in filters with `window.__Sercrod_filter` once at startup.
    - This is the intended hook for project-specific HTML composition.

  - The `ctx` object gives the filter access to:

    - `ctx.el` - the rendered element.
    - `ctx.expr` - the raw expression string.
    - `ctx.scope` - the evaluation scope at the time of the call.

  - A project can:

    - Treat specific values as template or partial names.
    - Resolve host references and build HTML from other Sercrod hosts.
    - Apply sanitization or escaping before insertion.


#### Security considerations

`*compose` ultimately writes to `innerHTML` and does not perform any built-in escaping.
This is a standard XSS risk surface: if the value you compose contains active HTML (such as script tags or event handlers) and that content comes from untrusted input, it may execute in the browser.

This manual’s role is to clearly document that behavior, not to claim that a particular pattern is always safe.
Even when you apply sanitization in the `html` filter, no single step can guarantee that all XSS vectors are eliminated.
In practice, XSS protection is a multi-layer task that includes server-side validation, output encoding, and careful template design.

Within that broader context, Sercrod expects at least the following minimum precautions when using `*compose`:

- Do not pass raw user input directly into `*compose`.
- Prefer to keep `*compose` values under your control (for example, prebuilt fragments, trusted templates, or server-side generated HTML that has already been validated).
- If you need to deal with untrusted data, use the `html` filter to sanitize or strip active content, and consider handling such data with text-based directives like `*print` or `*textContent` instead of composing HTML around it.
- Treat `*compose` as a convenience for trusted or prepared HTML, not as a generic “render any user string as HTML” mechanism.

These notes should be read as a “speed limit sign”: they describe how the engine behaves and where the risks lie, and they indicate a minimum level of care.
They do not replace application-level security measures, especially on the server side.


#### Variable creation and scope layering

`*compose` does **not** create any new local variables.

Scope behavior:

- The expression is evaluated in the standard Sercrod expression scope:

  - All data from the current `<serc-rod>` host (`this._data`) are visible.
  - The merged scope includes:

    - The local scope for the current element.
    - `$data` - current host data (if available).
    - `$root` - root host data (if available).
    - `$parent` - nearest ancestor host’s data (if available).
    - Internal methods and any methods registered via `*methods`.

- The directive does not inject extra names or loop variables.
- Any variable names used in the expression follow the normal shadowing rules of Sercrod expressions.


#### Parent access

Because `*compose` is purely expression-driven and does not alter scope:

- You can refer to outer data with:

  - `someProp`, `state.items`, `config.layout` (whatever your data shape is).
  - `$data` for the current host’s data object.
  - `$root` to reach the root host data.
  - `$parent` for the nearest ancestor host’s data.

- There is no special “compose parent” object; everything uses the standard scope resolution.


#### Use with conditionals and loops

`*compose` often appears together with conditionals or in contexts controlled by loops, but it is not itself a loop or condition.

- With host-level conditionals:

  - You can guard the entire composed block with `*if`:

    ```html
    <section *if="showDetails">
      <div *compose="detailsHtml"></div>
    </section>
    ```

  - `*if` is evaluated on `<section>` before its children are rendered; if it fails, the `<div>` and its `*compose` are never processed.

- Inside loops:

  - Common pattern: use `*for` or `*each` to repeat parent elements, then `*compose` inside the loop body.

    ```html
    <ul>
      <li *for="item of items">
        <div class="card" *compose="item.html"></div>
      </li>
    </ul>
    ```

  - In this case, `*for` is structural (repeats `<li>`), and `*compose` just fills each card with iteration-specific HTML.

- Same-element combinations with loops:

  - If you combine `*compose` (or `n-compose`) with `*for` or `*each` on the **same element**, the structural directive runs first and returns, so `*compose` is effectively ignored.
  - While the engine does not throw, you should treat such combinations as invalid; always separate structural loops and composition onto different elements.


#### Use with *include and *import

`*include` / `*import` and `*compose` all affect the children of a host, but at **different stages**:

- `*include` / `*import`:

  - Resolve a template or fetch HTML.
  - Assign it to `node.innerHTML` (the template node).
  - Remove `*include` / `*import` from the rendered element.
  - Do **not** return; the engine later renders the resulting children normally.

- `*compose`:

  - Runs later, on the rendered element.
  - Evaluates an expression, passes it through `Sercrod._filters.html`, and sets `el.innerHTML`.

As a result:

- If you attach both `*include` / `*import` and `*compose` to the same element:

  - `*include` / `*import` change the template’s innerHTML.
  - `*compose` then sets the rendered element’s `innerHTML` from the expression result.
  - After that, Sercrod still walks the (possibly replaced) `node.childNodes` and appends their rendered versions under the same element.

- This effectively means:

  - The HTML created by `*compose` becomes the initial content.
  - The included/imported children are then rendered additionally, using the modified template.

Guidance:

- The engine allows this combination, but the outcome can be subtle and hard to reason about.
- Recommended patterns:

  - Decide clearly which directive “owns” the content of a given element.
  - If you want an included template plus extra composition, consider wrapping:

    ```html
    <div *include="'card-template'">
      <div *compose="extraHtml"></div>
    </div>
    ```

  - Or use `*compose` alone and let your `html` filter handle template resolution internally.

- For most projects, it is simpler to treat `*include` / `*import` and `*compose` as mutually exclusive on a single element, even though the runtime does not enforce this with an error.


#### Best practices

- Do not mix multiple “content” directives on one element:

  - Avoid putting any combination of `*print`, `*textContent`, `*literal`, `*rem`, `*compose`, and `*innerHTML` on the same element.
  - In the current implementation, whichever branch matches first wins and the others are ignored, which can be confusing to debug.

- Prefer `*compose` over `*innerHTML` for higher-level composition:

  - Keep `*innerHTML` as a low-level escape hatch for raw HTML strings.
  - Give `*compose` a meaningful semantic in your project by customizing `Sercrod._filters.html`.

- Keep expressions simple:

  - Use `*compose="cardHtml"` rather than embedding large concatenated strings.
  - Precompute complex HTML or descriptors in data or methods.

- Be careful with untrusted data:

  - Remember that `*compose` writes directly to `innerHTML` and does not escape by itself.
  - Untrusted values should either be processed by a defensive `html` filter or handled via text-based directives instead of being composed as HTML.
  - This is a minimum precaution; it does not replace server-side validation or other security layers.

- Use children intentionally:

  - If you rely purely on the composed HTML, do not define template children on the same element.
  - If you intentionally want “compose + extra children”, document that pattern within your team so future maintainers are aware.


#### Examples

Composition from a pre-rendered fragment:

```html
<serc-rod id="app" data='{
  "fragments": {
    "hero": "<h1>Welcome</h1><p>This is Sercrod.</p>"
  }
}'>
  <header *compose="fragments.hero"></header>
</serc-rod>
```

Using a method to produce HTML:

```html
<serc-rod id="app" data='{"items":[{"name":"Alpha"},{"name":"Beta"}]}'>
  <script type="application/json" *methods='{
    "renderList": function(items){
      return "<ul>" + items.map(function(it){
        return "<li>" + it.name + "</li>";
      }).join("") + "</ul>";
    }
  }'></script>

  <section *compose="renderList(items)"></section>
</serc-rod>
```

Custom `html` filter for template names (conceptual pattern):

```html
<script>
  // Before Sercrod loads
  window.__Sercrod_filter = {
    html: function(raw, ctx){
      // Example: treat values starting with "tpl:" as template names
      if(typeof raw === "string" && raw.startsWith("tpl:")){
        var name = raw.slice(4);
        // Resolve name to preloaded HTML (implementation-specific)
        var html = window.TEMPLATES && window.TEMPLATES[name];
        return html || "";
      }
      return raw;
    }
  };
</script>

<serc-rod id="app" data='{"currentTpl":"tpl:card"}'>
  <div class="card-container" *compose="currentTpl"></div>
</serc-rod>
```

In this pattern:

- The Sercrod core still only knows that `*compose` calls `html(raw, ctx)` and writes to `innerHTML`.
- All higher-level composition logic lives in the `html` filter.


#### Notes

- `*compose` / `n-compose` share their implementation with `*innerHTML` / `n-innerHTML`, differing only in which attribute name is used.
- Null and `false` results are treated as empty strings; other values are forwarded to the `html` filter.
- The default `html` filter returns the raw value; projects are expected to override it (via `window.__Sercrod_filter.html`) if they need richer composition.
- Combining structural directives (`*for`, `*each`) with `*compose` on the same element causes the structural directive to win and `*compose` to be ignored; keep them on separate elements.
- Combining `*compose` with `*include` / `*import` is technically possible but advanced; prefer to pick a single directive as the content owner for predictable behavior.
- When in doubt, treat `*compose` as “evaluate once, pass through `html` filter, assign to `innerHTML`” and keep the rest of the element’s logic straightforward.
