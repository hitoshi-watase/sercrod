### *if

#### Summary

*if conditionally renders an element when the expression is truthy.
*elseif and *else form a chain with a preceding *if so that exactly one branch is chosen.
The chain is defined across sibling elements and is evaluated from left to right.

Aliases:

- *if and n-if are aliases.
- *elseif and n-elseif are aliases.
- *else and n-else are aliases.

Only one of the branches in a single chain is rendered; the others are skipped.


#### Basic example

A simple visible or hidden panel:

```html
<serc-rod id="app" data='{"show": true}'>
  <section *if="show">
    <h2>Panel</h2>
    <p>This panel is visible when show is truthy.</p>
  </section>
</serc-rod>
```

When show is truthy, the section is rendered.
When show becomes falsy, the section is not rendered at all.


#### Behavior

*if, *elseif, and *else work together as a chain on sibling elements.

Core rules:

- A chain starts at an element that has *if or n-if.
- Following siblings that have *elseif, n-elseif, *else, or n-else belong to the same chain, as long as there are no non-conditional elements in between.
- The chain ends when:
  - A non-conditional element appears, or
  - A new *if or n-if appears, which starts a new chain.

For each chain:

1. Sercrod evaluates the branches from left to right.
2. The first branch whose condition is truthy is selected.
3. If no condition is truthy and there is an *else branch, that *else branch is selected.
4. If no branch is selected (no truthy condition and no *else), nothing is rendered for this chain.

Invalid chains:

- A *elseif or *else that is not connected to a preceding *if in the same sibling group is ignored.
  It does not render anything on its own.

Rendering result:

- Only the chosen branch is cloned and rendered into the output.
- All branches in the original chain serve as templates and are not directly appended to the DOM.


#### Condition evaluation semantics

The expression on *if or *elseif is evaluated using Sercrod’s expression evaluator with special truthiness rules:

- If the evaluated value is exactly false, the condition is false.
- If it is exactly true, the condition is true.
- If it is null or undefined, the condition is false.
- If it is a number:
  - 0 or NaN are treated as false.
  - Any other number is treated as true.
- If it is a string:
  - The string is trimmed and lowercased.
  - An empty string, "false", "0", "null", and "undefined" are treated as false.
  - Any other string is treated as true.
- For other types, JavaScript Boolean semantics are used (Boolean(value)).

If evaluating the expression throws an error:

- Sercrod falls back to a simple string check:
  - If the raw expression text is exactly "true" (ignoring spaces and case), the condition is treated as true.
  - If it is exactly "false", the condition is treated as false.
- Otherwise, Sercrod warns (when error logging is enabled) and treats the condition as false.

Empty expressions:

- If the attribute value is empty (for example *if="" or missing), the condition is treated as false and the branch is never selected.


#### Evaluation timing

The evaluation order around *if is:

1. Host-level *let (non structural) is evaluated before structural directives:
   - *let or n-let on the same element can prepare or adjust the scope before *if runs.
2. The *if / *elseif / *else chain is detected and evaluated on sibling elements.
   - If the current node is not the head of a chain, it delegates to the head.
3. If no branch is selected, nothing in the chain is rendered and Sercrod returns.
4. If a branch is selected:
   - The chosen element is cloned.
   - Conditional attributes (*if, n-if, *elseif, n-elseif, *else, n-else) and branch-level *let are removed from the clone.
   - The clone is then rendered as a normal element, so other directives on it (such as *switch, *each, *for, attribute bindings, events, and so on) are applied in the usual order.

Effectively:

- Host-level *let runs before *if.
- *if chaining decides which branch is used.
- All remaining directives on the chosen branch are processed afterwards on the clone.


#### Execution model

Conceptually, Sercrod processes *if chains like this:

1. Starting from a given node, check whether it has any of *if, *elseif, *else, or their n- aliases.
2. If so, find the head of the chain:
   - If the current node has *if or n-if, it is the head.
   - Otherwise, scan previous siblings to find the nearest *if or n-if, stopping when:
     - A non-conditional element is encountered, or
     - The beginning of the container is reached.
3. If no *if is found, the current *elseif or *else is treated as an invalid chain and ignored.
4. Only when processing the head element:
   - Collect the chain by walking right through sibling elements that have *if, *elseif, or *else.
   - Stop when hitting:
     - A non-conditional element, or
     - A new *if or n-if (which starts another chain).
5. For each collected branch:
   - Start with the effective scope that includes host-level *let.
   - If the branch element has *let or n-let, create a branch scope that prototypes the parent scope and apply that *let into it.
   - For an else branch:
     - If no branch has been chosen yet, mark this branch as a candidate and break evaluation.
   - For an if or elseif branch:
     - Evaluate the condition using the branch scope.
     - If truthy, choose this branch, remember its branch scope, and stop evaluating further branches.
6. If no branch has been chosen:
   - The entire chain renders nothing and returns.
7. If a branch has been chosen:
   - Clone the chosen element.
   - Remove all conditional attributes and branch-level *let attributes from the clone.
   - Render the clone with the chosen branch scope.
   - The original chain elements remain only as template nodes.

This model keeps the chain logic compact and ensures exactly one branch (or none) appears in the final DOM.


#### Variable creation and scope layering

*if by itself does not create new variables.
However, it interacts with *let in two ways:

- Host-level *let:
  - *let or n-let on the same element (prior to the chain) is applied once before structural directives.
  - It can define or update variables in the effective scope for all directives, including *if and *switch.

- Branch-level *let:
  - Each branch in a chain can have its own *let or n-let.
  - For each branch, Sercrod creates a branch scope that:
    - Inherits from the current effective scope.
    - Is populated with variables and changes from branch-level *let.
  - Conditions for that branch are evaluated using this branch scope.
  - If the branch is selected, the branch scope is used for rendering the chosen element.

Important points:

- Branch *let only affects the branch in which it is declared.
- Branch-level variables live inside the chosen branch and its descendants, not across the entire chain.
- Special helpers such as $data, $root, and $parent are still available inside branch scopes.


#### Parent access

*if does not introduce any special parent references on its own.

Within a chosen branch:

- You can access the current Sercrod host’s data using the names defined on the host (for example state or items).
- You can access root-level data through $root.
- You can access the nearest ancestor Sercrod host’s data through $parent.
- All of these are injected by Sercrod’s expression engine, not by *if itself.

Branch-level *let can add or override variables on top of these, but does not remove access to parent data.


#### Use with conditionals and loops

Combining *if with loops and other structural directives is common and supported when they are placed thoughtfully.

Basic patterns:

- Gating a loop container:

  ```html
  <ul *if="items && items.length" *each="item of items">
    <li>
      <span *print="item.label"></span>
    </li>
  </ul>
  ```

  - If items is falsy or empty, the whole list is not rendered.
  - When the condition passes, the body of *each runs as usual on the chosen branch.

- Gating a repeated element:

  ```html
  <ul>
    <li *for="item of items" *if="item.visible">
      <span *print="item.label"></span>
    </li>
  </ul>
  ```

  - The *if is evaluated first on the host element.
  - When *if passes, the chosen branch is cloned and then *for runs on that clone.
  - If *if fails, the element does not participate in the loop.

- Using *if inside a loop body:

  ```html
  <ul *each="item of items">
    <li>
      <span *if="item.visible" *print="item.label"></span>
      <span *else>Hidden</span>
    </li>
  </ul>
  ```

  - In this pattern, *if, *elseif, and *else form small chains inside the loop body.
  - The chain is evaluated separately for each iteration.

*if and *switch:

- A chosen *if branch may still contain *switch, *each, *for, and other structural directives.
- The chosen element is rendered again as a normal node, so *switch will run on it after *if has selected the branch.


#### Use with templates, include, and import

*if works naturally with *template, *include, and *import.

Typical combinations:

- Conditional include:

  ```html
  <div *if="user" *include="'user-card'"></div>
  ```

  - *if chooses whether the div participates.
  - On the chosen branch, *include replaces the inner content with the template content.

- Conditional import:

  ```html
  <section *if="logged_in" *import="'dashboard-block'"></section>
  ```

  - *if controls whether the section is rendered.
  - *import then fetches and injects HTML into the section.
  - After *import sets node.innerHTML and removes itself, Sercrod continues rendering so any *if directives inside the imported HTML are processed.

- Conditions inside templates:

  ```html
  <script type="application/sercrod-partial">
    partial.data = {
      title: "User list",
      description: "A list with conditional badges.",
      terminator: null
    };
  </script>

  <template *template="'user-row'">
    <tr>
      <td>{{ name }}</td>
      <td *if="is_admin">Admin</td>
      <td *else>Regular</td>
    </tr>
  </template>
  ```

  - The *if/*else chain lives inside the template and is evaluated each time the template is rendered.

Restrictions:

- *if does not have any special prohibition with *include or *import on the same element.
- The main structural restriction for *if is within its own chain:
  - *elseif and *else must have a valid preceding *if in the same sibling group.
  - Otherwise they are ignored.


#### Best practices

- Keep conditions simple:

  - Prefer short, readable expressions such as mode === "edit".
  - Move complex logic into data or helper functions that return simple booleans.

- Use chains for clear branching:

  - Use *if, *elseif, *else chains for mutually exclusive branches instead of stacking multiple separate *if elements.

  ```html
  <p *if="mode === 'view'">Viewing</p>
  <p *elseif="mode === 'edit'">Editing</p>
  <p *else>Unknown mode</p>
  ```

- Use branch-level *let for local derivations:

  ```html
  <div *if="user" *let="full = user.first_name + ' ' + user.last_name">
    <p>Hello, {{ full }}</p>
  </div>
  ```

  - Branch *let is a good place to compute display-specific values without polluting global data.

- Avoid relying on subtle truthiness of strings:

  - Remember that empty string and several special literals ("false", "0", "null", "undefined") are treated as false.
  - If you want to be explicit, use clear conditions such as status === "ok".

- Keep chains contiguous:

  - Place *if, *elseif, and *else on consecutive sibling elements without unrelated elements in between.
  - Inserting a non-conditional element breaks the chain and can make trailing *elseif or *else invalid.

- Do not expect *else to render by itself:

  - *else only makes sense as part of a chain.
  - Without a preceding *if, it is ignored.


#### Additional examples

Toggling content based on numeric thresholds:

```html
<serc-rod id="score-app" data='{"score": 72}'>
  <p *if="score >= 80">Great job!</p>
  <p *elseif="score >= 50">Good effort.</p>
  <p *else>Keep trying.</p>
</serc-rod>
```

Checking multiple flags:

```html
<serc-rod id="flags" data='{"is_guest": false, "is_admin": true}'>
  <p *if="is_admin">Administrator view</p>
  <p *elseif="is_guest">Guest view</p>
  <p *else>Standard user view</p>
</serc-rod>
```

Using *if to guard a costly block:

```html
<serc-rod id="lazy" data='{"show_details": false}'>
  <button @click="show_details = !show_details">
    Toggle details
  </button>

  <section *if="show_details">
    <h2>Details</h2>
    <p>Only rendered when needed.</p>
  </section>
</serc-rod>
```


#### Notes

- *if, *elseif, and *else form a sibling-based chain; only one branch is rendered.
- The n- prefixed forms (n-if, n-elseif, n-else) are aliases intended to help with HTML validators that dislike asterisk-prefixed attributes.
- Conditions are evaluated with normalized truthiness:
  - False, null, undefined, 0, NaN, empty string, "false", "0", "null", and "undefined" are treated as false.
  - True and other values follow JavaScript Boolean semantics.
- Branch-level *let is evaluated per branch and only affects that branch’s scope.
- *elseif and *else without a valid preceding *if in the same sibling group are ignored.
- *if can be combined with other structural directives such as *for, *each, *switch, *include, and *import, as long as you remember that:
  - Host-level *let and *if run before other structural directives on the chosen branch.
  - The chosen branch is rendered as a normal element afterwards, so its remaining directives are processed in the usual order.
