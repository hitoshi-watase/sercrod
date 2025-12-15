### :formaction

#### Summary

:formaction is an attribute binding directive that controls the formaction attribute on form submit controls such as button and input type="submit".
It evaluates a Sercrod expression and writes the result into the formaction attribute, optionally passing the value through a configurable url filter.
The binding is one way: data updates change the DOM attribute, but changes to the DOM attribute do not update data.

:formaction is part of the generic colon attribute family and shares the same evaluation rules as other colon bindings such as :href, :src, and :action.


#### Basic example

A form with per button endpoints:

```html
<serc-rod id="app" data='{
  "saveEndpoint": "/api/save",
  "deleteEndpoint": "/api/delete"
}'>
  <form method="post" action="/api/default">
    <button type="submit" :formaction="saveEndpoint">
      Save
    </button>
    <button type="submit" :formaction="deleteEndpoint">
      Delete
    </button>
  </form>
</serc-rod>
```

Behavior:

- The form has a default action attribute "/api/default".
- Each button has its own :formaction binding.
- Sercrod evaluates saveEndpoint and deleteEndpoint and writes the results into each button's formaction attribute.
- When the user clicks Save, the browser submits to /api/save; when they click Delete, it submits to /api/delete, following standard HTML semantics for formaction.


#### Behavior

Core rules:

- Target attribute  
  :formaction targets the standard HTML formaction attribute on submit controls.
  In normal HTML, formaction overrides the parent form action for submissions triggered by that control.
  Sercrod does not implement that override itself; it only sets the attribute. The browser provides the actual behavior.

- Expression evaluation  
  Sercrod reads the attribute value from :formaction (for example :formaction="endpoint" or :formaction="mode === 'archive' ? archiveUrl : saveUrl").
  It evaluates the expression in the current scope using the attribute binding mode attr:formaction.

- Value interpretation  
  After evaluation:

  - If the value is strictly false, or is null or undefined, Sercrod removes the formaction attribute from the element.
  - Otherwise the value is converted to a string and passed through the url filter.
  - If the url filter returns a truthy value, Sercrod sets formaction to that filtered value.

- Error handling  
  If evaluating the :formaction expression throws an error, Sercrod falls back to a safe state by setting an empty formaction attribute on the element.

- Url filter  
  For :formaction (as for :href, :src, :action, and xlink:href), Sercrod calls the url filter:

  - The filter signature is url(raw, attr, ctx).
  - For :formaction, raw is the stringified expression result, attr is "formaction", and ctx contains el and scope.
  - By default, the built in url filter simply returns raw unchanged.
  - Projects can override url at startup via window.__Sercrod_filter to perform validation, rewriting, or blocking of unsafe URLs.

- Cleanup  
  If Sercrod configuration sets cleanup.handlers to a truthy value, the original :formaction attribute is removed from the output DOM after it has been processed.
  In that case, only the final formaction attribute remains visible in the rendered HTML.


#### Evaluation timing

:formaction is evaluated during the element rendering phase, together with other colon style attribute bindings.

More precisely:

- Structural directives such as *if, *for, *each, *switch, *include, and others run first and decide whether the element is present and what its children look like.
- When Sercrod decides to keep the element and is ready to render it, it walks through its attributes.
- For every attribute whose name starts with a colon, Sercrod dispatches to the colon binding path.
- For :formaction, this happens in the same pass as :href, :src, and :action.
- If the Sercrod host updates due to data changes, the host re renders and :formaction is re evaluated with the latest scope.

There is no separate scheduling or delay specific to :formaction. It participates in the normal render update cycle of the host.


#### Execution model

Conceptually, when Sercrod renders an element with :formaction, the steps are:

1. Sercrod encounters a node that has an attribute named :formaction.
2. It reads the expression string from that attribute, for example endpoint or mode === 'archive' ? archiveUrl : saveUrl.
3. It evaluates the expression with eval_expr, using the current scope and a context that sets mode to attr:formaction and el to the current element.
4. It inspects the result:

   - If the result is strictly false, or is null or undefined, Sercrod removes the formaction attribute from the element and stops.
   - Otherwise, it converts the result to a string and passes it to the url filter, along with the attribute name "formaction" and a context with the element and scope.

5. If the url filter returns a truthy string, Sercrod sets the element attribute formaction to that string.
6. If evaluation throws an exception at any point, Sercrod falls back to setting formaction to an empty string.
7. If cleanup.handlers is enabled in the configuration, Sercrod removes the original :formaction attribute from the element, leaving only the concrete formaction attribute in the output DOM.


#### Use with forms and actions

Because :formaction is a pure attribute binding, it composes naturally with the rest of the form and with :action:

- Default action plus per button overrides:

  ```html
  <serc-rod id="app" data='{
    "defaultAction": "/api/default",
    "specialAction": "/api/special"
  }'>
    <form method="post" :action="defaultAction">
      <button type="submit">
        Default submit
      </button>
      <button type="submit" :formaction="specialAction">
        Special submit
      </button>
    </form>
  </serc-rod>
  ```

  - When the first button is used, the browser submits to defaultAction.
  - When the second button is used, the browser submits to specialAction.

- Combined with validation and event handlers:

  ```html
  <form method="post" :action="endpoint" @submit="validateAndMaybeSubmit($event)">
    <button type="submit" :formaction="dangerEndpoint">
      Dangerous action
    </button>
  </form>
  ```

  In this pattern, :formaction sets the DOM attribute and the event handler decides whether to let the browser submit, use Sercrod *post, or prevent the submission entirely.


#### Use with structural directives and loops

:formaction is evaluated at the element level and does not interfere with container level structural directives.

Examples:

- Conditional submit controls:

  ```html
  <form method="post" :action="defaultEndpoint">
    <button type="submit" *if="canSave" :formaction="saveEndpoint">
      Save
    </button>
    <button type="submit" *if="canDelete" :formaction="deleteEndpoint">
      Delete
    </button>
  </form>
  ```

  Each button is only rendered when its *if condition is true, and its :formaction is evaluated inside that conditional scope.

- Submit controls inside loops:

  ```html
  <serc-rod id="app" data='{
    "items": [
      { "id": 1, "endpoint": "/api/items/1/action" },
      { "id": 2, "endpoint": "/api/items/2/action" }
    ]
  }'>
    <ul *each="item of items">
      <li>
        <form method="post">
          <input type="hidden" name="id" :value="item.id">
          <button type="submit" :formaction="item.endpoint">
            Run action for {{%item.id%}}
          </button>
        </form>
      </li>
    </ul>
  </serc-rod>
  ```

  The :formaction is evaluated separately for each iteration, using that iteration's item as part of the scope.


#### Best practices

- Use on submit controls  
  Use :formaction on button and input elements that can trigger a form submission.
  This matches the standard meaning of formaction in HTML and avoids confusing markup.

- Keep expressions simple  
  Prefer expressions like item.endpoint or routes[dangerLevel] over long inline branches.
  If you need more complex logic, compute a prepared URL in data or in a helper method and bind that.

- Use null or false to remove the attribute  
  When you do not want a per button override, return null, undefined, or false from the expression.
  Sercrod will remove the formaction attribute and the browser will fall back to the parent form action.

- Use url filter for central control  
  If you want to validate or rewrite all submission endpoints in one place, implement a custom url filter.
  Since :formaction uses the url filter with attr set to "formaction", you can distinguish it from other URL bindings if necessary.

- Combine with :action deliberately  
  A typical pattern is:

  - Use :action on the form to define the default endpoint.
  - Use :formaction on specific buttons to override that endpoint when needed.

  This mirrors native HTML behavior and keeps intent clear in the markup.


#### Additional examples

Switching endpoint based on environment:

```html
<serc-rod id="app" data='{
  "env": "staging",
  "endpoints": {
    "staging": "https://staging.example.com/api/bulk",
    "production": "https://example.com/api/bulk"
  }
}'>
  <form method="post" action="/noop">
    <button type="submit" :formaction="endpoints[env]">
      Run bulk job
    </button>
  </form>
</serc-rod>
```

Here, changing env in data (for example from "staging" to "production") changes the target endpoint for submissions triggered by the button.


#### Notes

- :formaction is a colon style attribute binding that targets formaction and shares its mechanics with :href, :src, :action, and xlink:href.
- Sercrod only sets the attribute; the semantics of how the form is submitted with formaction are provided by the browser.
- The expression result is never written back into data. It is read only from the perspective of Sercrod.
- Falsy values of false, null, or undefined remove the formaction attribute, while other values are stringified and written.
- The final URL passes through the url filter before being assigned, which allows applications to plug in custom validation or rewriting.
- If cleanup.handlers is enabled, the original :formaction attribute will not appear in the rendered HTML, only the concrete formaction attribute remains.
