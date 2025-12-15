### :xlink:href

#### Summary

:xlink:href is an attribute binding directive that controls the xlink:href attribute of an SVG element.
It evaluates a Sercrod expression and writes the result into xlink:href, passing the value through the configurable url filter.
The binding is one way: data updates change the DOM attribute, but changes to the DOM attribute do not update data.

:xlink:href is part of the generic colon attribute family and shares the same evaluation rules as :href, :src, :action, and :formaction.


#### Basic example

Referencing an SVG symbol by id:

```html
<serc-rod id="icons" data='{
  "iconRef": "#icon-check"
}'>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <symbol id="icon-check" viewBox="0 0 24 24">
        <path d="M3 12l6 6L21 4"></path>
      </symbol>
    </defs>

    <use :xlink:href="iconRef"></use>
  </svg>
</serc-rod>
```

Behavior:

- Sercrod evaluates the expression iconRef in the current scope.
- The string "#icon-check" is written into the xlink:href attribute of the use element.
- If iconRef changes and the host re renders, xlink:href is updated accordingly.


#### Behavior

Core rules:

- Target attribute  
  :xlink:href targets the xlink:href attribute commonly used in SVG 1.1 to reference other SVG content.
  Sercrod does not enforce that the element is SVG, but the intended use is on elements such as use, image, and other SVG linking elements.

- Expression evaluation  
  Sercrod reads the attribute value (for example :xlink:href="iconRef" or :xlink:href="base + '#' + name").
  It evaluates the expression in the current scope using the attribute binding mode attr:xlink:href.

- Value interpretation  
  After evaluation:

  - If the value is strictly false or is null or undefined, Sercrod removes the xlink:href attribute from the element.
  - Otherwise, the value is converted to a string and passed through the url filter.
  - If the url filter returns a truthy value, Sercrod sets xlink:href on the element to that filtered value.

- Error handling  
  If evaluating the :xlink:href expression throws an error, Sercrod falls back to a safe state by setting an empty xlink:href attribute on the element.

- Url filter  
  For :xlink:href (as for :href, :src, :action, and :formaction), Sercrod calls the url filter:

  - The filter signature is url(raw, attr, ctx).
  - For :xlink:href, raw is the stringified expression result, attr is "xlink:href", and ctx contains el and scope.
  - By default, the built in url filter simply returns raw unchanged.
  - Projects can override url at startup via window.__Sercrod_filter to perform validation, rewriting, or blocking of unsafe URLs.

- Cleanup  
  If Sercrod configuration sets cleanup.handlers to a truthy value, the original :xlink:href attribute is removed from the output DOM after it has been processed.
  The final DOM then contains only the concrete xlink:href attribute and no colon attribute bindings.


#### Evaluation timing

:xlink:href is evaluated during the element rendering phase, together with other colon style attribute bindings.

More precisely:

- Structural directives such as *if, *for, *each, *switch, *include, and others decide first whether the element is present and what its children look like.
- Once Sercrod has decided to keep the element and has a working element instance for rendering, it walks through its attributes.
- For every attribute whose name starts with a colon, Sercrod dispatches to the colon binding path.
- :xlink:href is processed in the same pass as :href, :src, :action, and :formaction.
- If the Sercrod host updates due to data changes, the element is re rendered and :xlink:href is re evaluated with the latest scope.

There is no dedicated scheduling or delay specific to :xlink:href. It participates in the normal render update cycle of the host.


#### Execution model

Conceptually, when Sercrod renders an element with :xlink:href, the steps are:

1. Sercrod encounters a node that has an attribute named :xlink:href.
2. It reads the expression string from that attribute, for example iconRef or spriteBase + '#' + name.
3. It evaluates the expression with eval_expr, using the current scope and a context that sets mode to attr:xlink:href and el to the current element.
4. It inspects the result:

   - If the result is strictly false, or is null or undefined, Sercrod removes the xlink:href attribute and stops.
   - Otherwise, it converts the result to a string and passes it to the url filter, along with the attribute name "xlink:href" and a context with the element and scope.

5. If the url filter returns a truthy string, Sercrod sets the element attribute xlink:href to that string.
6. If evaluation throws an exception, Sercrod falls back to setting xlink:href to an empty string.
7. If cleanup.handlers is enabled in the configuration, Sercrod removes the original :xlink:href attribute from the element, leaving only the concrete xlink:href attribute in the output DOM.


#### Use with structural directives and loops

:xlink:href is an attribute binding and composes freely with structural directives around it.

Typical combinations:

- Conditional symbol reference:

  ```html
  <use *if="hasIcon" :xlink:href="iconRef"></use>
  ```

  If hasIcon is truthy, Sercrod evaluates iconRef and writes the result into xlink:href.
  If hasIcon is falsy, the entire use element is removed.

- Sprite based icons in a loop:

  ```html
  <serc-rod id="nav" data='{
    "spriteBase": "#icon-",
    "items": [
      { "id": "home",  "label": "Home"  },
      { "id": "about", "label": "About" }
    ]
  }'>
    <nav>
      <a *each="item of items" href="#">
        <svg aria-hidden="true">
          <use :xlink:href="spriteBase + item.id"></use>
        </svg>
        <span *print="item.label"></span>
      </a>
    </nav>
  </serc-rod>
  ```

  Each iteration uses a different xlink:href built from spriteBase and the item id.

There are no special restrictions on combining :xlink:href with structural directives such as *if, *for, or *each, because those operate at the element or container level, while :xlink:href only binds an attribute.


#### Best practices

- Use on SVG elements that support xlink:href  
  Use :xlink:href on SVG elements where xlink:href has meaning, such as use or image inside an SVG.

- Keep expressions simple  
  Prefer expressions like iconRef, spriteBase + id, or map[name] over long inline logic.
  If you need complex routing or environment dependent URLs, compute the reference string in data or in a helper function and bind that result.

- Use null or false to remove the attribute  
  When you want to remove xlink:href entirely, return null, undefined, or false from the expression.
  Sercrod will remove the attribute in these cases, which can be useful for optional icons.

- Leverage the url filter for safety and rewriting  
  If your project composes URLs or symbolic references dynamically, consider overriding the url filter to validate or normalise them.
  For example, you might restrict which sprite identifiers are allowed or ensure that the string always starts with "#".

- Coordinate with :href when needed  
  Some projects use both href and xlink:href on SVG links or hybrid elements.
  Sercrod allows :xlink:href and :href on the same element, and processes them independently.
  For clarity and maintainability, prefer a single binding per semantic target unless you have a concrete reason to assign both.


#### Additional examples

Using a mapping table:

```html
<serc-rod id="icons" data='{
  "icons": {
    "success": "#icon-check",
    "error":   "#icon-cross"
  },
  "status": "success"
}'>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <use :xlink:href="icons[status]"></use>
  </svg>
</serc-rod>
```

Here, changing status between "success" and "error" automatically switches the icon used by the use element.

Optional icon:

```html
<serc-rod id="maybe-icon" data='{
  "showIcon": false,
  "iconRef": "#icon-info"
}'>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <use :xlink:href="showIcon ? iconRef : null"></use>
  </svg>
</serc-rod>
```

When showIcon is false, :xlink:href removes the attribute and the use element no longer references any symbol.


#### Notes

- :xlink:href is a colon style attribute binding that targets the xlink:href attribute and shares the same mechanics as :href, :src, :action, and :formaction.
- The expression result is treated as read only from the perspective of Sercrod. It is never written back into data.
- Falsy values of false, null, or undefined remove the attribute, while other values are stringified and written.
- The final reference string passes through the url filter before being assigned, which allows applications to plug in custom validation or rewriting logic with full knowledge of the attribute name "xlink:href".
- If cleanup.handlers is enabled, the original :xlink:href attribute will not appear in the rendered HTML, only the concrete xlink:href attribute remains.
