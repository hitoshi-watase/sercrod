# Overview

_What you will find:_ a high-level picture of Sercrod’s runtime model, its public surface, and how templates are rendered and updated. This page orients you before the per-topic references.

## Canonical source and version

This reference tracks the canonical source designated as [SERCROD_CANONICAL]. Current header indicates `Sercrod v1.0.0`. :contentReference[oaicite:0]{index=0}

## What Sercrod is

Sercrod is a Web Components based runtime that treats HTML attributes as the source of truth. Browsers already handle attribute → DOM. Sercrod drives data → attributes so that attribute-first synchronization is explicit and stable. :contentReference[oaicite:1]{index=1}

- **Host element:** a custom element instance - by default `<serc-rod>` is auto-defined. :contentReference[oaicite:2]{index=2}
- **Data:** a JSON object bound through the `data` attribute or via `host.data = {...}`. Sercrod wraps it for reactivity. :contentReference[oaicite:3]{index=3}
- **Observed attributes:** `"data"`, `"*updated"`, `"*methods"`, `"n-updated"`, `"n-methods"`. :contentReference[oaicite:4]{index=4}

## Public surface at a glance

Directives exist in two equivalent forms - the asterisk form `*if` and the `n-` form `n-if`. The full set spans control flow, data binding, attributes, events, lifecycle, network and files, and WebSocket. :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}

- **Control:** `*if`, `*elseif`, `*else`, `*switch`, `*case`, `*default`, `*break` (plus `*case.break`). :contentReference[oaicite:8]{index=8}
- **Data & binding:** `*input`, `*lazy`, `*eager`, `*stage`, `*apply`, `*restore`, `*save`, `*load`, `*print`, `*compose`, `*textContent`, `*innerHTML`. :contentReference[oaicite:9]{index=9}
- **Network & API:** `*fetch`, `*post`, `*api`, optionally `*into` to designate a storage key. :contentReference[oaicite:10]{index=10}
- **Files:** `*upload`, `*download`. :contentReference[oaicite:11]{index=11}
- **WebSocket:** `*websocket`, `*ws-send`. :contentReference[oaicite:12]{index=12}
- **Attributes shorthand:** `:class`, `:style` (and `n-class`, `n-style`). :contentReference[oaicite:13]{index=13}
- **Events / lifecycle helpers:** `*prevent-default`, `*prevent`, `*updated`, `*updated-propagate`, `*methods`, `*log`, `*strict`. :contentReference[oaicite:14]{index=14}

See: [`directives.md`](./directives.md) for precise semantics.

## Rendering and update model

- **Template capture and AST:** the host captures its initial `innerHTML` as a template, parses it into a lightweight DOM-AST, runs registered AST hooks, caches results, and renders nodes. :contentReference[oaicite:15]{index=15}
- **Interpolation:** plain text containing `%expr%` is expanded; `*print` and `*compose` render text and HTML respectively. :contentReference[oaicite:16]{index=16} :contentReference[oaicite:17]{index=17}
- **Scheduling:** updates are aggregated with `requestAnimationFrame` to avoid redundant renders. (Host keeps rAF flags to coalesce passes.) :contentReference[oaicite:18]{index=18}
- **Finalization:** after an update, Sercrod clears transient stores on the next frame - `$upload`, `$download`, and any keys recorded by `*into`. :contentReference[oaicite:19]{index=19}

Details: [`lifecycle.md`](./lifecycle.md).

## Data, scope, and expressions

- **Reactive data:** objects are wrapped via Proxies. Immediate wrapping depends on observe mode; deep properties are wrapped on demand. :contentReference[oaicite:20]{index=20} :contentReference[oaicite:21]{index=21}
- **Change events:** only observed keys dispatch `sercrod-change`; diff aggregation - if enabled - happens in finalize. :contentReference[oaicite:22]{index=22}
- **Stage buffer:** `*stage` enables a working copy for UI edits until `*apply` or `*restore`. (Initialized per host.) :contentReference[oaicite:23]{index=23}
- **Evaluation context:** expressions run with the current scope; `*methods` injects functions by name or object; `*updated` lists post-update callbacks. Observed attributes mirror these lists. :contentReference[oaicite:24]{index=24}
- **Event helpers:** `@event` handlers support standard modifiers like `.prevent` and `.stop` - see events section in `directives.md`. (Overview does not redefine them here.)

## Communication primitives

- **HTTP:** `*fetch` and `*post` perform JSON I/O. The `*into` key stores results into a named property for the current cycle. :contentReference[oaicite:25]{index=25}
- **Files:** `*upload` sends files with XHR and emits granular events; `*download` saves a Blob via `fetch` or `xhr` transport. :contentReference[oaicite:26]{index=26} :contentReference[oaicite:27]{index=27} :contentReference[oaicite:28]{index=28}
- **Transient data:** `$upload` and `$download` are set when present and then cleared in finalize along with any `*into` keys. :contentReference[oaicite:29]{index=29}

More in: [`communication.md`](./communication.md).

## WebSocket state

- `*websocket` connects and tracks `$ws_ready`, `$ws_error`, `$ws_last`, plus close metadata. `*ws-send` sends to the current or specified socket. Close and error paths reset internal once-flags so manual retries are possible. :contentReference[oaicite:30]{index=30} :contentReference[oaicite:31]{index=31} :contentReference[oaicite:32]{index=32}

See: [`websocket.md`](./websocket.md).

## Filters and hooks

- **Filters (defaults):** `html`, `url`, `attr`, `input_out`, `input_in`, `style`, `text`, `placeholder`. Implementations are pluggable and called at well-defined points. :contentReference[oaicite:33]{index=33}
- **AST hooks:** `Sercrod.register_ast_hook(fn)` runs hooks after parse; AST is cached by template string. Pre-hooks and caches are available. :contentReference[oaicite:34]{index=34} :contentReference[oaicite:35]{index=35}

Advanced topics: [`advanced.md`](./advanced.md).

---
Next page: [`core-concepts.md`](./core-concepts.md)
