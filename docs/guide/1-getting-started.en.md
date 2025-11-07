# Getting Started with Nablla
_Last updated: 2025-10-22_

> This chapter helps you set up Nablla and understand its basic structure through short examples.  

## 1) Setup
Nablla works in any modern browser ? no build tools, no bundlers.

<!-- Include Nablla from CDN -->
```html
<script src="https://cdn.jsdelivr.net/npm/nablla@1.0.0/dist/nablla.min.js"></script>
```

<!-- Or include a local build -->
```html
<script src="./index.js"></script>
```

Once loaded, Nablla registers the `<na-blla>` element and enables attribute directives.

---

## 2) First Example
A minimal Nablla instance written as pure HTML.

<!-- Minimal one-liner -->
```html
<na-blla>
  <p *let="message='Hello Nablla!'">%message%</p>
</na-blla>
```

What it shows: define a local value with `*let`, render it with `%message%`. No JavaScript required.

---

## 3) Add Some Interaction
Make the message editable by the user.

<!-- Interactive sample -->
```html
<na-blla>
  <section *let="name='World'">
    <h2>Hello, %name%!</h2>
    <input *input="name" placeholder="Type your name..." />
  </section>
</na-blla>
```

Type in the input and watch the text update. `*input` keeps `name` in sync both ways.

---

## 4) How It Works
| Flow | Role |
|------|------|
| attributes -> data | handled by Web Components (`attributeChangedCallback`) |
| data -> attributes | handled by Nablla (writes back only when needed) |

No virtual DOM. No custom runtime. HTML remains the source of truth.

---

## 5) Snippets (external files)
- Snippet #1: `./snippets/intro-hero.html`
- Snippet #2: `./snippets/intro-dynamic.html`

---

## 6) Next Steps
- Learn more directives: `*let`, `*text`, `*if`, `*input`, etc.
- Read the philosophy in `docs/0-intro.en.md`.
- Contribute at: https://github.com/hitoshi-watase/nablla

---

(c) 2025 Hitoshi Watase - Nablla Project.  
License: GNU General Public License v3.0 or later (GPLv3+)
