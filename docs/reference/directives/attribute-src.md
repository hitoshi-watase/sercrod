### :src

#### Summary

:src is an attribute binding directive that controls the src attribute of an image, script, or media element.
It evaluates a Sercrod expression and writes the result into the src attribute, passing the value through a configurable url filter.
The binding is one way: data changes update the DOM attribute, but changes to the DOM attribute do not update data.

:src belongs to the URL binding family together with :href, :action, :formaction, and xlink:href.


#### Basic example

Simple image binding:

```html
<serc-rod id="app" data='{
  "imageUrl": "/assets/logo.png"
}'>
  <img :src="imageUrl" alt="Logo">
</serc-rod>
```

Behavior:

- Sercrod evaluates the expression imageUrl in the current scope.
- The result "/assets/logo.png" is stringified and passed through the url filter for the "src" attribute.
- The filtered value is assigned to the src attribute of the img element.
- When imageUrl changes in data and the host re renders, Sercrod re evaluates the expression and updates src.


#### Behavior

Core rules:

- Target attribute  
  :src targets the standard HTML src attribute. Sercrod does not enforce the tag name; it is designed for elements such as img, script, iframe, video, audio, and source, but any element can technically receive a src attribute.

- Expression evaluation  
  Sercrod reads the attribute value (for example :src="imageUrl" or :src="cdnBase + path").
  It evaluates this string as a Sercrod expression in the current scope, using an evaluation mode of attr:src.

- Value interpretation  
  After evaluation:

  - If the value is strictly false, or is null or undefined, Sercrod removes the src attribute from the element.
  - Otherwise, the value is converted to a string and passed through the url filter (see below).
  - If the url filter returns a truthy string, Sercrod sets src to that string.

- Error handling  
  If evaluating the :src expression throws an error, Sercrod falls back to a safe, minimal state by setting src to an empty string.
  The exact browser behavior for an empty src is defined by HTML and may vary, but Sercrod does not attempt to interpret it further.

- Url filter  
  For :src, as for :href, :action, :formaction, and xlink:href, Sercrod calls the url filter:

  - The filter signature is url(raw, attr, ctx).
  - For :src, raw is the stringified expression result, attr is "src", and ctx contains at least el and scope.
  - By default, the built in url filter simply returns raw unchanged.
  - Applications can override url at startup by defining window.__Sercrod_filter.url. Sercrod merges this into its internal filter map at initialization time.

- Cleanup  
  If Sercrod configuration sets cleanup.handlers to a truthy value, the original :src attribute is removed from the output DOM after processing.
  The rendered HTML then contains only the resolved src attribute, with no :src visible.


#### Evaluation timing

:src is evaluated during the element rendering phase alongside other colon style attribute bindings.

Evaluation order, simplified:

- Structural directives such as *if, *for, *each, *switch, *include, and similar determine whether the element itself is rendered and what its children look like.
- Once Sercrod decides to keep the element, it constructs a working element instance and evaluates its attributes.
- In this attribute pass, all colon attributes (names starting with ":") are processed.
- For :src, Sercrod calls eval_expr with mode attr:src and applies the url filter.
- If the Sercrod host updates due to data changes, the affected elements re render and :src is re evaluated with the updated scope.

There is no special delay, scheduling, or async behavior associated specifically with :src. It participates in the normal synchronous render cycle of the host.


#### Execution model

Conceptually, the runtime behaves as follows when it encounters a node with :src:

1. Sercrod detects an attribute whose name starts with ":" and whose key slice is "src".
2. It reads the attribute value string, for example imageUrl or cdnBase + "/images/" + fileName.
3. It evaluates this string as an expression with eval_expr, using the current scope and a mode of attr:src, with el set to the current element.
4. It inspects the evaluated result:

   - If the result is strictly false, or is null or undefined, Sercrod removes the src attribute from the element and stops.
   - Otherwise, the result is stringified.

5. Sercrod calls the url filter with the string value, the attribute name "src", and a context including the element and scope.
6. If the filter returns a truthy value, Sercrod assigns that value to the element’s src attribute.
7. If any exception occurs during evaluation or filtering, Sercrod sets src to an empty string as a fallback.
8. If cleanup.handlers is enabled, Sercrod removes the :src attribute from the element’s attribute list, leaving only the resolved src.

This process repeats on subsequent renders when data changes cause the element to be re rendered.


#### Use with structural directives and loops

Because :src is purely an attribute binding, it composes naturally with structural directives around it.

Examples:

- Conditional image:

  ```html
  <img *if="showLogo"
       :src="logoUrl"
       alt="Company logo">
  ```

  Here, *if decides whether the img element exists at all.
  If showLogo is truthy, :src is evaluated and applied; otherwise, neither the element nor its src appears in the DOM.

- Image galleries in loops:

  ```html
  <serc-rod id="gallery" data='{
    "images": [
      { "src": "/img/a.jpg", "alt": "Photo A" },
      { "src": "/img/b.jpg", "alt": "Photo B" }
    ]
  }'>
    <div class="gallery">
      <figure *each="item of images">
        <img :src="item.src" :alt="item.alt">
        <figcaption *print="item.alt"></figcaption>
      </figure>
    </div>
  </serc-rod>
  ```

  Each iteration gets its own copy of the img element and its own :src evaluation with the iteration’s scope.

There are no special restrictions on combining :src with *if, *for, *each, *switch, or template directives. They operate at different layers: structural directives control presence and shape of elements, while :src binds a single attribute on each element.


#### Best practices

- Use for resource URLs  
  Use :src for URLs that load external resources, such as images, scripts, and embedded content.
  For other attributes that are not URLs, prefer either the generic attribute binding (for example :data-id) or a dedicated attribute directive if one exists.

- Keep expressions short and clear  
  Prefer expressions like image.src, imageUrl, or cdnBase + path over long, deeply nested expressions.
  If you need complex logic (for example, selecting among many sizes or CDNs), compute the final URL in data or in a helper method and bind that single value to :src.

- Use null or false to disable loading  
  When you want to prevent a resource from loading entirely, return null, undefined, or false from the :src expression.
  Sercrod will remove the src attribute, and the browser will not attempt to load from src.

- Be deliberate about empty strings  
  If the evaluated value or fallback results in an empty string, Sercrod will set src to "".
  In HTML, an empty src may cause a request related to the current page; if you want no src at all, return null or false instead.

- Leverage the url filter for safety and rewriting  
  If your project accepts or stores URLs that may require validation or normalization, override the url filter via window.__Sercrod_filter.url.
  You can, for example, strip unsafe protocols, prepend a CDN base path, or block URLs that do not match allowed patterns.

- Combine with other colon bindings carefully  
  You can combine :src with other colon bindings on the same element (for example :alt, :title), as long as each attribute has a unique name.
  Each binding is evaluated independently during the same attribute pass.


#### Additional examples

Responsive image selection:

```html
<serc-rod id="hero" data='{
  "small": "/img/hero-small.jpg",
  "large": "/img/hero-large.jpg",
  "isMobile": false
}'>
  <img :src="isMobile ? small : large" alt="Hero">
</serc-rod>
```

When isMobile is true, :src resolves to small; when false, to large. A data update followed by a re render switches the image.

Scripts based on environment:

```html
<serc-rod id="analytics" data='{
  "env": "production",
  "scripts": {
    "staging": "https://staging.example.com/analytics.js",
    "production": "https://cdn.example.com/analytics.js"
  }
}'>
  <script :src="scripts[env]"></script>
</serc-rod>
```

By changing env in data, you can switch which analytics script is loaded without modifying markup.


#### Notes

- :src is part of the URL binding family in Sercrod. It uses the same url filter as :href, :action, :formaction, and xlink:href.
- The expression result is never written back into data. :src is strictly a data to DOM attribute binding.
- Values of false, null, or undefined remove the src attribute. Other values, including empty strings and zero, are converted to strings and assigned.
- On evaluation error, Sercrod sets src to an empty string. The browser then applies its own rules for that value.
- If cleanup.handlers is enabled in configuration, the colon attribute :src is removed after processing, leaving only the resolved src in the rendered DOM.
- For attributes that do not have their own dedicated manual (such as :aria-label or :data-*), see the generic attribute bindings documentation. :src is documented separately because it participates in the URL filter pipeline.
