### :style

#### Summary

:style is an attribute binding directive that controls an element’s inline style through a Sercrod expression.
It evaluates the expression and assigns the result directly to element.style.cssText.
The binding is one way: changes in data update the inline styles, but changing styles in the DOM does not modify data.

Unlike *style or n-style, :style does not use the style filter.
It is a thin, direct bridge between your expression and the element’s inline CSS string.


#### Basic example

Simple inline style binding:

```html
<serc-rod id="app" data='{
  "highlight": true
}'>
  <p :style="highlight ? 'color: red; font-weight: bold;' : ''">
    This paragraph is red when highlight is true.
  </p>
</serc-rod>
```

Behavior:

- When highlight is true, :style sets the inline styles to color: red; font-weight: bold;.
- When highlight becomes false and the host re renders, :style sets style.cssText to the empty string, removing the inline styles.
- The rest of the element’s attributes and children are not affected by :style.


#### Behavior

:style follows the general colon attribute-binding pipeline, with :style specific handling:

- Attribute detection  
  :style is recognized when the element has an attribute whose name is exactly :style.

- Expression evaluation  
  Sercrod reads the attribute value (for example :style="expr") and evaluates expr in the current scope with mode attr:style and el set to the current element.

- Value handling  
  On successful evaluation:

  - Sercrod takes the raw expression result as val.
  - It assigns element.style.cssText = val || "".
  - If val is a non empty string, the inline style is applied as written.
  - If val is falsy (for example "", 0, null, undefined, or false), the inline style string becomes "", effectively clearing inline styles.

- Error handling  
  If the expression throws during evaluation:

  - Sercrod forces a safe fallback and sets element.style.cssText = "".
  - No custom filter is applied in this path.

- Cleanup  
  After processing the attribute:

  - If Sercrod configuration _config.cleanup.handlers is truthy, Sercrod removes the original :style attribute from the element.
  - The resulting DOM only contains the computed style attribute (as produced by style.cssText), not the binding syntax.


#### Evaluation timing

:style is evaluated as part of the element render pass, alongside other colon bindings:

- Structural directives (such as *if, *for, *each, *include, *switch, and others) decide first whether the element is present and what its child structure is.
- After structural processing, Sercrod walks through the element’s attributes.
- All attributes whose name starts with : are handled by the colon-binding logic.
- For key === "style", Sercrod runs the dedicated :style branch and assigns style.cssText accordingly.
- If the Sercrod host re renders because data changed or an explicit update was requested, :style is re evaluated with the new scope and the inline style is updated.


#### Execution model

Conceptually, Sercrod’s execution model for :style looks like this:

1. Detect the colon attribute:
   - When rendering an element node, inspect its attributes.
   - For each attribute with name starting with :, compute key = name.slice(1).
   - If key is "style", treat it as a :style binding.

2. Evaluate the expression:
   - Let exprSource be the attribute value string (for example "highlight ? 'color: red;' : ''").
   - Call eval_expr(exprSource, scope, { el: node, mode: "attr:style" }).
   - If this call throws, jump to the error path.

3. Apply the result:
   - Let val be the result of evaluation.
   - Set element.style.cssText = val || "".

4. Error path:
   - If evaluation throws, set element.style.cssText = "".

5. Cleanup of the binding attribute:
   - If _config.cleanup.handlers is enabled, remove the :style attribute from the element after it has been processed.

There is no additional filter step and no special handling for objects or arrays in :style; the expression result is used directly as the style string (subject to val || "").


#### Interaction with *style and n-style

Sercrod also provides *style and n-style directives that assign inline styles using a separate, filter aware pipeline:

- *style / n-style:
  - These directives evaluate an expression and then run the result through the style filter.
  - The result of style filter is assigned to element.style.cssText.
  - They are processed later in the render pipeline than the generic colon bindings.

Order and precedence on the same element:

- If an element has both :style and *style or n-style:

  - :style runs earlier as part of the generic colon attribute pass.
  - *style / n-style runs later in a dedicated block for n-class / n-style.
  - The final value of style.cssText is whatever *style / n-style assigns last.

This means:

- Sercrod does not prohibit combining :style with *style or n-style on the same element, but *style / n-style will overwrite the effect of :style when both are present.
- For clarity and predictability, it is recommended to choose either :style or *style / n-style per element, rather than using both at once.


#### Use with conditionals and loops

Because :style only binds an attribute, it composes freely with structural directives and loops around it:

- Conditional elements:

  ```html
  <p *if="error" :style="'color: red; font-weight: bold;'">
    An error has occurred.
  </p>
  ```

  The paragraph exists only when error is truthy; :style is evaluated only when the element is rendered.

- Inside *each or *for:

  ```html
  <ul>
    <li *for="item of items"
        :style="item.done ? 'text-decoration: line-through;' : ''">
      <span *print="item.label"></span>
    </li>
  </ul>
  ```

  Each repetition gets its own style based on the iteration data.

- Combined with other colon bindings:

  ```html
  <button :class="primary ? 'btn btn-primary' : 'btn'"
          :style="disabled ? 'opacity: 0.5; pointer-events: none;' : ''"
          :disabled="disabled">
    Submit
  </button>
  ```

  :class, :style, and :disabled are evaluated independently in the same attribute pass.


#### Best practices

- Prefer strings as the expression result  
  :style assigns the expression result directly to style.cssText.
  For predictable behavior, ensure your expression always evaluates to a string.
  Avoid returning objects or arrays from :style expressions.

- Use empty string to clear inline styles  
  Returning "" (or any falsy value) will reset style.cssText to the empty string, removing inline styles.
  This is useful for toggling highlight states without leaving stale CSS on the element.

- Keep style expressions simple  
  Inline style strings can become hard to maintain.
  Prefer short expressions and factor complex logic into helpers or computed properties:

  - Good: :style="isActive ? activeStyle : ''"
  - Better: :style="styles.card"

- Coordinate with *style / n-style  
  Decide per element whether you want:

  - Fine grained control with :style on a single element, or
  - A more structured style expression using *style / n-style plus the style filter.

  Avoid mixing both on the same element unless you intentionally want *style / n-style to override :style.

- Defer complex formatting to the style filter when using *style  
  Remember that :style does not use the style filter.
  If you need complex formatting, canonicalisation, or security checks on style strings, implement them in the style filter for *style / n-style rather than relying on :style.


#### Additional examples

Using a computed style string in data:

```html
<serc-rod id="app" data='{
  "styles": {
    "warning": "color: #b45309; background-color: #fffbeb; padding: 0.5rem;",
    "normal": ""
  },
  "mode": "warning"
}'>
  <p :style="styles[mode]">
    This paragraph style is controlled via data.styles[mode].
  </p>
</serc-rod>
```

Combining multiple conditions into one style string:

```html
<serc-rod id="app" data='{
  "isActive": true,
  "isDisabled": false
}'>
  <button :style="(isActive ? 'border: 2px solid #2563eb;' : '') +
                  (isDisabled ? ' opacity: 0.5; pointer-events: none;' : '')">
    Click me
  </button>
</serc-rod>
```


#### Notes

- :style is a dedicated colon style attribute binding that writes directly to element.style.cssText.
- It does not use the style filter; only *style / n-style do.
- The expression result is treated as read only from Sercrod’s perspective and is not written back into data.
- Falsy values (including "", 0, null, undefined, and false) clear style.cssText by setting it to the empty string.
- If _config.cleanup.handlers is enabled, the original :style attribute will be removed from the rendered DOM, leaving only the actual style attribute content that results from style.cssText.
- When :style and *style / n-style are present on the same element, :style is applied first and *style / n-style wins last; prefer choosing one per element to avoid confusion.
