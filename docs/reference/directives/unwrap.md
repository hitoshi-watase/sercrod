### *unwrap

#### Summary

`*unwrap` removes the Sercrod host element itself from the DOM after rendering and leaves only its children.
It is a host-level directive: it is evaluated on `<serc-rod>` instances, not on arbitrary elements.
The attribute is treated as boolean; its value is ignored, and only its presence matters.

This directive is useful when you want to use Sercrod as a one-shot renderer or build tool but do not want the `<serc-rod>` tag to remain in the final HTML.


#### Basic example

Simple one-shot render of a card:

```html
<serc-rod id="card" *unwrap data='{"title":"Hello","body":"World"}'>
  <article class="card">
    <h1 *print="title"></h1>
    <p *print="body"></p>
  </article>
</serc-rod>
```

After the initial render and finalization, the DOM becomes effectively:

```html
<article class="card">
  <h1>Hello</h1>
  <p>World</p>
</article>
```

- The `<serc-rod>` wrapper is removed.
- The `<article>` subtree is moved up one level and kept as plain static HTML.


#### Behavior

- `*unwrap` is only checked on Sercrod host elements (the custom element class).
- If a host has the `*unwrap` attribute, Sercrod replaces that host with its children using a `DocumentFragment`.
- All children and their descendants, including event listeners and bindings that were already attached, are preserved as they are moved.
- The Sercrod host instance is removed from the DOM tree; no new updates are applied to that host afterward.
- The attribute is treated as a simple presence flag:
  - `*unwrap`, `*unwrap=""`, and `*unwrap="true"` behave the same.
  - There is no expression evaluation or conditional logic on `*unwrap` itself.


#### Evaluation timing

`*unwrap` is evaluated in the host’s `_finalize()` phase:

- `_finalize()` is invoked at the end of the update cycle for a Sercrod host.
- This happens:
  - After the main template has been rendered.
  - After child updates and `*updated` hooks have been processed.
  - Even in the `*lazy` case where only children are updated, `_finalize()` still runs.

Consequences:

- As soon as the first update cycle that sees `*unwrap` completes, the host element unwraps itself and disappears from the DOM.
- Because the host is removed, subsequent reactive updates via that host are not applied; the content that remains is regular static DOM.


#### Execution model

The internal execution model for `*unwrap` on a `<serc-rod>` host is:

1. At the end of an update, the host calls `_finalize()`.
2. `_finalize()` calls `_unwrap()` on the host.
3. `_unwrap()` performs:

   - Check: if the host does not have the `*unwrap` attribute, stop and do nothing.
   - Find the parent node of the host; if there is no parent, stop.
   - Create an empty `DocumentFragment`.
   - Move all existing child nodes from the host into the fragment, in order.
   - Replace the host element in its parent with that fragment.

4. After this replacement:
   - The former children now live directly under the parent.
   - The `<serc-rod>` host element is no longer in the DOM.

No additional scopes or variables are created by `*unwrap` during this process; it only affects DOM structure after rendering.


#### Variable creation and scope layering

- `*unwrap` does not create any new variables.
- It does not modify the data scope (`this._data`, `$data`, `$root`, `$parent`) for expressions.
- All data evaluation and binding happen before `_finalize()` runs.
- Once unwrapped, the DOM subtree no longer has a Sercrod host associated with it, so further scope-based updates from that host are not applied.

In other words, `*unwrap` is purely structural and post-render; it does not participate in expression evaluation.


#### Parent access

- `*unwrap` does not change how `$root` or `$parent` are resolved during rendering.
- While the host exists, expressions can still use `$root` and `$parent` as usual.
- After unwrapping, the host is removed, so future expression evaluation via that host does not occur.


#### Use with conditionals and loops

`*unwrap` does not itself provide conditional behavior or looping; it runs unconditionally whenever the attribute is present and the host completes an update.

Typical combinations:

- Conditional rendering outside the host:

  - If you want to conditionally include an unwrapped block, use conditionals around the `<serc-rod>` element instead of trying to make `*unwrap` conditional.

  ```html
  <div *if="showCard">
    <serc-rod *unwrap data="cardData">
      <article class="card">
        <h1 *print="title"></h1>
      </article>
    </serc-rod>
  </div>
  ```

- Loops outside the host:

  - If you need multiple unwrapped blocks, loop outside Sercrod or generate multiple `<serc-rod *unwrap>` hosts in your surrounding template or build pipeline.
  - `*unwrap` itself does not loop or replicate content; it only removes one host wrapper.


#### Best practices

- Use `*unwrap` for one-shot or build-time rendering:

  - It is best suited for scenarios where Sercrod is used as a preprocessor:
    - SSG or SSR pipelines where `<serc-rod>` is used only during generation.
    - Inline rendering in a build step (for example, via Playwright) to produce final HTML.

- Do not expect live updates after unwrapping:

  - Once unwrapped, the host is removed from the DOM and does not drive further reactive changes.
  - If you need live updates from Sercrod on the client side, do not use `*unwrap` on that host.

- Keep `*unwrap` on the host element:

  - `*unwrap` is implemented as a method of the Sercrod class and is only checked on Sercrod hosts.
  - Placing `*unwrap` on non-Sercrod elements has no effect in the current implementation.

- Treat `*unwrap` as a structural option:

  - It does not change how directives like `*if`, `*for`, `*each`, `*include`, or `*import` behave inside the host.
  - It only changes whether the `<serc-rod>` wrapper itself survives after the update cycle.


#### Additional examples

Unwrapping a layout section:

```html
<serc-rod id="hero" *unwrap data='{
  "title": "Sercrod",
  "tagline": "HTML-first data binding"
}'>
  <section class="hero">
    <h1 *print="title"></h1>
    <p *print="tagline"></p>
  </section>
</serc-rod>
```

The final HTML keeps only the `<section>` and its contents, without `<serc-rod>`.

Combining with partials inside:

```html
<serc-rod id="page" *unwrap data='{"user":{"name":"Alice"}}'>
  <main>
    <header *include="'site-header'"></header>
    <section *include="'user-profile'"></section>
  </main>
</serc-rod>
```

- Sercrod still processes templates and includes inside the host.
- After rendering, only `<main>` (with all its resolved content) remains; the `<serc-rod>` wrapper is removed.


#### Notes

- `*unwrap` is a host-level directive; there is no `n-unwrap` alias in the current implementation.
- The directive is checked by testing for the presence of the `*unwrap` attribute; the attribute value is not interpreted as an expression.
- Unwrapping is performed via `DocumentFragment` replacement, so the relative order of siblings around the host is preserved.
- `*unwrap` does not interact with or override any per-element structural directives on child nodes; it only removes the outer Sercrod host after all child processing is done.
- Because it removes the host element entirely, `*unwrap` should be used only when you intentionally do not need that host to remain active in the DOM after the first render.
