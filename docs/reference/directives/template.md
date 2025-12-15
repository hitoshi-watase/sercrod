### *template

#### Summary

`*template` marks a subtree as a reusable template.
The subtree is registered under a name in the current Sercrod world and is not rendered where it is declared.
Later, `*include` can refer to that name and copy the template’s inner content into a real element.
If you want to share templates across files, you usually combine `*template` with `*import`: `*import` loads HTML from another file, and any `*template` declarations inside that HTML are then available to `*include`.

Key points:

- `*template` / `n-template` define templates.
- The definition is non-rendering: the host element is used only as a prototype.
- The template name is resolved through a shared helper that is also used by `*include`.
- Each Sercrod world keeps its own template registry.
- A single element should not combine `*template` with other structural directives such as `*include`, `*import`, `*for`, or `*each`: `*template` always runs first, registers the template, and stops rendering that node, so the other directives on that same element never take effect.


#### Basic example

A simple reusable card template and a loop that includes it:

```html
<serc-rod
  id="app"
  data='{
    "users": [
      { "name": "Alice", "bio": "Loves minimal HTML." },
      { "name": "Bob",   "bio": "Enjoys fast renderers." }
    ]
  }'
>
  <!-- Declare a reusable template named "userCard" -->
  <template *template="'userCard'">
    <article class="user-card">
      <h2 *print="user.name"></h2>
      <p *print="user.bio"></p>
    </article>
  </template>

  <!-- Use the template inside a loop -->
  <section *each="user of users">
    <div *include="'userCard'"></div>
  </section>
</serc-rod>
```

Behavior:

- `<template *template="'userCard'">` is registered once as `userCard` in the current Sercrod world.
- The `<template>` node itself is not rendered.
- For each `user` in `users`, `*include="'userCard'"` copies the inner content of the template (`<article class="user-card">…`) and renders it in the loop’s scope.


#### Behavior

- `*template` is a structural, non-rendering directive.
- When Sercrod encounters an element with `*template` or `n-template`:
  - It resolves the template name via `_resolve_template_name`.
  - If the name is valid and not already registered in that world, it deep-clones the element and stores the clone in the world-local template registry.
  - The original element is not appended to the rendered output.
- Templates by themselves never produce visible output. They only become visible when something else (usually `*include`) uses them by name.

Alias:

- `*template` and `n-template` are aliases and behave identically.


#### Name resolution

`*template` uses the shared helper `_resolve_template_name(raw_text, scope, { el, mode: "template" })`.

For an attribute like:

```html
<template *template="expr">...</template>
```

Sercrod resolves the name as follows:

1. Convert the attribute to a string and trim it.
2. Try to evaluate it as an expression:

   - `this.eval_expr(src, scope, { el, mode: "template", quiet: true })` is called.
   - If the evaluation yields a non-null, non-undefined value, Sercrod turns it into a string, trims it, and if the result is non-empty, that becomes the name.

3. If evaluation does not produce a usable name, fall back to identifier rules:

   - If the original trimmed text matches `/^[A-Za-z_][A-Za-z0-9_-]*$/`, it is treated as a name directly.
   - Otherwise, name resolution fails.

If name resolution fails:

- The template is not registered.
- When warnings are enabled, Sercrod logs a message like `*template: empty or invalid name: ...`.

Examples:

- Literal string:

  ```html
  <template *template="'card'">...</template>
  ```

  The name is `card`.

- Bare identifier:

  ```html
  <template *template="userCard">...</template>
  ```

  If `userCard` evaluates to a non-empty string, that string is used.
  If not, but `userCard` looks like an identifier, `userCard` itself is used.


#### World-local registration and duplicates

Templates are registered per Sercrod world:

- Each `<serc-rod>` instance has its own `_template_registry`.
- When `*template` registers a name, it stores a deep clone of the host element as the prototype for that template in that world.
- When `*include` looks up a template by name, it uses `_lookupTemplateNear(name)`:
  - It checks the current world first.
  - If not found, it walks up through parent Sercrod worlds until it finds the first matching template.

Duplicate names:

- If the current world’s registry already has a template with the same name:
  - `*template` does nothing for the new declaration.
  - When warnings are enabled, Sercrod logs `*template duplicated: name`.
- The first registration wins; later ones are ignored.


#### Evaluation timing

`*template` runs early in the element pipeline:

- When Sercrod renders an element:
  - It first checks for `*template` / `n-template`.
  - If present, it resolves the name, tries to register the template, and then returns immediately for that node.
- The children of the `*template` element are not rendered at the declaration site.
- Any structural or binding directives on that same element are effectively ignored, because the renderer does not continue past the `*template` registration step for that node.

From the rendered document’s point of view:

- Template declarations are invisible markers. Their only effect is to populate the template registry for later use.


#### Execution model

Conceptually, Sercrod does the following for `*template`:

1. Detect declaration:

   - If the current node has `*template` or `n-template`, treat it as a template definition.

2. Resolve the name:

   - Use `_resolve_template_name` with `mode: "template"` to get a non-empty string.

3. Handle invalid names:

   - If the name is empty or invalid, optionally warn and return without rendering this node.

4. Handle duplicates:

   - If the current world’s `_template_registry` already has that name, optionally warn and return without rendering this node.

5. Register a prototype:

   - Deep-clone the node (including its attributes and children).
   - Store the clone as the prototype for that template name in `_template_registry`.
   - Store basic visibility attributes (`inert`, `hidden`, `aria-hidden`) in `_template_attr_snapshot` for possible future use.

6. Skip output:

   - Do not append the original node to the DOM of the rendered result.
   - Do not process its children at the declaration location.

Later, when `*include` uses this name, Sercrod:

- Looks up the prototype via `_lookupTemplateNear`.
- Copies `proto.innerHTML` into the caller element’s `innerHTML`.
- Processes the inserted children using the caller’s scope.


#### Variable creation

`*template` does not create any new variables by itself.

- It does not define loop variables or aliases.
- It does not introduce special `$`-helpers.
- Only the name of the template is extracted; nothing in the template body is evaluated at declaration time.

Variables such as `user`, `item`, or `config` that appear inside the template body must be supplied by the scope at the call site (where `*include` is used).


#### Scope layering

Declaration-time scope and usage-time scope are distinct:

- At declaration time:

  - Sercrod uses the scope only to resolve the template name (if the name is an expression).
  - The template body is not evaluated.
  - No local scope is created for the body.

- At usage time (via `*include`):

  - The template’s inner content is treated as if it had been written inline at the include site.
  - All directives inside the template body are evaluated in the caller’s scope.

Implications:

- The template body sees:

  - Variables from the caller such as `user`, `row`, `item`.
  - Host data from `<serc-rod data="...">`.
  - Special helpers like `$data`, `$root`, `$parent`.
  - Methods and filters configured on that world.

- The scope of the declaration site does not leak into the template body.


#### Parent access

When the template content is rendered (via `*include`):

- `$root` refers to the root data of the Sercrod world in which the include is happening.
- `$parent` refers to the nearest ancestor Sercrod host of the include site.
- The template body behaves like any other inline markup with respect to `$root` and `$parent`.

`*template` does not add any extra parent layer over this. It only defines where the content comes from.


#### Use with conditionals and loops

There are two places where conditionals and loops can appear:

- On the `*template` declaration element itself.
- Inside the template body.

Declaration element:

- If you attach structural directives such as `*if`, `*for`, `*each`, or `*switch` to the same element as `*template`, `*template` wins:

  - The renderer sees `*template`.
  - It registers the template and returns immediately for that node.
  - The other structural directives on that same node never run.

- For this reason, do not combine `*template` with other structural directives on a single element. If you need conditions or loops, put them inside the template body.

Template body:

- Inside the body of the template, you can use any structural directives normally:

  ```html
  <template *template="'userRow'">
    <tr *if="user.active">
      <td *print="user.id"></td>
      <td *print="user.name"></td>
    </tr>
  </template>

  <tbody *each="user of users">
    <tr *include="'userRow'"></tr>
  </tbody>
  ```

- `*if` and other directives in the body are evaluated when the template is used via `*include`, not when the template is declared.


#### Use with *include and *import

`*template` is the definition side of the template system.
`*include` and `*import` are consumers, but in different ways.

- `*include`:

  - Performs a name-based lookup against the template registry.
  - Uses `_resolve_template_name` with `mode: "include"` and then `_lookupTemplateNear(name)` to find a prototype.
  - Copies `proto.innerHTML` into the caller element’s `innerHTML`.
  - Leaves the caller’s tag name and attributes unchanged.
  - Does not involve any network access.

- `*import`:

  - Does not look up template names.
  - Resolves its attribute as an URL (expression first, then a simple URL-like string).
  - Performs a synchronous HTTP request (XMLHttpRequest), with caching per URL.
  - On success, takes the received HTML string and assigns it directly to `node.innerHTML`.
  - After that, the normal child rendering pass processes the imported HTML:
    - Any `*template` declarations inside the imported HTML are registered in that world at this time.
    - Any `*include`, bindings, and other directives inside the imported HTML run as usual.

In other words:

- `*template` + `*include` is the local template mechanism (name-based, no network).
- `*template` + `*import` is the cross-file mechanism:
  - You can keep templates in an external HTML file.
  - `*import` pulls that file’s HTML into the current world.
  - Then `*include` uses those templates by name.

Unsupported combinations on one element:

- Putting `*template` and `*include` on the same element:

  ```html
  <!-- Not supported: *template wins, *include never runs -->
  <div *template="'card'" *include="'card'"></div>
  ```

- Putting `*template` and `*import` on the same element:

  ```html
  <!-- Not supported: *template wins, *import never runs -->
  <div *template="'card'" *import="'/partials/card.html'"></div>
  ```

For these patterns, `*template` always runs first and suppresses the other directive for that node. Always separate declaration and usage onto different elements.


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

- Use `<template>` as the `*template` host:

  - It clearly communicates that the element is a declaration, not a rendered node.
  - Only its inner content is typically used via `*include`.

- Keep declarations and usage separate:

  - Treat the `*template` block as a catalog of reusable pieces.
  - Use `*include` (and optionally `*import`) where you want them to appear.

- Name templates consistently:

  - Choose a clear naming scheme, such as `userCard`, `pageShell`, `tableRow`.
  - Avoid name reuse in the same world to prevent duplicate warnings.

- Design templates for the caller’s scope:

  - Assume that variables such as `user`, `row`, or `item` come from the place where `*include` is used.
  - Avoid relying on declaration-site local variables.

- Do not combine `*template` with other structural directives on the same element:

  - If you need conditionals or loops, put them inside the template body or in the caller code.
  - If you need `*import`, use it on a different element that simply loads HTML for later use.


#### Additional examples

Templates for a page shell:

```html
<serc-rod
  id="page"
  data='{"title":"Sercrod Docs","subtitle":"Attribute-first templates"}'
>
  <template *template="'pageShell'">
    <header>
      <h1 *print="title"></h1>
      <p *print="subtitle"></p>
    </header>
    <main>
      <slot></slot>
    </main>
    <footer>
      <small>Sercrod example</small>
    </footer>
  </template>

  <section *include="'pageShell'">
    <p>This paragraph is rendered inside the <main> of the pageShell template.</p>
  </section>
</serc-rod>
```

Templates loaded from another file via *import:

```html
<serc-rod id="root">
  <!-- Load external HTML that may define templates like "card" or "layoutHeader" -->
  <div *import="'/partials/common-templates.html'"></div>

  <!-- After the import, those templates are available in this world -->
  <section *include="'layoutHeader'"></section>
  <div *include="'card'"></div>
</serc-rod>
```


#### Notes

- `*template` / `n-template` define reusable templates and register them per Sercrod world.
- Template declarations themselves do not create visible output; they only populate the template registry.
- `*include` uses the same name resolution helper as `*template` and copies `innerHTML` from the prototype into the caller.
- `*import` does not use template names; it only loads HTML into `innerHTML`. Any templates in that HTML are registered later when the imported children are rendered.
- Duplicate template names in the same world are ignored after the first registration, with optional warnings.
- For clarity and predictable behavior, avoid combining `*template` with other structural directives on a single element.
