### *global

#### Summary

`*global` executes one or more JavaScript statements with side effects that write into Sercrod’s shared data or the JavaScript global object.
Unlike `*let`, it does not create a local scope for children; instead, it updates existing data or `globalThis` and then continues rendering.

Use `*global` when you need to:

- Update shared Sercrod data from inside a template, especially from nested components.
- Bridge Sercrod with traditional global scripts or libraries by writing to `window` / `globalThis`.

Important points:

- `*global` does not remove its own attribute. Its expression is evaluated on every render of the element.
- Write targets are chosen dynamically:
  - If the key already exists in Sercrod data (`this._data`), that data is updated.
  - Otherwise the key is created on `globalThis` (for example `window` in a browser).


#### Basic example

Set an app title in shared data or global scope:

```html
<serc-rod id="app" data='{"message": "Hello"}'>
  <h1 *print="appTitle || 'Default title'"></h1>

  <!-- If appTitle exists in data, update it there; otherwise create window.appTitle -->
  <div *global="appTitle = 'Sercrod Demo'"></div>
</serc-rod>
```

Behavior:

- On the first render, Sercrod evaluates `appTitle = 'Sercrod Demo'` inside a sandbox.
- If `appTitle` already exists in the Sercrod data for this host, that value is updated.
- If it does not exist, `globalThis.appTitle` is created.
- After the update, Sercrod schedules a re-render, so the `<h1>` sees the new value.


#### Behavior

- `*global` is a non-structural directive. It does not change how many times the element or its children are rendered.
- It executes arbitrary JavaScript statements in a special sandbox that decides where writes go:
  - Reads: current scope first, then `globalThis`, then a placeholder for unknown keys.
  - Writes: Sercrod data when a matching key already exists, otherwise `globalThis`.

Key differences from `*let`:

- `*let`:
  - Creates a local scope for the element and its children.
  - New variables are stored in that local scope and optionally promoted to data if they do not exist there yet.
  - Does not intentionally write into `globalThis`.

- `*global`:
  - Reuses the current effective scope for reads.
  - Writes into data if the key already exists, otherwise into `globalThis`.
  - Does not create a new child scope; children see the same scope that was used before `*global`.

The attribute is not removed:

- `*global` remains on the element.
- Every time the host re-renders the element, `*global` executes again.
- Expressions should therefore be idempotent or self-guarded to avoid unintended repeated side effects.


#### Expression model

The value of `*global` is treated as one or more JavaScript statements, not as a special Sercrod grammar.

- Sercrod wraps your text as:

  - `with(scope){ <expr> }`

- There is no parsing or rewriting by Sercrod itself.
- Any valid JavaScript statement is accepted, for example:
  - Simple assignments: `count = 0`, `appTitle = 'Sercrod'`
  - Property updates: `settings.theme = 'dark'`
  - Function calls: `logChange(message)`, `store.dispatch(action)`
  - Multiple statements separated by semicolons.

Examples:

```html
<div *global="
  appTitle = 'Sercrod Demo';
  settings.ready = true;
"></div>
```

```html
<div *global="
  // Update a known data field
  profile.name = 'Taro';
"></div>
```

Notes:

- Because the code runs inside `with(scope){ ... }`, free identifiers first resolve against Sercrod’s evaluation scope, then fall back to `globalThis`.
- `*global` is intended for side effects, not for returning values.


#### Data and global write targets

`*global` uses a clear policy for writes:

- Check if the key already exists in Sercrod data (`this._data`):
  - If yes, assign to that data field.
  - If no, assign to `globalThis`.

In simplified terms:

- On write:

  - If `_data` has a key `k`, then `this._data[k] = value`.
  - Otherwise `globalThis[k] = value`.

- On read:

  - Look in the current scope (local variables, methods, `$data`, `$root`, `$parent`, etc).
  - If not found, look in `globalThis` (Math, custom globals, and so on).
  - If still not found, create a special placeholder object that tracks nested property access and will later decide where to write when assignment happens.

Practical consequences:

- If you want `*global` to update a Sercrod data field, declare that field in `data` so the key already exists.
- If you want to intentionally write to a true global variable (for example `window.appVersion`), do not define that key in `data`.


#### Scope and special helpers

Before evaluating the `*global` expression, Sercrod enriches the scope:

- `$parent`:
  - Injected when not already present.
  - Points to the data object of the nearest ancestor `serc-rod` element (or equivalent Sercrod host).
  - Not enumerable, so it does not get accidentally copied into data.

- External methods (from configuration):

  - Any names listed in `this._methods_names` are made visible in the scope.
  - If `window[name]` is a function, it is exposed as `scope[name]`.
  - If `window[name]` is an object, its function-valued properties are flattened into the scope.

- Internal Sercrod utilities:

  - All functions in `this.constructor._internal_methods` are added to the scope when not already present.

Children of the element:

- `*global` does not change the effective scope passed to children.
- Children see the same `effScope` that was active before `*global` ran, but any changes made to data or globals will influence subsequent evaluations on later renders.


#### Evaluation timing

`*global` participates in the non-structural phase of the render pipeline.

For each element processed by Sercrod:

1. Non-structural directives (no return, can be applied multiple times):
   - `*let` is evaluated first.
   - `*global` is evaluated next, using the current effective scope.
2. Structural directives (returning a specialized render result) follow:
   - `*if` / `*elseif` / `*else` chain, if present.
   - `*switch`, if present.
   - `*each` and `*for`, which control repetition.
3. Other bindings and directives on children are evaluated during child rendering.

Consequences:

- `*global` runs even if a later `*if` on the same element would decide not to render that element.
- To guard side effects, include the condition inside the `*global` expression itself:

  ```html
  <div *if="user" *global="if(user) { lastUserId = user.id; }"></div>
  ```

- Because `*global` runs before structural directives, changes it makes to data can affect `*if`, `*switch`, `*each`, and `*for` on the same element.


#### Execution model

Conceptually, when Sercrod encounters `*global` on an element:

1. It builds an evaluation scope (`scope`) that includes:
   - Current data, including `$data`, `$root`, `$parent`.
   - Methods from configuration.
   - Sercrod’s internal helper methods.

2. It wraps this scope in a `Proxy` that:
   - Always reports `true` from `has` so that `with(scope){ ... }` sees every identifier as present.
   - On `get`:
     - Returns values from `scope` if available.
     - Otherwise, returns from `globalThis` if available.
     - Otherwise, returns a special placeholder made by `_makehole_scoped()` that records the access path.
   - On `set`:
     - Converts the property key to a string.
     - If SERCROD data already has that key, writes into data.
     - Otherwise writes to `globalThis`.

3. It executes:

   - `Function("scope","el","$event", "with(scope){ " + expr + " }")(sandbox, el, null);`

4. After execution, it calls `_schedule_update()` if available to ensure any changes to data are picked up by the reactive update loop.

Error handling:

- If execution throws an exception, and `this.error?.warn` is truthy, Sercrod logs a warning:

  - It includes the directive name (`*global`), the error message, and the original expression text.


#### Use with conditionals, loops, and events

Conditionals on the same element:

- Because `*global` runs before `*if`, the side effect happens regardless of whether the element is ultimately rendered.

  ```html
  <div
    *if="ready"
    *global="logChange('host visited');"
  >
    Content
  </div>
  ```

- Here `logChange` runs whenever Sercrod processes the element, even when `ready` is false and the element content is not displayed.

Loops:

- `*global` can be used inside repeated structures (`*for` or `*each`), but be careful:

  ```html
  <ul>
    <li *for="item of items"
        *global="selectedId = item.selected ? item.id : selectedId">
      <span *print="item.label"></span>
    </li>
  </ul>
  ```

  - The expression runs once per iteration, on each render of the loop.
  - Prefer to keep `*global` logic idempotent and quick, especially in large loops.

Events:

- `*global` itself is not an event directive and does not receive `$event` directly.
- To combine event handling and global updates, use `@click` (or other event directives) to call a function that performs the global update, or call `*global`-style expressions inside that function.


#### Best practices

- Prefer data-first design:

  - Define your shared state under the Sercrod host’s `data`.
  - Use `*global` to update known keys in that data instead of creating new global variables.

- Avoid accidental global pollution:

  - If a key does not exist in `data`, `*global` writes to `globalThis`.
  - To keep the global namespace clean, predefine important keys in `data` so that updates go there instead.

- Make expressions idempotent where possible:

  - Because `*global` is re-evaluated on each render, design expressions so re-running them is safe.
  - For example:

    ```html
    <div *global="config.ready = !!config.ready"></div>
    ```

- Centralize complex logic:

  - For non-trivial operations, call a named function instead of writing complex inline code:

    ```js
    function applyServerConfig(config){
      // Complex logic here
    }
    ```

    ```html
    <div *global="applyServerConfig(config)"></div>
    ```

- Use `$parent` when writing from nested components:

  - When placed inside a nested Sercrod host, `*global` can still see `$parent`:

    ```html
    <serc-rod id="parent" data='{"state": {"count": 0}}'>
      <serc-rod id="child">
        <button *global="$parent.state.count++">
          Increment
        </button>
      </serc-rod>
    </serc-rod>
    ```

    - Here, `$parent.state.count` in the child updates the parent’s data.


#### Additional examples

Update an existing data key or create a global fallback:

```html
<serc-rod id="app" data='{"settings": { "theme": "light" }}'>
  <div *global="
    if(settings.theme === 'light'){
      settings.theme = 'dark';
    }
  "></div>
</serc-rod>
```

Bridge with a global analytics object:

```js
// External script
window.Analytics = {
  trackPage(name){
    console.log("Tracking page:", name);
  }
};
```

```html
<serc-rod id="page" data='{"title": "Home"}'>
  <div *global="Analytics.trackPage(title)"></div>
</serc-rod>
```

Write root-level counters:

```html
<serc-rod id="app" data='{"counter": 0}'>
  <button
    @click="counter++"
    *global="totalClicks = (totalClicks || 0) + 1"
  >
    Click
  </button>
</serc-rod>
```

- `counter` is stored in Sercrod data.
- `totalClicks` is created on `globalThis` (for example `window.totalClicks`) unless you declare it in `data` first.


#### Notes

- `*global` and `n-global` are aliases; they behave the same and differ only in attribute name.
- The expression is executed as plain JavaScript inside a `with(scope){ ... }` block.
- Writes follow this order:
  - If the key already exists in Sercrod data (`_data`), update data.
  - Otherwise, write to `globalThis`.
- `*global` is evaluated before structural directives such as `*if`, `*switch`, `*each`, and `*for` on the same element.
- The attribute is not removed after evaluation, so side effects happen on every render of that element.
- There is no prohibition on combining `*global` with other directives on the same element, but you should remember that:
  - `*global` runs even when later conditionals or structural directives skip rendering.
  - Repeated structures can cause the expression to run many times.
- For ordinary data flow within a component, prefer `*let` and direct assignments in bindings; reserve `*global` for shared state and interoperability with non-Sercrod code.
