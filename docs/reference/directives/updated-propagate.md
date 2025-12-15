### *updated-propagate

#### Summary

`*updated-propagate` requests a forced update on another Sercrod host after the current host or element has been updated.
It does not evaluate a JavaScript expression.
Instead, it reads a small string syntax and calls `update(true, caller)` on a single target Sercrod host.

Alias:

- `*updated-propagate`
- `n-updated-propagate`

Key points:

- Can be placed on a `<serc-rod>` host or on ordinary elements inside a Sercrod host.
- Interprets its value as a literal routing spec (selector, `root`, or numeric depth).
- Does not create variables or change the data scope.
- Runs after `*updated` on the same element, if `*updated` is present.


#### Basic example

Propagate from a nested Sercrod to its outer root:

```html
<serc-rod id="root" data='{"message":"Hello"}'>
  <h1 *print="message"></h1>

  <serc-rod id="child"
           data='{"message":"Child"}'
           *updated="onChildUpdated"
           *updated-propagate="root">
    <p *print="message"></p>
  </serc-rod>
</serc-rod>
```

Behavior:

- When `child` finishes its internal update, `*updated="onChildUpdated"` is called on the child.
- Then `*updated-propagate="root"` forces a full update on the top-level `root` Sercrod host.
- The `root` host runs its own `*updated` hooks (if any) as part of that update.


#### Behavior

High level behavior:

- On a Sercrod host (`<serc-rod>`):

  - After the host has finished rendering and its own `*updated` hooks have been processed, Sercrod checks `*updated-propagate` / `n-updated-propagate` on that host.
  - If present, it interprets the attribute value as a routing spec and finds exactly one target Sercrod host (if possible).
  - It then calls `target.update(true, callerHost)`.

- On ordinary elements inside a Sercrod host:

  - After the host’s update completes, the host walks its subtree and looks for `*updated-propagate` / `n-updated-propagate` on normal elements (not on child `<serc-rod>`).
  - For each such element, Sercrod interprets the value as a routing spec and finds a target Sercrod host (if any).
  - It then calls `target.update(true, host)`.

Important:

- The attribute’s value is always treated as a literal string.
- There is no expression evaluation, no variable interpolation, and no access to the data scope from this directive itself.
- Only a single target host is ever updated per attribute evaluation.


#### Target specification syntax

The value of `*updated-propagate` (or `n-updated-propagate`) is called the target spec.
The runtime interprets it in the following order:

1. Empty or omitted

   - If the attribute is present but has no value (for example `<div *updated-propagate></div>`) or an empty string, Sercrod treats it as `"1"`.

   - On a Sercrod host:
     - `"1"` means “go up one Sercrod host and update that ancestor”.
   - On an ordinary element:
     - Due to the current implementation, `"1"` does not result in any propagation.
     - If you want to reach the nearest Sercrod host from a normal element, you must specify at least `"2"` explicitly.

2. Parenthesized selector: `"(selector)"`

   - If the value matches `"(...)":`

     - Sercrod strips the outer parentheses and treats the inside as a CSS selector.
     - It then calls `closest(selector)` from the element where the directive lives.
     - If the result is a Sercrod host, that host receives a forced update.

   Examples:

   ```html
   <!-- On a Sercrod host: propagate to the nearest ancestor matching .layout-root -->
   <serc-rod *updated-propagate="(.layout-root)">
     ...
   </serc-rod>

   <!-- On a child element: propagate to the closest .card host -->
   <div class="card-body" *updated-propagate="(.card)">
     ...
   </div>
   ```

3. Keyword `"root"`

   - Special keyword that refers to the top-level Sercrod host around the current element.

   - On a Sercrod host:

     - Sercrod walks upward and uses the first Sercrod host it can find above the current one.
     - That host is treated as “root” for this evaluation, and receives `update(true, caller)`.

   - On an ordinary element inside a host:

     - The host uses its own notion of the outermost Sercrod root, if available.
     - If not available, it walks upward, finds a Sercrod host, then climbs to the outermost Sercrod ancestor.
     - That top-level host receives `update(true, host)`.

   This is the recommended form when you want to ensure that “the top Sercrod container for this UI” refreshes, regardless of nesting depth.

4. Numeric depth: `"N"`

   - If the value consists only of digits, Sercrod parses it as an integer depth.

   - On a Sercrod host:

     - The number counts Sercrod ancestors.
     - Sercrod starts from `parentElement` and climbs upward.
     - Each time it encounters a Sercrod host, it decrements the counter.
     - When the counter reaches zero on a Sercrod host, that host receives `update(true, callerHost)`.

     Examples:

     - `"1"`: the nearest Sercrod parent (if any).
     - `"2"`: the Sercrod grandparent, and so on.

   - On an ordinary element inside a host:

     - The numeric depth is interpreted relative to the nearest Sercrod host above the element.
     - Before climbing the DOM, Sercrod subtracts 1 from the specified depth when the directive is on a normal element.
     - Then it climbs upwards and decrements the counter on each Sercrod ancestor, similar to the host case.

     Consequences:

     - With the current implementation:
       - `"1"` on a normal element effectively results in no propagation.
       - `"2"` propagates to the nearest Sercrod host.
       - Higher numbers target further Sercrod ancestors.

     Recommendation:

     - Prefer `"root"` or `"(selector)"` when targeting from normal elements.
     - If you do use numbers on child elements, start from `"2"` for “nearest Sercrod host”.

5. Fallback: bare selector string

   - If the spec does not match any of the above patterns, Sercrod treats it as a CSS selector and calls `closest(spec)` from the element.
   - If the closest match is a Sercrod host, that host receives `update(true, caller)`.

   Example:

   ```html
   <!-- Propagate to the nearest Sercrod matching .panel-root -->
   <div *updated-propagate=".panel-root"></div>
   ```


#### Evaluation timing

`*updated-propagate` is evaluated after the main update work of the host:

- For a Sercrod host:

  1. The host runs its internal update pipeline (bindings, directives, DOM changes).
  2. The host executes its own `*updated` / `n-updated` handler(s), if present.
  3. The host interprets `*updated-propagate` / `n-updated-propagate` on itself and performs any propagation.
  4. The host then scans its normal child elements for `*updated` and `*updated-propagate` and executes those callbacks.

- For ordinary elements:

  - After step 1?3 above, the host calls `_absorb_child_updated`, which walks the DOM under the host, skipping child `<serc-rod>` instances.
  - For each normal element:
    - If `*updated` / `n-updated` is present, the host executes that handler first.
    - Regardless of `*updated`, if `*updated-propagate` / `n-updated-propagate` is present, it is then interpreted and the appropriate target host is updated.

Effects on the target host:

- The target host receives a forced update via `update(true, caller)`.
- From the target’s perspective, this looks like a normal explicit update:
  - It runs its own update pipeline.
  - It then runs its own `*updated` / `n-updated` hooks.
  - Its own `*updated-propagate` may in turn propagate further.

Loop prevention:

- Sercrod’s `update` method ignores calls if the host is already updating.
- This prevents infinite loops where two hosts trigger each other’s propagation back and forth within the same call stack.


#### Execution model

Conceptually, Sercrod performs the following steps whenever it evaluates `*updated-propagate`:

1. Read the raw attribute:

   - On a host: `this.getAttribute("*updated-propagate") || this.getAttribute("n-updated-propagate")`.
   - On a normal element: `el.getAttribute("*updated-propagate") || el.getAttribute("n-updated-propagate")`.

2. Normalize the spec:

   - If the value is null, there is no propagation.
   - If the value is the empty string, it is treated as `"1"`.
   - The string is trimmed of surrounding whitespace.

3. Interpret the spec:

   - If it starts and ends with parentheses, treat it as a selector inside `"(...)"`.
   - Else if it is exactly `"root"`, resolve the appropriate root Sercrod host.
   - Else if it is all digits, treat it as a numeric depth (with the extra adjustment for normal elements).
   - Else treat it as a bare CSS selector.

4. Resolve the target host:

   - Use `closest(selector)` on the appropriate starting element.
   - Or walk upward through parents, counting Sercrod hosts.
   - Or use the topmost Sercrod root for `"root"`.

5. Call update:

   - If a Sercrod host is found, call `target.update(true, caller)` where:
     - `caller` is the current host when called from a host-level `*updated-propagate`.
     - `caller` is the scanning host when called from a normal child element.

No errors are thrown to user code:

- If resolution fails (no matching Sercrod host, invalid selector, or runtime errors), Sercrod logs a warning (if warn-level logging is enabled) and continues.


#### Variable creation and scope layering

`*updated-propagate` does not introduce any new variables:

- It does not alter data objects.
- It does not create special variables like `$event` or `$host` in the scope of the element where it appears.
- It does not affect `data`, `$root`, or `$parent`.

Any data or event context used by the target host’s `*updated` handlers is created by that host itself, according to the rules of `*updated`, not by `*updated-propagate`.


#### Parent access

`*updated-propagate` is a routing directive, not a data access directive:

- It does not provide direct access to parent data.
- It only determines which Sercrod host should be updated after the current host or element finishes its update.
- If you need parent data, use the usual scope rules (`$parent`, `$root`, or explicit data structures) in the `*updated` handler or in regular expressions.

The main “parent” concept here is the structural parent host in the DOM tree, as used by numeric depth and the `root` keyword.


#### Use with *updated and events

`*updated-propagate` is designed to complement `*updated`:

- On a Sercrod host:

  - Typical pattern:

    ```html
    <serc-rod
      data='{"count":0}'
      *updated="onChildUpdated"
      *updated-propagate="root">
      ...
    </serc-rod>
    ```

  - `*updated` lets the host react locally to its own update (for example, scanning markers inside itself).
  - `*updated-propagate` then escalates the update to a parent or root host.

- On normal elements inside a host:

  - Typical pattern:

    ```html
    <button
      *updated="onButtonUpdated"
      *updated-propagate="root">
      Save
    </button>
    ```

  - The host first runs `onButtonUpdated` in the host’s data scope.
  - Then `*updated-propagate="root"` forces the root host to update.

Event objects:

- For `*updated` on Sercrod hosts, Sercrod synthesizes an event-like object and injects it into the evaluation as `$event`.
- `*updated-propagate` does not forward that event object to other hosts.
- When a target host is updated via `update(true, caller)`, it receives its own fresh `$event` according to the `*updated` rules, not the original one.


#### Use with conditionals and loops

`*updated-propagate` is independent of structural directives such as `*if`, `*for`, and `*each`:

- On a host:

  - Whether or not the host participated in conditions or loops elsewhere, `*updated-propagate` runs after the host’s update finishes.

- On normal elements inside loops:

  - If elements with `*updated-propagate` are created by `*for` or `*each`, they behave like any other elements.
  - After each host update, Sercrod walks the actual DOM tree and evaluates `*updated-propagate` on whichever instances currently exist.
  - This means you can safely attach `*updated-propagate` to repeated rows or items.

There are no special rules tying `*updated-propagate` to conditionals or loops beyond the normal update timing.


#### Best practices

- Prefer explicit specs:

  - Use `"root"` when you want to refresh the top-level Sercrod container.
  - Use `"(selector)"` when you want to target a particular Sercrod host by CSS.

- Be careful with numeric depths:

  - On Sercrod hosts, `"1"` is a clear way to reach the immediate Sercrod parent.
  - On normal elements, the depth is adjusted internally, and `"1"` currently does not propagate.
  - If you choose numeric depths on child elements, start from `"2"` when you intend “nearest Sercrod host”.

- Keep specs static:

  - Specs are not expressions; they are always taken literally.
  - Avoid writing values that depend on runtime data, such as `*updated-propagate="state.target"`, because they will be treated as CSS selectors and likely fail.

- Avoid unnecessary propagation:

  - Overusing `*updated-propagate` can cause a lot of forced updates.
  - Prefer local `*updated` handlers where possible and propagate only when the parent or root really needs to recompute its view.

- Use with `*updated`, not instead of it:

  - Use `*updated` for work that belongs to the current host or element.
  - Use `*updated-propagate` as a routing layer to tell other hosts that they should refresh.


#### Examples

Propagate to the nearest parent Sercrod host:

```html
<serc-rod id="parent" data='{"value": 0}'>
  <serc-rod id="child" *updated-propagate="1">
    <p>Child content</p>
  </serc-rod>
</serc-rod>
```

- After `child` updates, `"1"` points to the nearest Sercrod ancestor (here, `parent`), which receives `update(true, child)`.

Propagate from an inner element to the root:

```html
<serc-rod id="root" data='{"saved": false}'>
  <form>
    <button type="submit"
            *updated="onButtonUpdated"
            *updated-propagate="root">
      Save
    </button>
  </form>
</serc-rod>
```

- The root host runs `onButtonUpdated` when the button’s update is absorbed.
- Then `*updated-propagate="root"` forces the root host to update again, which can re-render based on new state.

Using a CSS selector in parentheses:

```html
<serc-rod class="panel" data='{"message": ""}'>
  <div class="panel-body">
    <input type="text"
           *input="message = $event.target.value"
           *updated-propagate="(.panel)">
  </div>
</serc-rod>
```

- After the input finishes updating, Sercrod finds the closest `.panel` element that is a Sercrod host and forces it to update.


#### Notes

- `*updated-propagate` and `n-updated-propagate` are simple routing directives:
  - They never evaluate JavaScript.
  - They do not touch `data`, `stage`, or any scope objects.
  - They only call `update(true, caller)` on a chosen Sercrod host.

- Specs are interpreted in a strict order:
  - Parenthesized selector, then `"root"`, then numeric depth, then bare selector.
  - Only the first matching interpretation is used.

- Only one target host is ever updated per directive evaluation.
  - There is no support for multiple specs separated by spaces or commas.
  - If the value contains spaces, it is treated as part of a single spec string.

- If resolution fails or a selector is invalid, Sercrod logs a warning (when warnings are enabled) and continues without throwing.

- There are currently no structural incompatibilities specific to `*updated-propagate`:
  - It can be combined with `*updated`, event handlers, and other attributes on the same element.
  - The main thing to watch for is update cascades; rely on Sercrod’s internal `_updating` guard to prevent infinite loops, but try to design propagation paths that are simple and predictable.
