### *literal

#### Summary

`*literal` is used when you want to keep Sercrod-style markup (or any template-like text) exactly as written, without Sercrod expanding or interpreting it.
Typical use cases include:

- Showing Sercrod examples in documentation.
- Emitting `%placeholders%` or `*directives` as plain text for another system to process later.

Inside a `*literal` block:

- Sercrod does not evaluate `%...%` interpolation.
- Sercrod does not treat `*if`, `*for`, `@click`, or any other directives as behavior.
- Only the `*literal` / `n-literal` attribute itself is removed in the final output; the content is kept as plain text.

`*literal` has an alias `n-literal`.


#### Basic example

Display Sercrod markup as-is, so that it is shown as code instead of being executed:

```html
<serc-rod id="docs">
  <h2>Counter example</h2>
  <pre *literal>
<serc-rod data='{"count":0}'>
  <button @click="count++">+</button>
  <span *print="count"></span>
</serc-rod>
  </pre>
</serc-rod>
```

Behavior:

- Sercrod does not interpret the inner `<serc-rod>`, `@click`, or `*print` in the `<pre>` block.
- The final DOM contains a `<pre>` whose text content is the Sercrod snippet, exactly as written.
- The `*literal` attribute itself is removed by the cleanup phase, so end users will not see it.


#### Behavior

Core rules:

- If an element has `*literal` or `n-literal`, Sercrod treats the element’s content as plain text.
- Directives and interpolation markers inside that element are not executed; they are preserved as characters.
- The host element itself is kept (for example `<pre>`, `<p>`, `<div>`), but `*literal` / `n-literal` is removed from the output DOM when directive cleanup is enabled.

Source of the text:

- Sercrod first looks at the attribute value:

  - If `*literal` / `n-literal` has a non-empty value, that string is used as the text.
  - Example: `<div *literal="*if=&quot;cond&quot;">...</div>` outputs `*if="cond"` as text.

- If the attribute value is empty or not specified:

  - Sercrod uses the original `innerHTML` as the text.
  - Example: `<pre *literal>...inner markup...</pre>` outputs the inner markup exactly as characters.

In both modes:

- The chosen text is emitted without Sercrod expression evaluation.
- Characters like `<`, `>`, `%`, `"`, and `*` are not treated specially by Sercrod.


#### “Keep Sercrod as text” use case

The primary design goal of `*literal` is to display Sercrod markup itself:

- You can write Sercrod templates inside `*literal` blocks to show them as examples.
- You can keep `%user.name%` or `%item.price%` as placeholders, ready for a different rendering engine.

Example:

```html
<serc-rod id="docs">
  <p>Description</p>
  <pre *literal>
%user.name% ordered %item.name% at %item.price%.
  </pre>
</serc-rod>
```

Result:

- Sercrod does not try to evaluate `%user.name%` or `%item.price%`.
- The placeholders appear exactly as written in the rendered page.
- Only `*literal` is removed from the markup; the rest is preserved as plain text inside `<pre>`.


#### Attribute vs innerHTML source

Two common patterns:

1. Boolean-style `*literal` (innerHTML source):

   - No value, or an empty value:

     ```html
     <pre *literal>
<serc-rod data='{"count":0}'>
  <button @click="count++">+</button>
  <span *print="count"></span>
</serc-rod>
     </pre>
     ```

   - Sercrod uses the inner HTML as the text source.
   - The element becomes a `<pre>` with that snippet as its text content.
   - The `*literal` attribute is removed.

2. Value-style `*literal` (attribute source):

   - Value is treated as a plain string, not as an expression:

     ```html
     <p *literal="*if=&quot;isVisible&quot;">Will show *if="isVisible"</p>
     ```

   - The visible text is `*if="isVisible"`.
   - The inner content (`Will show ...`) is ignored in this mode.
   - Sercrod does not try to evaluate `isVisible`; it just prints the attribute value as text.

Important:

- The `*literal` value is never interpreted as a Sercrod expression.
- If you need data-driven text based on scope variables, use `*print` or bindings instead.


#### Evaluation timing

`*literal` is handled early in the rendering pipeline:

- In the main render flow, Sercrod:

  - Handles static/dynamic flags.
  - Then checks for `*literal` / `n-literal`.

- If `*literal` or `n-literal` is present:

  - Sercrod decides the text to output (from the attribute or innerHTML).
  - Sets the element’s text content or appends a text node (depending on the internal path).
  - Skips further processing for that node.

Because of this:

- Any other directive on the same element as `*literal` is effectively ignored by the runtime.
- Children of that element are not visited by Sercrod’s directive engine.
- The element becomes a “literal island” with no Sercrod behavior inside it.


#### Execution model

Conceptually, for an element with `*literal`:

1. Sercrod detects `*literal` / `n-literal` on the element.
2. It reads:

   - `attr = element.getAttribute("*literal") || element.getAttribute("n-literal")`.

3. It determines the text:

   - If `attr` is a non-empty string, `text = String(attr)`.
   - Otherwise, `text = element.innerHTML` (as originally written in the template).

4. It clears or replaces the element’s children with a single text content node based on `text`.
5. In the cleanup phase:

   - `*literal` and `n-literal` attributes are removed from the output DOM.
   - The element itself remains in the DOM (for example `<pre>`, `<p>`).

At no point does Sercrod interpret or expand directives, events, or `%...%` placeholders within that element.


#### Variable creation and scope layering

`*literal` does not create or modify any variables:

- No new local variables are introduced.
- `$data`, `$root`, `$parent`, and other scope entries are unaffected.
- There is no per-child scope inside a `*literal` block, because Sercrod does not descend into the element to render children.

You can still use scope and data around the literal element:

- Ancestors and siblings behave as usual.
- Use outer `*if`, `*for`, or bindings on surrounding elements to control when and where the literal block appears.


#### Parent access

Because Sercrod does not descend into `*literal` blocks:

- There is no Nested Sercrod scope inside that element.
- Inner markup (even if it looks like Sercrod) is just text; it cannot access `$parent` or other scope variables.
- Parent scopes are only relevant for deciding whether the element itself is rendered at all (through directives on parent elements).


#### Use with conditionals and loops

The rule becomes very straightforward once you think of `*literal` as “keep everything inside as plain text”:

- `*literal` and other directives on the same element conflict conceptually:

  - `*if` or `*for` on the same element would suggest “execute logic”.
  - `*literal` says “do not execute anything inside; keep it as text”.

- Implementation-wise, `*literal` wins:

  - Because `*literal` is handled early, Sercrod does not get to the other directives on that element.
  - So `*if`, `*for`, `@click`, or any other directives on the same element effectively do nothing.

For this reason:

- Do not combine `*literal` with other `*` / `n-` / `@` directives on the same element.

Instead, use an outer element for logic:

- Conditional display of a literal block:

  ```html
  <section *if="showExample">
    <pre *literal>
<serc-rod data='{"count":0}'>
  <button @click="count++">+</button>
  <span *print="count"></span>
</serc-rod>
    </pre>
  </section>
  ```

  - `*if` controls whether the whole example is shown.
  - `*literal` ensures the inner Sercrod snippet is preserved as text.

- Looping over literal snippets:

  ```html
  <ul *for="snippet of snippets">
    <li>
      <pre *literal>
%snippet.body%
      </pre>
    </li>
  </ul>
  ```

  - `*for` repeats `<li>` for each `snippet`.
  - Each `<pre *literal>` contains a literal template for that snippet.


#### Best practices

- Use `*literal` whenever you want Sercrod markup or `%placeholders%` to appear as text:

  - Documentation for Sercrod itself.
  - Email or template previews that use `%%`-style placeholders.
  - Raw Markdown or other template languages that should not be touched by Sercrod.

- Keep `*literal` alone on its element:

  - Do not add `*if`, `*for`, `*each`, `@event`, or other directives to the same element.
  - Place conditionals and loops on a parent element, and use `*literal` purely to protect the inner content.

- Prefer innerHTML for larger literal blocks:

  - For large code samples or long Markdown sections, use the boolean-style `*literal` and write the content in the body.
  - Use attribute-style `*literal="...text..."` for short strings that must remain literal.

- Combine with `*rem` when you want no output:

  - `*literal` is for “keep literal content as text”.
  - `*rem` is for “keep in the template only; remove from rendered output”.


#### Additional examples

Literal Sercrod block with outer logic:

```html
<serc-rod id="examples" data='{"show":"counter"}'>
  <section *if="show === 'counter'">
    <h3>Counter example</h3>
    <pre *literal>
<serc-rod data='{"count":0}'>
  <button @click="count++">+</button>
  <span *print="count"></span>
</serc-rod>
    </pre>
  </section>
</serc-rod>
```

Literal placeholders for another system:

```html
<serc-rod id="mailer">
  <p *literal>
%USER_NAME%, thank you for signing up.  
Your order number is %ORDER_ID%.
  </p>
</serc-rod>
```

- Sercrod does not expand `%USER_NAME%` or `%ORDER_ID%`.
- The string is emitted exactly as written, ready for another mail-merge system.


#### Notes

- `*literal` and `n-literal` are aliases; choose one style per project for consistency.
- `*literal` is evaluated early and prevents Sercrod from interpreting anything inside that element.
- The main purpose is to keep Sercrod-style markup (or other templates) as text, while removing only the `*literal` directive itself from the final HTML.
- Combining `*literal` with other directives on the same element is not supported in practice, because `*literal` short-circuits those directives; use parent elements for conditionals and loops instead.
