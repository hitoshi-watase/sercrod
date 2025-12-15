### :href

#### Summary

:href is an attribute binding directive that controls the href attribute of a link or resource element.
It evaluates a Sercrod expression and writes the result into the href attribute, optionally passing the value through a configurable url filter.
The binding is one way: data updates change the DOM attribute, but changes to the DOM attribute do not update data.

:href is part of the generic colon attribute family and shares the same evaluation rules as other colon bindings such as :src and :action.


#### Basic example

A simple data driven link:

```html
<serc-rod id="app" data='{
  "url": "https://example.com/docs"
}'>
  <a :href="url">Open documentation</a>
</serc-rod>
```

Behavior:

- The Sercrod host receives data with url set to "https://example.com/docs".
- When the link is rendered, Sercrod evaluates the expression url in the current scope.
- The result is converted to a string, passed through the url filter, and written into the a element’s href attribute.
- If data.url changes and the host is updated, the href attribute is updated to match the latest value.


#### Behavior

Core rules:

- Target attribute  
  :href targets the standard HTML href attribute. It is typically used on a elements, but can also be used on other href capable elements such as area and link. Sercrod does not enforce any restriction on the tag name.

- Expression evaluation  
  Sercrod reads the attribute value (for example :href="url" or :href="base + '/users/' + userId").
  It evaluates the expression in the current scope using the attribute binding mode attr:href.

- Value interpretation  
  After evaluation:

  - If the value is strictly false or is null or undefined, Sercrod removes the href attribute from the element.
  - Otherwise, the value is converted to a string and passed through the url filter.
  - If the url filter returns a truthy value, Sercrod sets href to that filtered value.

- Error handling  
  If evaluating the :href expression throws an error, Sercrod falls back to a safe state by setting an empty href attribute on the element.

- Url filter  
  For :href (as for :src, :action, :formaction, and xlink:href), Sercrod calls the url filter:

  - The filter signature is url(raw, attr, ctx).
  - For :href, raw is the stringified expression result, attr is "href", and ctx contains el and scope.
  - By default, the built in url filter simply returns raw unchanged.
  - Projects can override url at startup via window.__Sercrod_filter to perform validation, rewriting, or blocking of unsafe URLs.

- Cleanup  
  If Sercrod configuration sets cleanup.handlers to a truthy value, the original :href attribute is removed from the output DOM after it has been processed.
  In that case, only the final href attribute remains visible in the rendered HTML.


#### Evaluation timing

:href is evaluated during the element rendering phase, together with other colon style attribute bindings.

More precisely:

- Structural directives such as *if, *for, *each, *switch, *include, and others decide first whether the element is present and what its children look like.
- Once Sercrod has decided to keep the element and has a working element instance for rendering, it walks through its attributes.
- For every attribute whose name starts with a colon, Sercrod dispatches to the colon binding path.
- For :href, this happens in the same pass as :src and :action.
- If the Sercrod host updates due to data changes, the link is re rendered and :href is re evaluated with the latest scope.

There is no separate scheduling or delay specific to :href. It participates in the normal render update cycle of the host.


#### Execution model

Conceptually, when Sercrod renders an element with :href, the steps are:

1. Sercrod encounters a node that has an attribute named :href.
2. It reads the expression string from that attribute, for example url or base + "/users/" + userId.
3. It evaluates the expression with eval_expr, using the current scope and a context that sets mode to attr:href and el to the current element.
4. It inspects the result:

   - If the result is strictly false, or is null or undefined, Sercrod removes the href attribute from the element and stops.
   - Otherwise, it converts the result to a string and passes it to the url filter, along with the attribute name "href" and a context with the element and scope.

5. If the url filter returns a truthy string, Sercrod sets the element attribute href to that string.
6. If evaluation throws an exception at any point, Sercrod falls back to setting href to an empty string.
7. If cleanup.handlers is enabled in the configuration, Sercrod removes the original :href attribute from the element, leaving only the concrete href attribute in the output DOM.


#### Use with structural directives and loops

Because :href is only an attribute binding, it composes freely with structural directives around it.

Typical combinations:

- Conditional links:

  ```html
  <a *if="isLoggedIn" :href="profileUrl">Your profile</a>
  <span *if="!isLoggedIn">Please log in</span>
  ```

  Only when isLoggedIn is true is the link rendered, and only then is :href evaluated.

- Links inside loops:

  ```html
  <ul *each="item of items">
    <li>
      <a :href="item.url" *print="item.label"></a>
    </li>
  </ul>
  ```

  For each iteration, :href is evaluated using that iteration scope, so each link points to a different URL.

- Links with events:

  ```html
  <a :href="item.url"
     @click="trackClick(item)">
    {{%item.label%}}
  </a>
  ```

  :href controls navigation, while @click allows tracking or other side effects. If you add *prevent-default on the same element, the browser navigation will be suppressed even if href is set.


#### Best practices

- Use on link and resource elements  
  Use :href primarily on elements where href is meaningful, such as a, area, and link. Sercrod does not prevent using it on other elements, but it is rarely useful there.

- Keep expressions simple  
  Prefer expressions like url, item.url, or base + path segments over very long inline logic.
  If you need elaborate branching or construction, compute the URL in data or in a helper function and bind that result.

- Use null or false to disable navigation  
  When you want to temporarily disable a link or fall back to a non navigational element, return null, undefined, or false from the :href expression.
  Sercrod will remove the href attribute in these cases, leaving the element clickable only for any attached events.

- Leverage the url filter for safety  
  If your project accepts or constructs dynamic URLs from user influenced data, consider overriding the url filter to reject or normalise unsafe URLs, for example by blocking unsupported protocols or rewriting to a safe base.

- Combine with events deliberately  
  You can freely use :href alongside event bindings such as @click or structural helpers like *prevent-default.
  Decide explicitly whether navigation should occur (no *prevent-default) or whether the link is only a styled trigger for a JavaScript action (*prevent-default).

- Combine with other colon bindings carefully  
  You can use :href on the same element as other colon bindings (for example :class or :title), as long as they target different attributes.
  Each binding is evaluated independently in the same attribute pass.


#### Additional examples

Building URLs from parameters:

```html
<serc-rod id="app" data='{
  "userId": 42,
  "base": "/users"
}'>
  <a :href="base + '/' + userId">View profile</a>
</serc-rod>
```

Localised links:

```html
<serc-rod id="app" data='{
  "locale": "en",
  "docs": {
    "en": "/docs/en/guide",
    "ja": "/docs/ja/guide"
  }
}'>
  <a :href="docs[locale]">Read guide</a>
</serc-rod>
```

Links that can be disabled:

```html
<serc-rod id="app" data='{
  "item": { "url": "/pay", "enabled": false }
}'>
  <a :href="item.enabled ? item.url : null"
     @click="item.enabled && pay(item)">
    Proceed to payment
  </a>
</serc-rod>
```

When item.enabled is false, :href removes the href attribute, and only the click handler (if not guarded) will run.


#### Notes

- :href is a colon style attribute binding that targets the href attribute and shares the same mechanics as :src, :action, :formaction, and xlink:href.
- The expression result is treated as read only from the perspective of Sercrod. It is never written back into data.
- Falsy values of false, null, or undefined remove the attribute, while other values are stringified and written.
- The final URL passes through the url filter before being assigned, which allows applications to plug in custom validation or rewriting logic at startup.
- If cleanup.handlers is enabled, the original :href attribute will not appear in the rendered HTML, only the concrete href attribute remains.
