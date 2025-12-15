### *rem

#### Summary

`*rem` removes an element from the rendered output and treats it as a Sercrod-only comment.
The directive has an alias `n-rem`.

Use `*rem` when you want to keep blocks of markup, notes, or alternate versions in your templates for Sercrod, while ensuring that nothing from those blocks appears in the final HTML that the browser or user sees.


#### Basic example

A debug-only block that you want to keep in the template, but never ship:

```html
<serc-rod id="app" data='{"debug": true}'>
  <div *rem>
    This block is visible only to Sercrod and your editor,
    not to end users.
  </div>

  <p>Real content goes here.</p>
</serc-rod>
```

Behavior:

- The `<div *rem>` element and its content are not rendered to the output DOM.
- The `<p>` remains and is rendered normally.
- Directives inside the `*rem` block are not evaluated.


#### Behavior

- `*rem` and `n-rem` mark an element and its entire subtree as a Sercrod-only comment.
- When Sercrod encounters an element with `*rem` or `n-rem`:
  - It does not evaluate child nodes or directives inside that element.
  - It does not keep the element in the final rendered tree.
- The contents are effectively erased from the runtime DOM, while remaining in the source template for development and maintenance.

Aliases:

- `*rem` and `n-rem` are aliases and behave identically.
- Choose one style per project for consistency (attribute form `*rem` is usually preferred in documentation).


#### Typical use cases

Common situations where `*rem` is useful:

- Temporary debug markup:

  ```html
  <div *rem>
    <p>Debug details: %JSON.stringify($data)%</p>
  </div>
  ```

- Keeping alternative layouts or prototypes in the template:

  ```html
  <section>
    <header>Production header</header>

    <div *rem>
      <header>Experimental header layout for later</header>
    </div>
  </section>
  ```

- In-place documentation and TODO notes for template authors:

  ```html
  <main>
    <div *rem>
      TODO:
      - Replace this panel with a new component
      - Verify a11y for keyboard navigation
    </div>

    <section>
      <!-- Real content -->
    </section>
  </main>
  ```


#### Evaluation timing

- `*rem` is checked when Sercrod visits a node during rendering.
- As soon as Sercrod sees `*rem` or `n-rem` on a node:
  - It stops further processing for that node.
  - It does not traverse or render the children.
  - Any other directives on the same node are effectively ignored for rendering.

Practical effect:

- `*rem` acts as a short-circuit for rendering that subtree.
- You can safely leave incomplete markup or directives inside a `*rem` block without triggering errors or side effects at runtime, as long as `*rem` remains on the element.


#### Execution model

Conceptually, the renderer behaves like this:

1. Sercrod visits a node in the template.
2. It checks whether the node has `*rem` or `n-rem`.
3. If neither attribute is present:
   - Rendering proceeds normally, and other directives are considered.
4. If `*rem` or `n-rem` is present:
   - Sercrod does not evaluate any directives on that node.
   - Sercrod does not descend into children.
   - The element is omitted from the rendered output.

The important points:

- The subtree is not expanded:
  - No data interpolation.
  - No conditional evaluation.
  - No loops.
  - No event bindings.
- The block is treated as a Sercrod-only comment that is simply not emitted to the final DOM.


#### Variable creation and scope layering

`*rem` does not introduce new variables or scopes.

- There is no additional per-node scope or local variable created by `*rem`.
- The directive only affects whether the element (and its children) is rendered.
- Any variables, methods, or helpers that would normally be visible inside the block are irrelevant, because the block is not evaluated.

You can think of `*rem` as a rendering guard that operates before any scope-sensitive logic.


#### Parent access

Because `*rem` prevents the entire subtree from being rendered:

- Access to `$root`, `$parent`, or any data inside the block is never evaluated at runtime.
- Any expression inside a `*rem` block is effectively inert.

This is useful for:

- Writing notes that refer to data or expressions without risking runtime errors.
- Copying and pasting example code snippets inside a template for later use without executing them accidentally.


#### Use with conditionals and loops

`*rem` is stronger than conditionals and loops on the same element:

- If `*rem` or `n-rem` is present on an element:

  - Host-level directives such as `*if`, `*for`, `*each`, `*switch`, `*include`, or `*import` on the same element are effectively ignored in the rendered output.
  - The element is treated as a comment, regardless of those directives.

Examples of patterns that do not make sense and should be avoided:

```html
<div *if="debug" *rem>
  <!-- The *if is meaningless here; *rem wins. -->
  <p>Debug panel</p>
</div>

<li *for="item of items" *rem>
  <!-- The *for is also meaningless; the item is never rendered. -->
  <span *print="item.name"></span>
</li>
```

Recommended usage:

- Place `*rem` on its own element whose only purpose is to be a comment.
- Do not attach `*rem` to elements that you intend to render under some conditions.
- If you want a block that sometimes renders and sometimes hides, use `*if` instead.


#### Best practices

- Treat `*rem` as a template-level comment mechanism:

  - Use it to keep extra information for developers.
  - Keep blocks small and focused so they remain easy to understand.

- Do not store critical behavior inside `*rem` blocks:

  - Anything inside may be removed or ignored at any time.
  - Production behavior should not depend on code that is currently under `*rem`.

- Avoid combining `*rem` with other host-level directives:

  - While Sercrod ignores them under `*rem`, mixing them makes templates harder to reason about.
  - Prefer a clean split: either a block is a comment (`*rem`) or it participates in rendering (no `*rem`).

- Use `*literal` for literal output instead:

  - If you want to show raw text or markup without Sercrod expansion, use `*literal`.
  - If you want to hide a block entirely, use `*rem`.

- Keep the intent obvious:

  - Add a short comment inside the `*rem` block explaining why it exists, such as `TODO`, `DEBUG`, or `EXPERIMENT`.


#### Additional examples

Prototype section kept in the template:

```html
<main>
  <section>
    <h1>Current layout</h1>
    <p>This is the layout users see.</p>
  </section>

  <section *rem>
    <h1>Future layout experiment</h1>
    <p>
      This section is only for designers and developers.
      It will not appear in the production DOM.
    </p>
  </section>
</main>
```

Inline TODO reminder:

```html
<footer>
  <div *rem>
    TODO:
    - Add social media links
    - Confirm final copyright text
  </div>

  <small>&copy; Example Inc.</small>
</footer>
```


#### Notes

- `*rem` and `n-rem` are aliases; they are treated the same by the renderer.
- The subtree under `*rem` is not evaluated; it is safe to leave incomplete directives or expressions inside.
- `*rem` is specifically intended as a Sercrod-only comment mechanism, not as a runtime toggle.
- For literal output without Sercrod expansion, use `*literal` instead.
- For runtime conditions, loops, or structural changes, use `*if`, `*for`, `*each`, and related directives on elements that do not carry `*rem`.
