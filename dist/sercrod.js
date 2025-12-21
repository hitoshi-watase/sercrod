// Sercrod v0.1.3
//
// Sercrod は Web Components を基盤としたフレームワークです。
// 最大の特徴は「属性を正とする」設計にあります。
//
// Web Components は DOM 属性の変化を捉え、自動的にデータや描画へ反映します。
// つまり「属性 -> データ」の流れは標準でブラウザが保証してくれます。
//
// 一方で Sercrod は「データ -> 属性」の作業を担います。
// 特定の操作に反応し、対応する属性を書き換えます。
// その後は Web Components が処理を引き継ぎます。
// これにより属性を中心とした双方向同期の制御を安定させます。
//
// また、外部ツールやスクリプトから DOM 属性が変更された場合も Sercrod は自然に受け入れます。
// 外部からデータを直接書き換え、それを Sercrod に知らせるのも良いでしょう。
// Sercrod は HTML を正とする直感的で柔軟な開発を可能にします。

class Sercrod extends HTMLElement{

	// Sercrod がサポートする全ディレクティブ
	// - "*" 接頭辞と "n-" 接頭辞を等価に扱い、HTML 上の表記ゆれに寛容
	// - 制御系/モデル・バインディング系/属性バインディング/イベント/ライフサイクルを網羅
	static directives = new Set([
		// 制御系
		"*if",                 "n-if",
		"*elseif",             "n-elseif",
		"*else",               "n-else",
		"*for",                "n-for",
		"*each",               "n-each",
		"*switch",             "n-switch",
		"*case",               "n-case",
		"*break",              "n-break",
		"*case.break",         "n-case.break",
		"*default",            "n-default",
		"*let",                "n-let",
		"*global",             "n-global",
		"*literal",            "n-literal",
		"*rem",                "n-rem",

		// モデル／バインディング系
		"*input",              "n-input",
		"*lazy",               "n-lazy",
		"*eager",              "n-eager",
		"*stage",              "n-stage",
		"*apply",              "n-apply",
		"*restore",            "n-restore",
		"*save",               "n-save",
		"*load",               "n-load",
		"*post",               "n-post",
		"*fetch",              "n-fetch",
		"*print",              "n-print",
		"*compose",            "n-compose",
		"*textContent",        "n-textContent",
		"*innerHTML",          "n-innerHTML",
		"*api",                "n-api",
		"*into",               "n-into",
		"*websocket",          "n-websocket",
		"*ws-send",            "n-ws-send",
		"*ws-to",              "n-ws-to",
		"*upload",             "n-upload",
		"*download",           "n-download",

		// 属性バインディング系
		":class",              "n-class",
		":style",              "n-style",

		// イベント系
		"*prevent-default",    "n-prevent-default",
		"*prevent",            "n-prevent",

		// ライフサイクル／監視系
		"*updated",            "n-updated",
		"*updated-propagate",  "n-updated-propagate",
		"*methods",            "n-methods",
		"*log",                "n-log",
		"*man",                "n-man",

		// include 系統
		"*template",           "n-template",
		"*include",            "n-include",
		"*import",             "n-import",
	]);

	// グローバルフィルタ（デフォルト定義）
	// - 各種プレーンテキスト/HTML/URL/属性/モデル変換のフックポイント
	// - セキュリティ上、html/url/attr での変換責務を外部に委ねられる拡張点
	static _filters = {
		html:       (raw, ctx)=> raw,
		url:        (raw, attr, ctx)=> raw,
		attr:       (name, value, ctx)=> ({name, value}),
		input_out:  (el, raw, ctx)=> raw,
		input_in:   (el, raw, ctx)=> raw,
		style:      (css, ctx)=> css,
		text:	    (raw, ctx)=> String(raw ?? ""),
		placeholder:(raw, ctx)=> raw===null || raw===false ? "" : typeof raw==="object" ? JSON.stringify(raw) : String(raw)
	};

	// *man 用の組み込みショートヘルプ
	// - __index   : *man 自身とキーの書き方の概要
	// - __unknown : 未定義キー用の共通メッセージ
	// - __invalid : プレフィックスが不正な場合のメッセージ
	static _man_short = {
		// 共通・内部
		"__index": {
			short: "Sercrod manual index for directives, events, and bindings.",
			example: "<pre *man></pre>"
		},
		"__directives": {
			short: "Use <pre *man=\"directives\"> to print the list of Sercrod directives into this element.",
			example: "<pre *man=\"directives\"></pre>"
		},
		"__unknown": {
			short: "No *man entry is defined for this key in this version of Sercrod.",
			example: "key: *post, @click, :text"
		},
		"__invalid": {
			short: "Key for *man must start with one of: *, @, :.",
			example: "*man=\"*post\" / *man=\"@click\" / *man=\":text\""
		},

		// * 系ディレクティブ
		"if": {
			short: "conditionally render this element when the expression is truthy.",
			example: "<div *if=\"show\">Visible</div>"
		},
		"elseif": {
			short: "else-if branch paired with a preceding *if or *elseif.",
			example: "<div *elseif=\"mode === 'edit'\">Edit</div>"
		},
		"else": {
			short: "fallback branch for a *if/*elseif group when no condition matched.",
			example: "<div *else>Fallback</div>"
		},
		"for": {
			short: "repeat this element for each item in a list.",
			example: "<li *for=\"item in items\">%item%</li>"
		},
		"each": {
			short: "repeat this element for each entry in a map (value, key).",
			example: "<li *each=\"value, key in map\">%key%: %value%</li>"
		},
		"switch": {
			short: "select one branch from *case/*default based on an expression.",
			example: "<div *switch=\"status\">...</div>"
		},
		"case": {
			short: "render this branch when the *switch expression equals the case value.",
			example: "<p *case=\"'ready'\">Ready</p>"
		},
		"case.break": {
			short: "like *case, and stop evaluating later *case branches.",
			example: "<p *case.break=\"'ready'\">Ready</p>"
		},
		"break": {
			short: "stop processing the current *for/*each loop when the expression is truthy.",
			example: "<div *break=\"index > 10\"></div>"
		},
		"default": {
			short: "fallback branch for *switch when no *case matched.",
			example: "<p *default>Default</p>"
		},
		"let": {
			short: "define local variables available to expressions inside this element.",
			example: "<div *let=\"total = price * qty\">%total%</div>"
		},
		"global": {
			short: "write variables into the global Sercrod data scope.",
			example: "<div *global=\"appTitle = 'Sercrod'\"></div>"
		},
		"literal": {
			short: "treat the inner content as a literal string, without Sercrod expansion.",
			example: "<pre *literal>%raw_markdown%</pre>"
		},
		"rem": {
			short: "remove this element from the rendered output; use as a Sercrod-only comment.",
			example: "<div *rem>debug-only block</div>"
		},
		"input": {
			short: "bind a form control value to a data path.",
			example: "<input type=\"text\" *input=\"form.name\">"
		},
		"lazy": {
			short: "update bound data on a later event instead of every input.",
			example: "<input *input=\"form.name\" *lazy>"
		},
		"eager": {
			short: "update bound data eagerly, typically on each input event.",
			example: "<input *input=\"form.name\" *eager>"
		},
		"stage": {
			short: "work with a staged copy of host data for editing before applying.",
			example: "<form *stage=\"draft\">...</form>"
		},
		"apply": {
			short: "apply staged changes from the stage back to the host data.",
			example: "<button *apply>Apply</button>"
		},
		"restore": {
			short: "discard staged changes and restore host data from the last stable state.",
			example: "<button *restore>Reset</button>"
		},
		"save": {
			short: "save host data or a staged view through a configured storage mechanism.",
			example: "<button *save>Save</button>"
		},
		"load": {
			short: "load data from storage into host data.",
			example: "<button *load>Load</button>"
		},
		"post": {
			short: "send host data as JSON via POST and write the JSON response back into host data.",
			example: "<button type=\"button\" *post=\"/api/contact.php:result\">Send</button>"
		},
		"fetch": {
			short: "fetch JSON from a URL and merge or replace it into host data.",
			example: "<div *fetch=\"/api/items.json:items\"></div>"
		},
		"print": {
			short: "print the result of an expression into the element as plain text.",
			example: "<span *print=\"user.name\"></span>"
		},
		"compose": {
			short: "set this element's innerHTML from an expression via the html filter.",
			example: "<div *compose=\"layouts.card\"></div>"
		},
		"textContent": {
			short: "set the DOM textContent property from an expression.",
			example: "<div *textContent=\"message\"></div>"
		},
		"innerHTML": {
			short: "set the DOM innerHTML property from an expression.",
			example: "<div *innerHTML=\"html\"></div>"
		},
		"api": {
			short: "configure an API base URL or options for nested *fetch/*post directives.",
			example: "<section *api=\"'/api'\">...</section>"
		},
		"into": {
			short: "direct the result of the previous directive into a specific data path.",
			example: "<div *fetch=\"/api/user.json\" *into=\"user\"></div>"
		},
		"websocket": {
			short: "open and manage a WebSocket connection for this host.",
			example: "<div *websocket=\"wsUrl\"></div>"
		},
		"ws-send": {
			short: "send a message through the active WebSocket connection.",
			example: "<button *ws-send=\"message\">Send</button>"
		},
		"ws-to": {
			short: "select which WebSocket URL *ws-send should use when multiple connections are open.",
			example: "<button *ws-send=\"msg\" *ws-to=\"%notifyUrl%\">Notify</button>"
		},
		"upload": {
			short: "upload selected files or data to a server endpoint.",
			example: "<input type=\"file\" *upload=\"'/api/upload'\">"
		},
		"download": {
			short: "trigger a download of data from a server endpoint.",
			example: "<button *download=\"'/api/report.csv'\">Download</button>"
		},
		"prevent-default": {
			short: "call event.preventDefault() for the current event.",
			example: "<a href=\"/\" *prevent-default @click=\"submit()\">Submit</a>"
		},
		"prevent": {
			short: "short form of *prevent-default for the current event.",
			example: "<form *prevent @submit=\"save()\">...</form>"
		},
		"updated": {
			short: "call a handler after this host has been updated.",
			example: "<div *updated=\"onUpdated\"></div>"
		},
		"updated-propagate": {
			short: "like *updated, and propagate the update event to parents.",
			example: "<div *updated-propagate=\"onUpdated\"></div>"
		},
		"methods": {
			short: "define methods that can be called from expressions in this host.",
			example: "<script type=\"application/sercrod-methods\" *methods>...</script>"
		},
		"log": {
			short: "evaluate an expression and log its value, expression, and host snippet.",
			example: "<pre *log=\"data\"></pre>"
		},
		"template": {
			short: "mark this subtree as a reusable template.",
			example: "<template *template=\"card\">...</template>"
		},
		"include": {
			short: "include and render a template or partial into this place.",
			example: "<div *include=\"card\"></div>"
		},
		"import": {
			short: "import a template or partial from another file or module.",
			example: "<div *import=\"'/partials/card.html:card'\"></div>"
		},

		// @ 系（イベントブリッジ）
		"@click": {
			short: "@click: evaluate an expression when a click event fires on this element.",
			example: "<button @click=\"doSomething($event)\">Click</button>"
		},
		"@input": {
			short: "@input: evaluate an expression when an input event fires on this form control.",
			example: "<input @input=\"onInput($event)\">"
		},
		"@change": {
			short: "@change: evaluate an expression when a change event fires.",
			example: "<select @change=\"onChange($event)\"></select>"
		},
		"@submit": {
			short: "@submit: evaluate an expression when a submit event fires.",
			example: "<form @submit=\"onSubmit($event)\">...</form>"
		},
		"@keydown": {
			short: "@keydown: evaluate an expression when a keydown event fires.",
			example: "<input @keydown=\"onKey($event)\">"
		},
		"@keyup": {
			short: "@keyup: evaluate an expression when a keyup event fires.",
			example: "<input @keyup=\"onKey($event)\">"
		},
		"@focus": {
			short: "@focus: evaluate an expression when a focus event fires.",
			example: "<input @focus=\"onFocus($event)\">"
		},
		"@blur": {
			short: "@blur: evaluate an expression when a blur event fires.",
			example: "<input @blur=\"onBlur($event)\">"
		},

		// : 系（属性バインディング - 狙い撃ち分）
		":text": {
			short: ":text: bind the expression result to the element's text content.",
			example: "<span :text=\"user.name\"></span>"
		},
		":html": {
			short: ":html: bind the expression result to innerHTML; the string is inserted as HTML.",
			example: "<div :html=\"html\"></div>"
		},
		":class": {
			short: ":class: compute the class attribute from a string, array, or object.",
			example: "<div :class=\"classList\"></div>"
		},
		":style": {
			short: ":style: compute the style attribute or style properties from an expression.",
			example: "<div :style=\"styleText\"></div>"
		},
		":value": {
			short: ":value: bind the value property and value attribute of a form control.",
			example: "<input type=\"text\" :value=\"form.name\">"
		},
		":href": {
			short: ":href: bind the href attribute of a link or resource element.",
			example: "<a :href=\"url\">Link</a>"
		},
		":src": {
			short: ":src: bind the src attribute of an image, script, or media element.",
			example: "<img :src=\"imageUrl\" alt=\"\">"
		},
		":action": {
			short: ":action: bind the action attribute of a form.",
			example: "<form :action=\"endpoint\"></form>"
		},
		":formaction": {
			short: ":formaction: bind the formaction attribute of a submit button.",
			example: "<button type=\"submit\" :formaction=\"endpoint\">Submit</button>"
		},
		":xlink:href": {
			short: ":xlink:href: bind the xlink:href attribute of an SVG element.",
			example: "<use :xlink:href=\"iconRef\"></use>"
		}
	};

	// __index 用のフルテキスト（man.json が無くても常に利用可能）
	static _man_full_index = `### *man

*man is a built-in manual system for Sercrod. It prints short descriptions to the console, and when used on a <pre> element it can show longer text blocks.

The implementation inside Sercrod keeps a very small set of short texts, and can optionally load longer texts from man.json. Projects that do not use *man stay small, while people who need detailed docs can opt in.

#### Usage

Basic usage:

    <pre *man></pre>
    <pre *man="directives"></pre>
    <pre *man="'*post'"></pre>
    <pre *man="current_key"></pre>
    <p *man="@click"></p>
    <span *man=":style"></span>

- On a <pre> element:
  - *man without a value prints the top-level index or overview for the Sercrod manual.
  - *man="directives" prints the list of core directives into the <pre> by using the built-in _man_directives text.
  - *man="expr" first evaluates expr as a Sercrod expression in the current scope.
    If the result is a non-empty string (or a number or true), that value is used as the key.
    Otherwise the source text of expr itself is used as the key.
    The matching manual entry is then printed into the <pre>.

- On any other element:
  - *man="expr" resolves the key in the same way as above.
  - If a matching short entry exists, *man writes a short description (and sometimes an example) to the JavaScript console.
    It does not modify the DOM content of the element.
  - When *man="directives" is used on a non-<pre> element, the element itself stays unchanged and a console message explains that you can use
    <pre *man="directives"> to print the full directives list into the page.

#### Keys

Keys must always include a prefix when they refer to a concrete feature:

- "*" for Sercrod directives (for example *post, *fetch, *if)
- "@" for event bindings (for example @click, @submit)
- ":" for attribute bindings (for example :text, :html, :class)

The same manual entry is used for both *xxx and n-xxx forms. For example, *print and n-print share one entry.

In addition to these, *man understands some special keys:

- __index      - internal key used for the top-level index text (the default when no value is given)
- __directives - internal key used for the built-in directives list behind *man="directives"
- __unknown    - used when a key has no manual entry
- __invalid    - used when a key string is not valid for *man

Normal projects do not need to use these internal keys directly.

#### Output modes

On non-<pre> elements:

- *man never changes the DOM.
- It prints one short line (summary) and one short line (example) to the console.
- The log is prefixed so that you can search for it easily.

Example console output:

  [Sercrod man] *print
  print the result of an expression into the element as plain text.
  Example: <span *print="user.name"></span>

On <pre> elements:

- *man tries to load a full manual text for the given key.
- If man.json is available and has a matching entry, that text is used.
- If not, *man falls back to a short summary and explains how to enable full manuals.

The text is written to textContent so that any < and > characters are shown as-is, without being interpreted as HTML.

#### man.json and external manuals

Sercrod can load long manual texts from a JSON file.

- Sercrod.load_man(url) is used to load man.json at runtime.
- Each key in man.json corresponds to one *man key (without the prefix star).
  Example: "print": "### *print\n..."

When man.json is present:

- *man on a <pre> prefers the external text.
- Short texts built into Sercrod remain available and are still used for console output.

When man.json is missing:

- *man still works with short texts.
- <pre *man="*post"></pre> shows a short summary and a note that full manuals are not loaded.

This design keeps Sercrod core small while allowing projects to ship rich manuals when needed.

#### Examples

Show the index entry in a <pre>:

  <pre *man></pre>

Show the manual entry for a directive:

  <pre *man="*post"></pre>

Ask about an event:

  <p *man="@click"></p>

Ask about an attribute binding:

  <span *man=":style"></span>

Attach *man to the same element you are using:

  <button *post="/api/contact.php:result" *man="*post">
    Send
  </button>

In this pattern, *man documents the exact directive that is used on the button.

#### Notes

- *man does not change data or DOM bindings; it is only for documentation and debugging.
- Short texts shipped inside Sercrod are intentionally small and safe to load in any environment.
- Long texts live outside Sercrod (for example in man/*.md) and are bundled into man.json by a build script.
- When in doubt, the behavior described by *man is considered the closest description of the current Sercrod runtime.
`;

	static _man_directives = `### Sercrod directives

## Basic directives

- *let: define local variables available to expressions inside this element.
- *print: print the result of an expression into the element as plain text.
- *input: bind a form control value to a data path.
- *if: conditionally render this element when the expression is truthy.
- *else: fallback branch for a *if/*elseif group when no condition matched.
- *for: repeat this element for each item in a list.
- *save: save host data or a staged view through a configured storage mechanism.
- *load: load data from storage into host data.
- *rem: remove this element from the rendered output; use as a Sercrod-only comment.

## Extended directives

- *compose: compose this element from another template, partial, or host.
- *each: repeat this element for each entry in a map (value, key).
- *stage: work with a staged copy of host data for editing before applying.
- *apply: apply staged changes from the stage back to the host data.
- *restore: discard staged changes and restore host data from the last stable state.
- *upload: upload selected files or data to a server endpoint.
- *download: trigger a download of data from a server endpoint.

## All directives

- *if: conditionally render this element when the expression is truthy.
- *elseif: else-if branch paired with a preceding *if or *elseif.
- *else: fallback branch for a *if/*elseif group when no condition matched.
- *for: repeat this element for each item in a list.
- *each: repeat this element for each entry in a map (value, key).
- *switch: select one branch from *case/*default based on an expression.
- *case: render this branch when the *switch expression equals the case value.
- *case.break: like *case, and stop evaluating later *case branches.
- *break: stop processing the current *for/*each loop when the expression is truthy.
- *default: fallback branch for *switch when no *case matched.

- *let: define local variables available to expressions inside this element.
- *global: write variables into the global Sercrod data scope.
- *literal: treat the inner content as a literal string, without Sercrod expansion.
- *rem: remove this element from the rendered output; use as a Sercrod-only comment.

- *input: bind a form control value to a data path.
- *lazy: update bound data on a later event instead of every input.
- *eager: update bound data eagerly, typically on each input event.

- *stage: work with a staged copy of host data for editing before applying.
- *apply: apply staged changes from the stage back to the host data.
- *restore: discard staged changes and restore host data from the last stable state.
- *save: save host data or a staged view through a configured storage mechanism.
- *load: load data from storage into host data.

- *post: send host data as JSON via POST and write the JSON response back into host data.
- *fetch: fetch JSON from a URL and merge or replace it into host data.

- *print: print the result of an expression into the element as plain text.
- *compose: compose this element from another template, partial, or host.
- *textContent: set the DOM textContent property from an expression.
- *innerHTML: set the DOM innerHTML property from an expression.

- *api: configure an API base URL or options for nested *fetch/*post directives.
- *into: direct the result of the previous directive into a specific data path.

- *websocket: open and manage a WebSocket connection for this host.
- *ws-send: send a message through the active WebSocket connection.
- *ws-to: set the logical target for outgoing WebSocket messages on this host.

- *upload: upload selected files or data to a server endpoint.
- *download: trigger a download of data from a server endpoint.

- *prevent-default: call event.preventDefault() for the current event.
- *prevent: short form of *prevent-default for the current event.

- *updated: call a handler after this host has been updated.
- *updated-propagate: like *updated, and propagate the update event to parents.

- *methods: define methods that can be called from expressions in this host.
- *log: evaluate an expression and log its value, expression, and host snippet.

- *template: mark this subtree as a reusable template.
- *include: include and render a template or partial into this place.
- *import: import a template or partial from another file or module.
`;
	// フルマニュアル（man.json などから差し込む想定）
	// - キー: "*post", "@click", ":text" など
	// - 値 : 1 つの長いテキスト（<pre *man> で textContent として流し込む）
	// man.json から読み込むフルテキスト
	static _man_full = null;
	static _man_full_loaded = false;
	static _man_full_load_attempted = false; // 何度も読み込みに行かないためのフラグ
	static _man_url = null;                  // 必要なら外側から上書きできる URL（デフォルトは sercrod.js と同じディレクトリの man.json）

	// ----------------------------------------
	// man.json 自動ロード
	// ----------------------------------------
	static _ensure_man_loaded(){
		// 一度でも試したら二度目以降は何もしない
		this._man_full_load_attempted = true;

		// ブラウザ環境以外（Nodeのみなど）は何もしない
		if(typeof window==="undefined" || typeof document==="undefined" || typeof XMLHttpRequest==="undefined"){
			return;
		}

		let url = this._man_url;  // 外部から上書きされていればそれを優先

		try{
			// URL が指定されていなければ、sercrod.js の場所から推測
			if(!url){
				let script_src = null;
				const scripts = document.getElementsByTagName("script");
				// 後ろから走査して、できれば sercrod.js を探す
				for(let i=scripts.length-1;i>=0;i--){
					const s = scripts[i];
					if(!s.src) continue;
					const name = s.src.split("/").pop();
					if(name==="sercrod.js"){
						script_src = s.src;
						break;
					}
					// sercrod.js が見つからなければ、最後に出てきた src 付き script を候補にする
					if(!script_src){
						script_src = s.src;
					}
				}
				if(script_src){
					const m = script_src.match(/^(.*\/)[^\/]*$/);
					const dir = m ? m[1] : "";
					// デフォルト: sercrod.js と同じディレクトリに man.json がある想定
					url = dir + "man.json";
				}
			}

			if(!url) return;

			const req = new XMLHttpRequest();
			req.open("GET", url, false); // 開発用: 同期ロード（*man はデバッグ用途なので許容）
			req.overrideMimeType("application/json");
			req.send(null);

			if(req.status>=200 && req.status<300){
				const obj = JSON.parse(req.responseText);
				if(obj && typeof obj==="object"){
					this._man_full = obj;
					this._man_full_loaded = true;
					if(typeof console!=="undefined" && console.log){
						console.log("[Sercrod man] loaded", url);
					}
				}
			}else{
				if(typeof console!=="undefined" && console.warn){
					console.warn("[Sercrod man] HTTP error", url, req.status);
				}
			}
		}catch(e){
			if(typeof console!=="undefined" && console.warn){
				console.warn("[Sercrod man] load failed", e);
			}
		}
	}

	// -----------------------------
	//  AST Hooks / AST Extraction
	// -----------------------------
	//
	// Sercrod は「HTML を正」とする設計のため、
	// そのテンプレート自体を AST（構文木）として扱うことができます。
	// ここでいう AST は、通常の JavaScript の AST ではなく、
	// HTML / DOM 構造をオブジェクト化した軽量なツリー表現を指します。
	//
	// Sercrod._ast_hooks に関数を登録しておくことで、
	// `_renderTemplate()` のパース直後に AST が外部に提供されます。
	// これにより、React/Vue/Svelte 等の統合、静的解析、
	// メタビルド、リアルタイム編集支援などが可能になります。
	static _ast_hooks = [];   // AST処理用のフック配列（関数群）
	//static _ast_cache = new WeakMap();
	static _ast_cache = new Map(); // テンプレート->AST のキャッシュ（再解析防止）

	// ASTノードIDの採番と、ノード形状キャッシュ
	static _nextId = 1;                      // 安定ID（インクリメンタルや部分キャッシュ向け）
	static _node_cache = new Map();          // id -> { hash, frag }（構造用）

	// 外部フック登録ヘルパ
	// - Sercrod.register_ast_hook(fn)
	// - fn は (ast, host) を受け取る
	static _pre_hooks = [];   // 文字列/DOM向けプリフック（DOMミューテート推奨）
	static register_ast_hook(fn){
		if(typeof fn==="function") Sercrod._ast_hooks.push(fn);
	}

	static _config = {
		// デリミタを定義
		delimiters : window.__Sercrod?.config?.delimiters || {start:"%", end:"%"},
		include : {
			warn_on_element : window.__Sercrod?.config?.include?.warn_on_element ?? true,
			remove_element_if_empty : window.__Sercrod?.config?.include?.remove_element_if_empty || false,
			max_depth : window.__Sercrod?.config?.include?.max_depth || 16, // 既定最大層
			terminator : null
		},
		// 展開後 DOM の掃除に関する設定
		cleanup : {
			// デフォルトは「何もしない」（null）
			// true を明示的に指定したときだけ掃除する
			directives : window.__Sercrod?.config?.cleanup?.directives ?? null,

			// こちらも同様。既定は何もしない
			handlers : window.__Sercrod?.config?.cleanup?.handlers ?? null,

			terminator : null
		},
		// イベント関連設定
		events : {
			// イベント属性の接頭辞
			// 例）"@" → @click, "ne-" → ne-click
			prefix : window.__Sercrod?.config?.events?.prefix || "@",

			// 非更新イベント
			// 旧キーとの互換を取りたければ || window.__Sercrod?.config?.non_mutating_events などを足す
			non_mutating : window.__Sercrod?.config?.events?.non_mutating
			|| [
				"mouseover","mouseenter","mousemove","mouseout","mouseleave","mousedown",
				"pointerover","pointerenter","pointermove","pointerout","pointerleave","pointerrawupdate","pointerdown",
				"wheel","scroll","touchmove","touchstart",
				"dragstart","drag","dragenter","dragover","dragleave","dragend", // drop は入れない
				"resize","timeupdate",
				"selectionchange"
			],
			terminator : null
		},
		// web socket 関連
		websocket : {
			// 再接続を許可するか
			internal_update : window.__Sercrod?.config?.websocket?.internal_update ?? false,
		},
		terminator : null
	}

	// DOMノードを再帰的にAST化するユーティリティ
	// - nodeName, attributes, children の3要素で構成
	// - テキストノードも text プロパティで保持
	static _extract_ast(node){
		if(node.nodeType === Node.TEXT_NODE){
			return { type:"text", text: node.textContent };
		}
		// コメントノードも保持
		if(node.nodeType === Node.COMMENT_NODE){
			return { type:"comment", text: node.nodeValue || "" , _id: Sercrod._nextId++ };
		}
		if(node.nodeType === Node.TEXT_NODE){
			return { type:"text", text: node.textContent, _id: Sercrod._nextId++ };
		}

		if(node.nodeType !== Node.ELEMENT_NODE) return null;

		const ast = {
			type: "element",
			tag:  node.tagName.toLowerCase(),
			//attrs: {},
			//children: []
			// 属性は配列で順序・重複を保持（将来quote種別やrawも拡張しやすい）
			attrs: [],
			children: [],
			_id: Sercrod._nextId++      // ID で安定させる
		};

		// 属性をコピー（HTML構造保持）
		for(const a of Array.from(node.attributes)){
			ast.attrs[a.name] = a.value;
		}

		// 子ノードを再帰的に解析
		for(const c of Array.from(node.childNodes)){
			const sub = Sercrod._extract_ast(c);
			if(sub) ast.children.push(sub);
		}
		return ast;
	}
	// -----------------------------
	//  static 初期化ブロック
	// -----------------------------
	//
	// クラス読み込み時に一度だけ走る初期設定。
	// - static 初期化ブロック：クラス定義読み込み時に一度だけ評価
	// - filter は事前登録のみ（実行時に差し替え不可：安全側）
	// - methods は実行時追加も許す（利便性優先）
	static {
		// 起動前に window.__Sercrod_filter / __Sercrod_methods をマージ
		// セキュリティーの関連から、filter は完全に事前登録制にしておく（あとから追加は不可）
		const extFilters = window.__Sercrod_filter || {};
		Sercrod._filters = { ...Sercrod._filters, ...extFilters };

		// window.__Sercrod_ast_hooks に関数があれば自動登録。
		// これにより、外部スクリプトが Sercrod 読み込み前にASTフックを事前宣言できる。
		const extAstHooks = window.__Sercrod_ast_hooks || [];
		if(Array.isArray(extAstHooks)) for(const fn of extAstHooks) if(typeof fn==="function") Sercrod._ast_hooks.push(fn);

		// ほかの static 初期化と同じく、拡張性を確保
		// 例: _filters, _internal_methods などと同列
		console.info("[Sercrod] AST subsystem initialized:", Sercrod._ast_hooks.length, "hook(s) registered");
		// 追加: 外部定義プリフック取り込み
		const extPreHooks = window.__Sercrod_pre_hooks || [];
		if(Array.isArray(extPreHooks)) for(const fn of extPreHooks) if(typeof fn==="function") Sercrod._pre_hooks.push(fn);

		// メソッドは、こちらだけでなく、あとから気軽に追加可能
		const extMethods = window.__Sercrod_methods || {};
		Sercrod._internal_methods = { ...extMethods };
		// 事前定義
		// window.__Sercrod_methods = {
		// 	a: () => {console.log(this, "this")},
		// 	b: (a, cb) => {
		// 		"use strict";
		// 		a++;
		// 		console.log(a,"a");
		// 		if (typeof cb === "function") cb(a);	// コールバックで内部変数を書き換える
		// 	}
		// }
		// Sercrod 起動
		// 事後定義
		// Sercrod._internal_methods.c = (d) => {console.log(d);};
	}

	// Proxy/生オブジェクト対応表
	// - _proxy_map: Proxy -> raw（Proxy をキーにするので Proxy が GC されればエントリも回収）
	// - _raw_to_proxy_map: raw -> proxy（raw をキーに「すでにラップ済みか」を判定、二重ラップ防止）
	static _proxy_map = new WeakMap();  // Proxy と raw の対応表。Proxy がキーとなる（ガベージコレクション対応）
	static _raw_to_proxy_map = new WeakMap();	// raw がすでにプロキシー化されているかの表。raw がキーとなる（プロキシーに結びついているわけではない。たんなるフラグ）

	constructor(){
		super();

		const ctor = this.constructor;
		if(!ctor._filters) ctor._filters = {...Sercrod._filters};
		if(!ctor._ast_hooks) ctor._ast_hooks = [...Sercrod._ast_hooks];
		if(!ctor._ast_cache) ctor._ast_cache = new Map();
		if(!ctor._parser) ctor._parser = Sercrod._parser;

		// ループ/再入対策
		// - _updating: update の再入を防止（親子の相互再帰で無限ループを防ぐ）
		// - _update_depth: 将来的な深さ制御用（現在はカウンタ用途が主）
		this._update_depth = 0;     // 呼び出し“深さ”のガード
		this._updating = false;     // 再入防止ロック

		// 永久ループ防止の上限値（外部から変更可）
		// - 大規模テンプレートや誤った *updated 連鎖で暴走しないようにする最終防衛ライン
		this.loop_limit = 100;

		// ログ出力の有効/無効
		this.log = true;
		// 警告・デバッグレベルの制御
		this.error = {
			fatal: true,
			warn: true,
			debug: true
		}

		// 現在の実データ（バインディングのソース）
		// - 直接代入される可能性があるため、setter 側で Proxy 化を強制
		this._data = {};
		// フラグ逆引きインデックス（インスタンス単位）
		// - 各ノードに付いた *xxx/@xxx/:xxx を Set で収集し、高速参照を可能にする
		this._flag_index = Object.create(null);
		// 差分用スナップショットと直近差分の保持
		this._snapshot = null;
		this._differences = {};

		// *template レジストリ（この Sercrod インスタンス＝world 単位）
		// name(string) -> Node（原本の deep clone 保持）
		this._template_registry = new Map();
		// 原本の可視属性スナップショット（差し込み時の復元用）
		// key: 登録した原本ノード（clone）
		this._template_attr_snapshot = new WeakMap();
		// include系の層（入れ子段数）管理: Node -> depth
		this._include_depth_map = new WeakMap();
		this._include_max_depth = this.constructor._config.include.max_depth; // 既定最大層

		// web socket の再接続を許可するか
		this._ws_internal_update = this.constructor._config.websocket.internal_update;

		// 観測モード
		// - off: 差分は finalize 時の全体比較のみ（軽量だが即時検知なし）
		// - observed: observe 登録された枝だけ即時ラップして監視（デフォルト）
		// - all: データ全体を即時監視（コスト高・デバッグ向き）
		// - UI 入力中の振る舞いとトレードオフ、用途にあわせて切替可能
		this._observe_mode = "observed";	// "off" | "observed" | "all"

		// 監視登録テーブル: raw -> (true | Set(keys))
		// - true は当該 raw 配下の全キー監視
		// - Set は当該 raw の特定キーのみ監視
		this._observed = new WeakMap();

		// rAF による再描画の集約管理
		this._update_scheduled = false;   // rAF予約フラグ
		this._needs_post_update = false;  // 描画中に入った更新の持ち越しフラグ
		//this._data = this._wrap_data(this._data);   // これを追加
		// *stage 用の作業バッファ（確定までこちらを表示に使う）
		// - 「編集中は stage、保存で data に反映」といった二相モデルを支援
		this._stage = null;

		// 初回 innerHTML をテンプレートとして保持（差分描画はせず丸ごと再描画方式）
		// - ランタイムは常にテンプレートから再構築、DOM 差分パッチは行わないシンプル設計
		this._template = "";

		// *updated / *methods で宣言された関数名リスト（ホスト単位）
		this._updated_names = [];
		this._methods_names = [];

		// *api の「一度だけ自動発火」を要素単位で抑制するためのメモ
		this.__apiOnce = this.__apiOnce || new Set();

		// *fetch の「一度だけ自動発火」を要素単位で抑制するためのメモ
		this.__fetchOnce = this.__fetchOnce || new Set();

		// into の名称格納
		this._intos = [];

		//// head 用ノードを覚えておくリスト
		//this._head_nodes = [];

		// DOMParser は高コストなので静的に 1 回だけ生成
		// - 文字列テンプレートを Document にパースするための共有インスタンス
		if(!Sercrod._parser) Sercrod._parser = new DOMParser();

		// 差分表現に用いるシンボルキー（ユーザランドに露出しない安全なキー）
		this.OLD = Symbol("old");
		this.NEW = Symbol("new");
	}
	// --- WebSocket 失敗時に、このインスタンスの AST キャッシュを無効化して次回 update で再評価させる ---
	_invalidate_ast_cache_for_next_update(){
		try{
			// Sercrod 全体の AST キャッシュから、このホストのテンプレートを削除
			if(Sercrod && Sercrod._ast_cache && this._template){
				Sercrod._ast_cache.delete(this._template);
			}
		}catch(_){}
	}

	// 監視する属性を拡張【新しい DOM が追加された場合も、updated や methods が効くように】（data / *updated | n-updated / *methods | n-methods）
	// - Custom Elements の標準 API：属性変更時に attributeChangedCallback が呼ばれる
	// - data は JSON を想定、updated/methods はスペース区切りの識別子群
	static get observedAttributes(){ return ["data","*updated","*methods","n-updated","n-methods"]; }

	// data プロパティ（外部から直接オブジェクトを渡す用途もサポート）
	// - 外部コードが this.data = {...} とした場合に必ず Proxy 化して一貫性を保持
	// - 既に Sercrod が包んだ Proxy の場合は二重ラップを避ける
	get data(){ return this._data; }
	set data(v){
		//this._data = v;
		// 必ず Proxy 化する（二重 Proxy を防ぐチェック）
		//this._data = v instanceof Proxy ? v : this._wrap_data(v);
		// 既に Sercrod が包んだ Proxy ならそのまま、そうでなければ包む
		this._data = this.constructor._proxy_map.has(v) ? v : this._wrap_data(v);
		// lazy を尊重しつつ自分を更新
		// - true/false の意味: update(force) の既定を使い分け、*lazy 指定時の親再描画を抑制
		this.update(false);
		// 子 Sercrod は（親の変更を）軽量に反映
		this._updateChildren(false, this);
	}

	// 属性変化の監視（*updated / *methods / n-updated / n-methods に対応）
	// DOM 属性の値の変更	-> 変数の値が変わる
	// 変数の値の変更	-> DOM属性の値は変わらない
	// - 「HTML が正」の原則：属性はコードの入力面、データ->属性は Sercrod が担当
	attributeChangedCallback(name, oldVal, newVal){
		if(oldVal===newVal) return;
		if(name==="data"){
			// data 属性（JSON）を安全にパースして _data を刷新
			this._parse_data_attr();
			this.update(false);
		}
		// "*updated"/"n-updated" は関数/式名の配列に分割して保持
		if(name==="*updated" || name==="n-updated") this._updated_names = (newVal||"").trim().split(/\s+/).filter(Boolean);
		// "*methods"/"n-methods" はスコープ混入対象の関数群（名前 or オブジェクト）を保持
		if(name==="*methods" || name==="n-methods") this._methods_names = (newVal||"").trim().split(/\s+/).filter(Boolean);
	}

	// DOM に接続されたときの初期化
	// - 親 Sercrod のロード待機（親が _loading 中なら自分は描画保留）
	// - 親スコープの継承（子 Sercrod は __sercrod_scope から data を受け取る）
	// - *stage の初期化（編集バッファを data から複製）
	// - *fetch 属性があれば fetch -> json -> data 反映の非同期初期化
//	connectedCallback(){
//
//		// 先に data の proxy 化を完了させる（for 展開の空撃ち防止）
//		this._parse_data_attr();
//		// 親がロード中なら、自分は待機（ついでに、親 let の内容を 子に継承）
//		if(this.parentElement){
//			const parent = this.parentElement.closest("serc-rod");
//			// ---  親 _data を prototype に継承 ---
//			if(parent && parent._data){
//				const proto = Object.getPrototypeOf(this._data);
//				if(!proto || proto === Object.prototype){
//					this._data = Object.create(parent._data);
//				}
//			}
//			if(parent && parent._loading){
//				return; // 親のロード完了後にまとめて update される
//			}
//		}
//
//		// 親 Sercrod からスコープを引き継ぐ（子 Sercrod の仕組み）
//		//if(this.__sercrod_scope) this._data = this.__sercrod_scope;
//		if(this.__sercrod_scope) this._data = this.constructor._proxy_map.has(this.__sercrod_scope) ? this.__sercrod_scope : this._wrap_data(this.__sercrod_scope);  // 置換
//
//		// ルート判定: 祖先の Sercrod をたどり、最外層を $root として保持
//		// - 子孫からも $root._data へアクセスできるようにする（eval_expr で注入）
//		let p = this.parentNode;
//		while(p){
//			if(p instanceof Sercrod){
//				// 親の root を継承
//				this._root = p._root;
//
//				// 親の *methods を継承
//				if(p._methods_names) this._methods_names = [ ...(p._methods_names || []), ...(this._methods_names || []) ];
//
//				break;
//			}
//			p = p.parentNode;
//		}
//		// 自分が root
//		if(!this._root) this._root = this;
//
//		// 初回のみテンプレート確定
//		// - connectedCallback は複数回呼ばれ得るため、初回だけ innerHTML を採取
//		if(!this._template) this._template = this.innerHTML.trim();
//
//		// *stage の初期化（バッファ＝表示用のコピー）
//		// - structuredClone が使えない環境では JSON 経由にフォールバック
//		if((this.hasAttribute("*stage") || this.hasAttribute("n-stage")) && this._stage===null){
//			try{ this._stage = structuredClone(this._data); }
//			catch(e){ this._stage = JSON.parse(JSON.stringify(this._data)); }
//		}
//
//		// 【注意】この処理は必ず connectedCallback の末尾で実行すること
//		//// *fetch / n-fetch を処理する ---
//		//// 初回描画
//		//this.update();
//		// *fetch / n-fetch があれば -> _do_load 内で update するのでここでは何もしない
//		if(this.hasAttribute("*fetch") || this.hasAttribute("n-fetch")){
//			// 初期ロード中フラグを立て、エラーの冗長警告を抑制
//			this._loading = true;
//			const spec = this.getAttribute("*fetch") ?? this.getAttribute("n-fetch") ?? "";
//			const error = structuredClone(this.error);
//			this.error.warn = false;
//			this._do_load(spec);
//			this.error = error;
//		}else{
//			// 通常ケース -> すぐ初回描画
//			this.update();
//		}
//	}
	connectedCallback(){

		// --- WebSocket 用の最小初期化（未定義警告の抑止を含む） ---
		this.__wsOnce  = this.__wsOnce  || new Set();
		this._ws_map   = this._ws_map   || new Map();   // url -> { ws, into, el }
		this._intos    = this._intos    || [];          // into 名の記録（後でヌルクリア等に利用）
		this._ensure_ws_state();                        // 早めに初期化（未定義警告の予防）

		// ホスト要素公開用 WebSocket コントローラ（軽量）
		// - 外部から el.websocket.connect()/reconnect()/close()/send()/status()/urls() を叩ける
		// - 非列挙・再定義可（再初期化時に上書き可能）
		if(!this.websocket){
			const self = this;
			const ctl = {
				get last_url(){ return self._ws_last_url || ""; },
				get last_into(){ return self._ws_last_into || ""; },
				urls(){ return Array.from(self._ws_map.keys()); },
				status(url){
					let h=null; if(url) h=self._ws_map.get(url); else { const it=self._ws_map.values().next(); h=it && it.value || null; }
					const rs = h && h.ws ? h.ws.readyState : -1;
					const ready = rs===WebSocket.OPEN;
					return { ready, state: rs, error: (self._data && self._data.$ws_error) || null, count: (self._data && self._data.$ws_messages && self._data.$ws_messages.length) || 0 };
				},
				connect(url, into){ const u=url || self._ws_last_url; const i=(into!==undefined?into:self._ws_last_into)||""; if(!u) return false; return !!self._ws_connect(u, i, self); },
				reconnect(){ if(!self._ws_last_url) return false; return !!self._ws_connect(self._ws_last_url, self._ws_last_into || "", self); },
				close(url){ let ok=false; if(url){ const h=self._ws_map.get(url); if(h&&h.ws){ try{h.ws.close(); ok=true;}catch(_){}} } else { for(const h of self._ws_map.values()){ try{h.ws.close(); ok=true;}catch(_){} } } return ok; },
				send(payload, toUrl){ return self._ws_send(toUrl||"", payload); }
			};
			Object.defineProperty(this, "websocket", { value: ctl, enumerable: false, configurable: true });
		}

		// 初回の重い初期化はパース競合を避けるために次タスクへ送る
		if (this._initDone) return;
		const start = ()=>{
			if (this._initDone) return;
			this._initDone = true;

			this._parse_data_attr();
			if(this.parentElement){
				const parent = this.parentElement.closest("serc-rod");
				if(parent && parent._data){
					const proto = Object.getPrototypeOf(this._data);
					if(!proto || proto === Object.prototype){
						this._data = Object.create(parent._data);
					}
				}
				if(parent && parent._loading){
					return; // 親のロード完了後にまとめて update される
				}
			}
			if(this.__sercrod_scope) this._data = this.constructor._proxy_map.has(this.__sercrod_scope) ? this.__sercrod_scope : this._wrap_data(this.__sercrod_scope);  // 置換
			let p = this.parentNode;
			while(p){
				if(p instanceof Sercrod){
					this._root = p._root;
					if(p._methods_names) this._methods_names = [ ...(p._methods_names || []), ...(this._methods_names || []) ];
					break;
				}
				p = p.parentNode;
			}
			if(!this._root) this._root = this;
			if(!this._template) this._template = this.innerHTML.trim();
			if((this.hasAttribute("*stage") || this.hasAttribute("n-stage")) && this._stage===null){
				try{ this._stage = structuredClone(this._data); }
				catch(e){ this._stage = JSON.parse(JSON.stringify(this._data)); }
			}
			if(this.hasAttribute("*fetch") || this.hasAttribute("n-fetch")){
				const spec_raw = this.getAttribute("*fetch") ?? this.getAttribute("n-fetch") ?? "";
				const spec = this._resolve_fetch_spec(spec_raw, this._data || {}, this);
				if(spec){
					this._loading = true;
					const error = structuredClone(this.error);
					this.error.warn = false;
					this._do_load(spec);
					this.error = error;
				}else{
					this.update();
				}
			}else{
				this.update();
			}
		};
		if (document.readyState === "loading") {
			// microtask は避け、macrotask（rAF/timeout）でパース完了を待つ
			if(typeof requestAnimationFrame === "function") {
				requestAnimationFrame(start);
			} else {
				setTimeout(start, 0);
			}
		} else {
			start();
		}

		// --- ホスト属性 *websocket / n-websocket の自動接続（1 回だけ） ---
		const wsSpec = this.getAttribute("*websocket") ?? this.getAttribute("n-websocket");
		if(wsSpec){
			const into = this.getAttribute("*into") ?? this.getAttribute("n-into") ?? "";
			// 初回描画をブロックしないため macrotask に逃がす
			requestAnimationFrame(()=> this._init_websocket_host(wsSpec, into));
		}
	}

	// data 属性（JSON文字列 or JS式）-> this._data へ
	// - まず JSON.parse を試み、失敗した場合のみ JS 式として評価する
	// - JSON/式ともに失敗した場合は空オブジェクトでフェイルセーフ
	// - 既に Proxy 化済みなら再ラップ不要
	_parse_data_attr(){
		if(!this.hasAttribute("data")) return;

		const raw = (this.getAttribute("data") ?? "").trim();
		let obj;

		if(!raw){
			// 空文字や空白のみの場合は素直に空オブジェクト
			obj = {};
		}else{
			// 1) JSON としてパースを試みる
			try{
				obj = JSON.parse(raw);
			}catch(_json_err){
				// 2) JSON でなければ JS 式として評価（例: data="data" など）
				try{
					// グローバル変数やリテラル式をそのまま評価
					// 例: data="data"   -> window.data
					//     data="{a:1}"  -> オブジェクトリテラル
					obj = (new Function("return (" + raw + ");"))();
				}catch(_expr_err){
					// JSON でも式でも解釈不能な場合のみ warn
					if(this.error && this.error.warn){
						console.warn("[Sercrod warn] data attribute parse failed:", _expr_err, "value =", raw);
					}
					obj = {};
				}
			}
		}

		this._data = this.constructor._proxy_map.has(obj) ? obj : this._wrap_data(obj);
	}
	// 式実行（文として解釈・副作用のみ期待）
	// 目的:
	// - *let / @event など「文脈の副作用」を伴う評価を一括で扱うヘルパ。
	// - with(scope){ <stmts> } として実行し、スコープに直接副作用を与える。
	// 安全設計:
	// - _methods_names と _internal_methods を scope に注入して利便性を確保。
	// - 実行前 snapshot を取得し、参照は同じだが中身だけ変わった場合にも set を誘発できるように後続で調整。
	// エッジケース:
	// - 非破壊操作（slice, map など）で新参照に入れ替えた場合は通常どおり set が発火。
	// - 破壊的操作（push, splice など）で参照が不変の場合、"同じ値を再代入" して set をわざと起動。
	// - 例外時は warn ログに式文字列も出力してトラブルシュートを容易にする。
	eval_let(expr, scope, opt = {}){
		// $parent を注入（enumerable:false で data へコピーされない）
		if(scope.$parent===undefined){
			let p=this.parentElement;
			while(p && !(p instanceof Sercrod)) p=p.parentElement;
			if(p && p._data){
				try{ Object.defineProperty(scope,"$parent",{value:p._data, writable:true, configurable:true}); }
				catch(_e){ scope.$parent = p._data; }
			}
		}
		// *let でも methods を見せる（書き込み先はモードで変わるが、参照可能性は合わせる）。
		if(this._methods_names && this._methods_names.length){
			for(const name of this._methods_names){
				if(typeof window[name]==="function" && scope[name]===undefined) scope[name] = window[name];
				else if(typeof window[name]==="object" && window[name]!==null){
					for(const k in window[name]){
						if(typeof window[name][k]==="function" && scope[k]===undefined) scope[k] = window[name][k];
					}
				}
			}
		}
		for(const k in this.constructor._internal_methods){
			if(scope[k]===undefined) scope[k] = this.constructor._internal_methods[k];
		}

		// 通常 *let：安全重視。常にローカル scope へ束縛。
		// ネストも scope 配下に生成する（global や data を汚さない）。
		const makehole_local = (path)=>{
			return new Proxy(Object.create(null), {
				get: (_t,k)=>{
					if(k===Symbol.toPrimitive) return (hint)=> (hint==="string" ? "" : undefined);
					if(k==="toString") return ()=> "";
					if(k==="valueOf")  return ()=> undefined;
					// さらに深く進むたびに path を伸ばした“穴”を返す（最終 set でまとめて書く）。
					return makehole_local(path.concat(String(k)));
				},
				set: (_t,k,v)=>{
					// 代入が来たら scope を root にしてネスト書き込み。
					this._setpath(scope, path.concat(String(k)), v);
					return true;
				},
				has(){ return true; }
			});
		};

		const sandbox = new Proxy(scope, {
			has(){ return true; },
			get: (_t,k)=>{
				if(typeof k==="symbol") return undefined;
				// 擬似イベント/要素は Proxy を通さずそのまま返す（*updated など用の特別扱い）
				if(k==="el" || k==="$el" || k==="$element"){
					return opt?.el ?? opt?.$el ?? null;
				}
				if(k==="$event" || k==="$e"){
					// scope 側に $event があればそれを優先し、無ければ opt.$event を使う
					if(scope && Object.prototype.hasOwnProperty.call(scope,"$event")) return scope.$event;
					return opt?.$event ?? null;
				}
				// まず scope から。
				if(k in scope) return scope[k];
				// 参照だけは利便性のため global も見せる（Math 等）。
				if(k in globalThis) return globalThis[k];
				// 未知識別子は scope 配下に作るための“穴”を返す。
				return makehole_local([String(k)]);
			},
			set: (_t,k,v)=>{
				if(typeof k==="symbol") return true;
				// 単純代入も scope へ（未宣言でもローカル束縛）。
				scope[String(k)] = v;
				return true;
			}
		});

		try{
			// with(scope){ expr } で純 JS 評価。解析は一切しない（方針）。
			Function("scope","el","$event", `with(scope){ ${expr} }`)(sandbox, opt?.el ?? null, opt?.$event ?? null);
			// --- *let で新規に生成された変数を Sercrod 全体のスコープ (_data) にも昇格 ---
                        // これで子からも親の let を参照できる
                        // 既に _data に存在しない変数のみ反映
                        if(this._data && scope !== this._data) for(const k in scope) if(!(k in this._data)) this._data[k] = scope[k];
			// 値が変わった可能性があるので再描画を予約。
			this._schedule_update && this._schedule_update();
			return true;
		}catch(e){
			// デバッグ時に静かにしたい場合は opt.quiet / mode:"log" で制御。
			if(opt?.quiet || opt?.mode==="log") return false;
			if(this.error?.warn) console.warn("[Sercrod warn] in *let", "\n", e?.message || String(e), "\n ^", expr);
			return false;
		}
	}
	// *global 実行（副作用あり）
	// 目的:
	// - *let と異なり、未宣言代入は window/globalThis を汚染。
	// - ただし this._data に同名プロパティが存在する場合は、そちらを更新して global 汚染を避ける。
	// 実装要点:
	// - with(sandbox){ <expr> } で評価。sandbox は has:true で未定義識別子も捕捉。
	// - get: scope優先 -> globalThis -> “穴”(ネスト代入のためのダミー)。
	// - set: this._data に同名キーがあれば this._data[key] へ、無ければ globalThis[key] へ。
	eval_global(expr, scope, opt = {}){
		// *global でも $parent を使えるように注入（enumerable:false）
		if(scope.$parent===undefined){
			let p=this.parentElement;
			while(p && !(p instanceof Sercrod)) p=p.parentElement;
			if(p && p._data){
				try{ Object.defineProperty(scope,"$parent",{value:p._data, writable:true, configurable:true}); }
				catch(_e){ scope.$parent = p._data; }
			}
		}
		// methods 名の自動注入（利用者が window に置いた関数を、スコープから見えるようにする）。
		if(this._methods_names && this._methods_names.length){
			for(const name of this._methods_names){
				// 直置き function の場合（window[name] が関数）
				if(typeof window[name]==="function" && scope[name]===undefined) scope[name] = window[name];
				// 名前空間オブジェクトの中の関数をフラットに公開する場合
				else if(typeof window[name]==="object" && window[name]!==null){
					for(const k in window[name]){
						if(typeof window[name][k]==="function" && scope[k]===undefined) scope[k] = window[name][k];
					}
				}
			}
		}
		// Sercrod 側のグローバルメソッド（公式ユーティリティ）も注入。
		for(const k in this.constructor._internal_methods){
			if(scope[k]===undefined) scope[k] = this.constructor._internal_methods[k];
		}

		// eval_global のポリシー：書き込みは「data 既存キーがあれば data、無ければ global」。
		// 読み取りは scope -> global -> “穴”。“穴”は遅延で着地点を決定する。
		const sandbox = new Proxy(scope, {
			has(){ return true; },
			get: (_t,k)=>{
				// Symbol は未対応（undefined を返して with 判定を抜ける）
				if(typeof k==="symbol") return undefined;
				// まず scope に見えていればそれを返す（ローカル優先）
				if(k in scope) return scope[k];
				// 次に global から借りる（Math など）
				if(k in globalThis) return globalThis[k];
				// どこにも無ければ“穴”を返し、後続の set でルート決定する。
				return this._makehole_scoped([String(k)], scope);
			},
			set: (_t,k,v)=>{
				// Symbol 書き込みは無視（true を返して with を壊さない）
				if(typeof k==="symbol") return true;
				const key = String(k);
				// data に既存キーがあれば data 側を更新、無ければ global 側へ。
				if(this._data_has_key(key)) this._data[key] = v;
				else globalThis[key] = v;
				return true;
			}
		});

		try{
			// with(scope){ expr } を new Function で実行（式の解釈は JS に完全委任）。
			Function("scope","el","$event", `with(scope){ ${expr} }`)(sandbox, opt?.el ?? null, opt?.$event ?? null);
			// 変更があれば再描画をキュー（同フレーム合流のためスケジュール化）。
			this._schedule_update && this._schedule_update();
		}catch(e){
			// 本番で黙らせたいなら this.error?.warn フラグで制御。
			if(this.error?.warn) console.warn("[Sercrod warn] in *global", "\n", e?.message || String(e), "\n ^", expr);
		}
	}

	// 安全に式を評価（値が必要な場面）
	//   - すべて with(scope){ return (<expr>) } で統一
	//   - 失敗時は false を返す（if などで自然に偽扱い）
	// 追加説明:
	// - $data と $root を予約注入して、テンプレート側の利便性を確保。
	// - *methods と _internal_methods を merged に取り込み、"関数呼び出し専用の読み取りスコープ" を提供。
	// - quiet/mode オプションでログ出力の制御や文脈識別を行う。
	eval_expr(expr, scope, opt = {}){
		const merged = {...scope};
		//const merged = Object.assign({}, this._data || {}, this._stage || {}, scope);	// data や stage をフォールバックとして統合

		// 予約変数を注入
		if(this._data) merged.$data = this._data;            // 自分の data 全体
		if(this._root && this._root._data) merged.$root = this._root._data; // 祖先 root の data 全体

		// 評価用に $parent を提供
		if(merged.$parent===undefined){
			let p=this.parentElement;
			while(p && !(p instanceof Sercrod)) p=p.parentElement;
			if(p && p._data) merged.$parent = p._data;
		}
		// *methods の注入
		if(this._methods_names && this._methods_names.length){
			for(const name of this._methods_names){
				if(typeof window[name]==="function" && merged[name]===undefined) merged[name] = window[name];
				else if(typeof window[name]==="object" && window[name]!==null){
					for(const k in window[name]) if(typeof window[name][k]==="function" && merged[k]===undefined) merged[k] = window[name][k];
				}
			}
		}
		// どの sercrod からでも参照できる内部関数
		for(const k in this.constructor._internal_methods) if(merged[k]===undefined) merged[k] = this.constructor._internal_methods[k];

		try{
			// 実装上、式は常に括弧で囲んで副作用最小化（"return (expr)"）
			return Function("scope", "el", "$event", `with(scope){
				return (${expr});
			}`)(merged, opt?.el ?? null, opt?.$event ?? null);
		}catch(e){
			// quiet or mode=log のときは黙って false を返す（ログ出力しない）
			if(opt?.quiet) return false;
			if(opt?.mode==="log") return false;

			// 問題切り分け用に関連要素の outerHTML 断片を出力（長すぎるログを回避するため 256 文字に切詰め）
			const elHtml = opt?.el ? opt.el.outerHTML.replace(/\s+/g," ").trim().slice(0,256) : "(unknown)";
			if(this.error.warn) console.warn("[Sercrod warn] eval_expr:",
				e?.message || String(e),
				"\n ^", expr,
				"\n >>", elHtml,
				"mode="+(opt?.mode||"?"));
			return false;
		}
	}
        eval_event(expr, scope, opt = {}){
                // 1) window fallback スコープ作成
                const parent = this._data || {};
                const base   = Object.assign(Object.create(parent), scope || {});

                const sandbox = new Proxy(base, {
                        has(_t,k){
                                return (
                                        k==="$event" || k==="$e" || k==="el" || k==="$el" ||
                                        (k in base) || (k in parent) || (k in window)
                                );
                        },
                        get(_t, k){
                                if(k==="$event" || k==="$e") return opt.$event;
                                if(k==="el" || k==="$el") return opt.el;
                                if(k in base) return base[k];
                                if(k in parent) return parent[k];
                                return (k in window) ? window[k] : undefined;
                        },
                        set(_t, k, v){
                                if(k==="$event" || k==="$e" || k==="el" || k==="$el") return true;
                                base[k] = v;
                                // 親データ（this._data）に同名キーがあればそこも更新
                                if(parent && (k in parent)){
                                        parent[k] = v;
                                }
                                // データ更新を「破壊」としてマーク
                                if(this._mark_dirty){
                                        this._mark_dirty(parent, k);
                                }
                                return true;
                        }
                });

                // 2) 実行
                try{
                        const fn = Function("scope", "el", "$event", `with(scope){ ${expr}; }`);
                        return fn(sandbox, opt.el ?? null, opt.$event ?? null);
                }catch(err){
                        if(this.error?.warn){
                                console.warn("[Sercrod warn] eval_event:", expr, err);
                        }
                        return null;
                }
        }

	// n-input 等からの代入を実行（補助）
	// - 文字列の左辺式（プロパティチェーン含む）に対して with(scope){ <lhs> = __val } を実行。
	// - バリデーションや型変換は前段（filters.input_in）で実施済みを想定。
	//assign_expr(lhs, value, scope){
	//	// JS 評価式一択：with(scope){ <lhs> = <value> }
	//	try{
	//		Function("scope","__val", `with(scope){
	//			${lhs} = __val;
	//		}`)(scope, value);
	//	}catch(e){
	//		// 互換のため警告だけにする（フォーム連携中に多少のミスがあっても UI が壊れないよう配慮）
	//		if(this.error.warn) console.warn("[Sercrod warn] assign_expr:", e?.message || String(e), "\n ^", lhs, "\n ->", value);
	//	}
	//}
	assign_expr(lhs, value, scope){
		const setPath = (obj, path, val)=>{
			let cur = obj;
			for(let i=0;i<path.length-1;i++){
				const k = path[i];
				if(cur[k]==null || typeof cur[k]!=="object") cur[k] = {};
				cur = cur[k];
			}
			cur[path[path.length-1]] = val;
		};
		const makeHole = (path)=> new Proxy(Object.create(null), {
			get(_t,k){
				if(k === Symbol.toPrimitive) return (hint)=> (hint==="string" ? "" : undefined);
				if(k === "toString") return ()=> "";
				if(k === "valueOf")  return ()=> undefined;
				return makeHole(path.concat(String(k)));
			},
			set(_t,k,v){ setPath(scope, path.concat(String(k)), v); return true; },
			has(){ return true; }
		});

		const sandbox = new Proxy(scope, {
			// __val（関数引数）は with でシャドーさせない
			// 必要なら 'el', '$event' も同様に除外
			has(_t, k){ return k === "__val" ? false : true; },
			get(t,k,r){
				if(typeof k==="symbol") return Reflect.get(t,k,r);
				if(k in t) return Reflect.get(t,k,r);
				if(k === "__val") return undefined; // 念のため
				return makeHole([String(k)]); // 未定義識別子 -> “穴”
			},
			set(t,k,v){ t[k] = v; return true; }
		});
		try{
			Function("scope","__val", `with(scope){ ${lhs} = __val; }`)(sandbox, value);
		}catch(e){
			if(this.error?.warn) console.warn("[Sercrod warn] assign_expr:", e?.message || String(e), "\n ^", lhs, "\n ->", value);
		}
	}

	// テキスト内の %expr% をスコープで展開
	// - "Hello %user.name%!" のような軽量テンプレート構文。
	// - 失敗/偽/null は placeholder フィルタで空文字列などに整形。
	_expand_text(str, scope, node){
		const start = String(this.constructor._config.delimiters.start).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const end = String(this.constructor._config.delimiters.end).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const re = new RegExp(`${start}\\s*([\\s\\S]+?)\\s*${end}`, "g");
		//return String(str).replace(/%(.+?)%/g, (_, ex)=>{
		return String(str).replace(re, (_, ex)=>{
			let v;
			try { v = this.eval_expr(ex, scope, {el: node, mode:"text"}); }
			catch(e) { v = null; }
			const raw = (v==null || v===false) ? "" : v;
			// ctx を最低限構成する（将来的に placeholder フィルタが expr/scope を参照可能）
			return this.constructor._filters.placeholder(raw, { expr: ex, scope });
		});
	}

	// *fetch / n-fetch の spec を解決
	// - まず %expr% を展開（_expand_text）
	// - 展開結果が "=<expr>" で始まる場合は、式として評価して文字列化
	//   例: *fetch="=`/api/${id}.json`"
	_resolve_fetch_spec(spec_raw, scope, node){
		const expanded = this._expand_text(spec_raw ?? "", scope, node);
		const spec = String(expanded);
		if(spec.startsWith("=")){
			const expr = spec.slice(1).trim();
			const v = this.eval_expr(expr, scope, {el: node, mode:"fetch", quiet:true});
			if(v===false || v===null || v===undefined) return "";
			return String(v);
		}
		return spec;
	}


	// *updated フックを処理する
	//    - *updated="(sel)"        -> セレクタ指定 (最上位 Sercrod 内で update())
	//    - *updated="foo()"         -> 関数呼び出し (引数可)
	//    - *updated="z.func1()"     -> ドット参照関数呼び出し
	//    - *updated="z"             -> オブジェクト一括 (例外ケース：オブジェクト内の関数を全て呼ぶ)
	//    - *updated="expr"          -> フォールバックで式評価
	// 設計メモ:
	// - CustomElement 自体に付いた *updated のみを対象にし、通常要素に付いたものは別ルートで吸収処理（_absorb_child_updated）。
	// - 再帰的な update 連鎖を避けるため、親 Sercrod を起点にセレクタ解決してから update を指示。
	_call_updated_hooks(evt=null, isInit=false){
		const attr = this.getAttribute("*updated") || this.getAttribute("n-updated");
		const srcAttr = this.hasAttribute("*updated") ? "*updated" : "n-updated";

		// evt が無ければダミーイベントを作る（初期化か通常更新かで type を変える）
		const fakeEvt = {
			type: isInit ? "sercrod:init" : "sercrod:update",
			target: this,
			currentTarget: this
		};
		const realEvt = evt || fakeEvt;

		// ここで「通常要素の *updated ではない」ことを保証
		//    （CE 自体に付いた *updated だけを処理）
		// ここで通常要素についた updated などを処理すると、親 Sercrod が複製される事象が発生してしまうため、これを回避
		if(!(this instanceof Sercrod)) return;

		if(attr){
			let handled = false;
			const entries = attr.split(/[\s,]+/).filter(Boolean);

			for(const entry of entries){

				// --- 1) オブジェクト一括呼び出し (例外ケース) ---
				// window[entry] がオブジェクトなら、その enumerable な関数をすべて this を引数に呼ぶ。
				// 例: *updated="Utils" -> Utils.log(this), Utils.scan(this) ...
				if(typeof window[entry]==="object" && window[entry]!==null){
					for(const k in window[entry]){
						const f = window[entry][k];
						if(typeof f==="function"){
							handled = true;
							try{ f(this); }
							catch(e){ if(this.error.warn) console.warn(`[Sercrod warn] ${srcAttr} obj:`, e); }
						}
					}
					continue;
				}

				// --- 2) セレクタ指定 "(...)" ---
				// （"...": 親方向に近い Sercrod を起点とし、root とその子孫に対して update を指示）
				if(/^\(.*\)$/.test(entry)){
					handled = true;
					const sel = entry.slice(1, -1);
					try{
						let root = this;
						let parent = root.parentElement?.closest("*");	//万が一、テキストノードなどのノードにヒットしないように、あえて closest で検出
						while(parent && !(parent instanceof Sercrod)) parent = parent.parentElement;
						if(parent instanceof Sercrod) root = parent;
						root = root || this;
						// まず root 自身がセレクタに一致するか確認
						if(root.matches(sel) && this._isSercrod(root)) root.update(true);
						// さらに子孫も探す
						//root.querySelectorAll(sel).forEach(el=>{ if(el instanceof Sercrod) el._call_updated_hooks(evt, isInit); });
						// さらに子孫も探す（セレクタ一致のみを呼ぶ）
						let list = [];
						if (root._get_flagged) {
							if (root !== this && root._rebuild_flag_index) root._rebuild_flag_index(); // 親だけ新鮮化
							list = root._get_flagged("sercrod");
						}
						for (const el of list) if (el.matches(sel)) el._call_updated_hooks(evt, isInit);
					}catch(e){
						if(this.error.warn) console.warn(`[Sercrod warn] ${srcAttr} selector:`, e);
					}
					continue;
				}
			}
			// --- 3) 式評価（JS 評価式一択：文として実行）
			// entry が 1./2. に該当しなかった場合、最終的に「文として」評価する。
			if(!handled){
				try{
					this.eval_let(attr.trim(), this._data, {
						el: this,
						$event: realEvt,
						mode: "updated"
					});
				}catch(e){
					if(this.error.warn) console.warn(`[Sercrod warn] ${srcAttr} fallback expr:`, e);
				}
			}
		}

		// 2) *updated-propagate の処理
		// 仕様補足:
		// - 値なし/数値/文字列/括弧セレクタ/キーワード"root" を解釈。
		// - "n 階層親へ" 指定は Sercrod のみをカウントして遡る（通常要素はスキップ）。
		const propAttr = this.getAttribute("*updated-propagate") || this.getAttribute("n-updated-propagate");
		if(propAttr!==null){
			const srcProp = this.hasAttribute("*updated-propagate") ? "*updated-propagate" : "n-updated-propagate";
			let targetSpec = (propAttr || "1").trim();  // 省略時は "1"
			try{
				if(/^\(.*\)$/.test(targetSpec)){
					// セレクタ指定
					const sel = targetSpec.slice(1, -1);
					const el = this.closest(sel);
					if(el instanceof Sercrod) el.update(true, this);
				}else if(targetSpec==="root"){
					// 最上位の Sercrod を探す（親方向に 1 体見つかればそれを root とみなす）
					let root = this;
					let parent = root.parentElement?.closest("*");
					while(parent && !(parent instanceof Sercrod)) parent = parent.parentElement;
					if(parent instanceof Sercrod) root = parent;
					root = root || this;
					if(root && root instanceof Sercrod) root.update(true, this);
				}else if(/^\d+$/.test(targetSpec)){
					// 数値指定（階層数ぶん親をさかのぼる）
					let steps = parseInt(targetSpec, 10);
					let p = this.parentElement;
					while(steps>0 && p){
						if(p instanceof Sercrod) steps--;
						if(steps===0 && p instanceof Sercrod){
							p.update(true, this);
							break;
						}
						p = p.parentElement;
					}
				}else{
					// フォールバック: 文字列をセレクタとみなす
					const el = this.closest(targetSpec);
					if(el instanceof Sercrod) el.update(true, this);
				}
			}catch(e){ if(this.error.warn) console.warn(`[Sercrod warn] ${srcProp}:`, e); }
		}
	}

	// *log の評価と出力
	// 用途:
	// - 指定ノードの評価値/式/要約HTMLをコンソールに整形出力する簡易ログ。
	// 実装メモ:
	// - 再レンダリング時の多重出力を避けるため "+logged" フラグで1度きりに制御。
	// - 文字列化は stringify を優先、循環構造は try/catch で安全に回避。
	_call_log_hooks(scope){
		if(!this.log) return;  // 全体ログOFFなら即終了

		// 再構築済みのインデックスから直接取得（querySelectorAll禁止）
		const log_nodes = this._flag_index["*log"];
		if(!log_nodes || !log_nodes.size) return;

		// 再突入防止をあとから入れる（weakmapしてから）
		for(const el of log_nodes){

			// すでに logged 済みならスキップ
			if(this.has_flag(el, "+logged")) continue;

			this.add_flag(el, "+logged");

			const expr    = el.getAttribute("*log") ?? el.getAttribute("n-log");
			const srcAttr = el.hasAttribute("*log") ? "*log" : "n-log";
			let val;
			let str;
			let error = null;

			try{
				const v = expr ? this.eval_expr(expr, scope, {el, mode:"log"}) : scope;

				if(v===null || v===undefined){
					val = "";
					str = "";
				}else if(typeof v==="object"){
					// コンソールでは「生オブジェクト」を見たい
					val = v;
					// <pre *log> 用に整形済みの文字列も用意しておく
					try{
						str = JSON.stringify(v, null, 2);
					}catch(e){
						str = "[Sercrod warn] JSON stringify failed";
					}
				}else{
					// プリミティブ値は文字列にして両方で使う
					val = String(v);
					str = val;
				}
			}catch(e){
				error = e;
				val = `[Sercrod warn] ${srcAttr} eval error: ${e.message}`;
				str = val;
			}

			const html   = el.outerHTML.replace(/\s+/g," ").trim().slice(0,256);
			const is_pre = el.tagName==="PRE";

			if(is_pre){
				// <pre *log> の場合はコンソールではなく、その <pre> に出力
				let msg = `[Sercrod pr]
${str}
 ^ ${expr || "(scope)"}
 >> ${html}`;
				if(error){
					msg += `\n error =${error.message}`;
				}
				// HTML として解釈させず、そのままテキストとして見せたいので textContent を使う
				el.textContent = msg;
			}else{
				// 従来通りコンソールへ出力
				console.log("[Sercrod log]",
					"\n",   val,
					"\n ^", expr || "(scope)",
					"\n >>", html,
					error ? "\n error =" + error.message: "");
				//error ? "\n error =" + error.stack : "");	// 真にデバッグする場合はスタックを出力
			}
		}
	}

	// *man の評価と出力
	// 用途:
	// - ディレクティブ/イベント/属性バインディングの簡易マニュアルを表示する。
	// 実装メモ:
	// - <pre *man> / <pre n-man> の場合は textContent に書き込み、HTML として解釈させない。
	// - それ以外の要素では console.log に短い説明と例だけを出力する。
	// *man の評価と出力
	// *man の評価と出力
	_call_man_hooks(scope){
		const nodes = this._flag_index["*man"];
		if(!nodes || !nodes.size) return;

		const cls = this.constructor;

		// man.json 自動ロード（未試行なら 1 度だけ）
		if(!cls._man_full_loaded && !cls._man_full_load_attempted){
			cls._ensure_man_loaded();
		}

		const short_defs      = cls._man_short || {};
		const full_defs       = cls._man_full  || null;
		const has_full        = !!cls._man_full_loaded;
		const full_index      = cls._man_full_index;        // man 全体のフルテキスト
		const directives_text = cls._man_directives || "";  // directives 用の静的テキスト

		for(const el of nodes){
			// すでに処理済みならスキップ（ログ多重出力防止）
			if(this.has_flag && this.has_flag(el, "+man-done")) continue;
			if(this.add_flag) this.add_flag(el, "+man-done");

			// 1) 属性値取得
			let src = el.getAttribute("*man");
			if(src == null) src = el.getAttribute("n-man");
			if(src != null) src = String(src).trim();

			// 空なら "__index" 固定（ここは式評価しない）
			let raw;
			if(!src){
				raw = "__index";
			}else{
				// 2) まず式として評価を試す
				//    - quiet:true なので構文エラー時は false が返ってくる想定
				let v = this.eval_expr
					? this.eval_expr(src, scope || this._data || {}, {
						quiet: true,
						el: el,
						mode: "man-key"
					})
					: false;

				// v が string/number/true ならそれを採用
				// false / null / undefined / それ以外 → 式失敗とみなして生文字列を使う
				if(v !== false && v !== null && v !== undefined &&
				   (typeof v === "string" || typeof v === "number" || v === true)){
					raw = String(v);
				}else{
					raw = src;
				}
			}

			// special key: "directives"
			const is_directives_special = (raw === "directives");

			// 3) プレフィックスからカテゴリ / key を決定
			let key;
			let category = "other";
			let invalid  = false;

			if(is_directives_special){
				// *man="directives" は内部キー "__directives" として扱う
				key = "__directives";
				category = "internal";
			}else if(raw === "__index"){
				key = "__index";
				category = "internal";
			}else if(raw === "__data"){
				key = "__data";
			}else{
				const first = raw[0];

				if(first === "*" && raw[1] === ":"){
					// *:class → attribute-class （*: 系ショートハンド）
					category = "attribute";
					const body = raw.slice(2);
					if(body){
						key = "attribute-" + body;
					}else{
						invalid = true;
					}
				}else if(first === "*"){
					// *each, *if, *print など
					category = "directive";
					const body = raw.slice(1);
					if(body){
						// "*print" → key:"print"
						key = body;
					}else{
						invalid = true;
					}
				}else if(first === "@"){
					category = "event";
					const body = raw.slice(1);
					if(body){
						// "@click" → key:"event-click"
						key = "event-" + body;
					}else{
						invalid = true;
					}
				}else if(first === ":"){
					category = "attribute";
					const body = raw.slice(1);
					if(body){
						// ":class" → key:"attribute-class"
						key = "attribute-" + body;
					}else{
						invalid = true;
					}
				}else{
					// プレフィックスなしは __invalid
					invalid = true;
				}
			}

			if(invalid){
				key = "__invalid";
				category = "invalid";
			}

			// 4) 短い要約（short_defs）取得
			let shortDef = null;

			if(Object.prototype.hasOwnProperty.call(short_defs, key)){
				shortDef = short_defs[key];
			}else{
				// カテゴリ別フォールバック
				if(category === "attribute" &&
				   Object.prototype.hasOwnProperty.call(short_defs, "attributes")){
					shortDef = short_defs["attributes"];
				}else if(category === "event" &&
				         Object.prototype.hasOwnProperty.call(short_defs, "events")){
					shortDef = short_defs["events"];
				}else if(Object.prototype.hasOwnProperty.call(short_defs, "__unknown")){
					shortDef = short_defs["__unknown"];
				}
			}

			let summary = "";

			if(typeof shortDef === "string"){
				summary = shortDef;
			}else if(shortDef && typeof shortDef === "object"){
				summary =
					shortDef.short   ||
					shortDef.summary ||
					shortDef.title   ||
					shortDef.text    ||
					"";
			}

			const isPre = (el.tagName === "PRE");

			// 5) フルテキスト取得（<pre> 用）
			let fullText = "";

			if(is_directives_special){
				// *man="directives"
				if(isPre){
					// <pre *man="directives"> → static _man_directives を優先
					if(directives_text){
						fullText = directives_text;
					}else if(has_full && full_defs &&
					         Object.prototype.hasOwnProperty.call(full_defs, "__directives")){
						const f = full_defs["__directives"];
						if(typeof f === "string"){
							fullText = f;
						}else if(f && typeof f === "object"){
							fullText = f.text || f.body || f.full || "";
							if(!fullText){
								try{
									fullText = JSON.stringify(f, null, 2);
								}catch(_e){}
							}
						}
					}
					if(!fullText){
						fullText = summary || raw;
					}
				}else{
					// <pre> 以外は「ここでは出さず、pre で使える」ことだけ案内（下の console.log で）
					if(!summary && Object.prototype.hasOwnProperty.call(short_defs, "__directives")){
						const d = short_defs["__directives"];
						if(typeof d === "string") summary = d;
						else if(d && typeof d === "object"){
							summary =
								d.short   ||
								d.summary ||
								d.title   ||
								d.text    ||
								"";
						}
					}
				}
			}else{
				// 通常のキー
				// man 自体のフルテキストは _man_full_index を使用
				if(raw === "__index" || key === "__index"){
					if(typeof full_index === "string"){
						fullText = full_index;
					}
				}else if(has_full && full_defs &&
				         Object.prototype.hasOwnProperty.call(full_defs, key)){
					const f = full_defs[key];
					if(typeof f === "string"){
						fullText = f;
					}else if(f && typeof f === "object"){
						fullText = f.text || f.body || f.full || "";
						if(!fullText){
							try{
								fullText = JSON.stringify(f, null, 2);
							}catch(_e){}
						}
					}
				}

				// それでも空なら summary / raw でフォールバック
				if(!fullText){
					fullText = summary || raw;
				}
			}

			if(isPre){
				// <pre *man> → フルテキストを中身に
				el.textContent = fullText || "";
			}else if(typeof console !== "undefined" && console && console.log){
				// 通常要素 → コンソールに短い要約だけ
				let msg;

				if(is_directives_special){
					// *man="directives" を <pre> 以外に付けた場合の専用メッセージ
					msg = summary ||
						"Use <pre *man=\"directives\"> to print the list of Sercrod directives into the page.";
					console.log("[Sercrod *man]", raw, "-", msg);
				}else{
					msg = summary || fullText || raw;
					if(shortDef && typeof shortDef === "object" && shortDef.example){
						console.log("[Sercrod *man]", raw, "-", msg, "\nExample:", shortDef.example);
					}else{
						console.log("[Sercrod *man]", raw, "-", msg);
					}
				}
			}
		}
	}

	// 再描画
	// フロー概略:
	// 1) 再入ガード、ループ回数ガード（loop_limit）
	// 2) *stage の同期、*lazy の最適化（親は描かず子のみ更新）
	// 3) innerHTML をテンプレートから毎回再構築（差分パッチなしの単純・安定路線）
	// 4) フラグインデックス再構築 -> *log -> *updated -> 子通常要素 *updated 吸収
	// 5) finally: ロック解除、_finalize、post_update の取りこぼし再実行、カウンタリセット
	update(force=true, caller=null, evt=null, isInit=false){
		// -----------------------------------
		// すでに update() 実行中なら即リターン
		// （子->親->子 の無限再帰を防止する）
		// -----------------------------------
		if(this._updating) return;
		this._updating = true;

		try{
			if(!this._template) return;

			// --- 初回 or 「force===true の update」時のみ：ホスト属性 *websocket の再接続を一度だけ許可 ---
			// 内部イベント由来の update は this.update(false) なので対象外。自動リトライはしない。
			if(((isInit) || (force===true && !this._ws_internal_update))
			   && (this.hasAttribute("*websocket") || this.hasAttribute("n-websocket"))){
				try{
					this._ws_map = this._ws_map || new Map();
					const raw   = this.getAttribute("*websocket") ?? this.getAttribute("n-websocket");
					const into  = this.getAttribute("*into") ?? this.getAttribute("n-into") ?? "";
					const scope = this._stage ?? this._data;
					const spec  = (typeof this._resolve_ws_spec==="function")
						? this._resolve_ws_spec(raw, scope, this)
						: { url: raw, into };
					const url   = spec?.url || "";
					const has_placeholder = (typeof this._has_placeholders==="function") ? this._has_placeholders(url) : false;
					if(url && !has_placeholder){
						const holder = this._ws_map.get(url);
						const rs = holder?.ws?.readyState; // 1:OPEN, 0:CONNECTING
						if(!(rs===1 || rs===0)){
							// 初回ワンショット抑止が効いている場合に備えて解除
							if(this.__wsOnce instanceof Set){
								this.__wsOnce.delete(url);
								this.__wsOnce.delete(`HOST ${url}`);
							}
							// 明示的 update のこのタイミングでだけ接続を試みる
							if(typeof this._init_websocket_host==="function"){
								this._init_websocket_host(raw, into);
							}
						}
					}
				}catch(_){}
			}

			// ループカウンタを加算
			this._update_counter = (this._update_counter ?? 0) + 1;
			if(this._update_counter > this.loop_limit){
				// outerHTML の断片を生成（256文字まで）
				const node_html = this.outerHTML.replace(/\s+/g, " ").trim().slice(0,256);
				if(this.error.warn) console.warn(`[Sercrod warn] update が ${this.loop_limit} 回を超えました\n${node_html}`);
				return;
			}

			// *stage の場合でも親からスコープが来ていたらリセット／同期する
			if((this.hasAttribute("*stage") || this.hasAttribute("n-stage")) && this.__sercrod_scope){
				try{ this._stage = structuredClone(this.__sercrod_scope); }
				catch(e){ this._stage = JSON.parse(JSON.stringify(this.__sercrod_scope)); }
			}

			// *lazy がある場合、ユーザー入力時は子だけ更新し、強制時のみ自分を再描画
			const lazyAttr = this.getAttribute("*lazy") || this.getAttribute("n-lazy");
			const isLazy = (this.hasAttribute("*lazy") || this.hasAttribute("n-lazy")) && String(lazyAttr ?? "").toLowerCase() !== "false";

			const shouldUpdate = force || !isLazy;

			if(!shouldUpdate){
				// 親は再描画しないが、子更新と *updated フックは呼ぶ
				this._updateChildren(false, this);
				this._call_updated_hooks(evt, isInit);

				this._finalize();

				return;
			}

			// いったんクリアしてテンプレートから再構築（差分追跡はしない）
			this.innerHTML = "";

			// 表示スコープは「バッファ優先」。*stage 無しなら _data
			const scope = this._stage ?? this._data;

			// ホスト要素自体に *for がある場合（<serc-rod *for="x in xs">…）
			// - ここではホスト自身を反復出力するのではなく、「内部テンプレートを scope を変えながら複数回描画」する。
			// - "in" は JS 同様に「key列挙」、"of" は「値列挙」として動作する。
			// - (key,value) 形式で "in" を使うのは非推奨（"of" を使用すべき）。
			// - 後方互換：`x in array` は従来どおり値列挙として扱う（= of と同等）
			// - (key,value) 対応：変数が2つなら key と value を両方束縛
			// 1) ホスト要素自体の *for
			const hostFor = this.getAttribute("*for") || this.getAttribute("n-for");
			if(hostFor){
				const m = hostFor.match(/^\s*\(?\s*(\w+)(?:\s*,\s*(\w+))?\)?\s+(in|of)\s+([\s\S]+)\s*$/);
				if(m){
					const keyName = m[2] ? m[1] : null;
					const valName = m[2] ? m[2] : m[1];
					const modeWord = m[3];
					const srcExpr  = m[4];

					const iterable = this.eval_expr(srcExpr, scope, {el:this, mode:"update"});
					if(iterable==null) return;

					const pairs = this._normalize_pairs(iterable, modeWord, !!keyName);
					for(const [k,v] of pairs){
						if(keyName){
							this._renderTemplate({...scope, [keyName]: k, [valName]: v}, this);
						}else{
							this._renderTemplate({...scope, [valName]: v}, this);
						}
					}
					if(modeWord==="in" && keyName){
						console.warn("[Sercrod warn] 'in' with (key,value) is supported, but 'of' is clearer.");
					}
					return;
				}
			}

			// 通常の 1 回描画
			this._renderTemplate(scope, this);

			// 描画完了後に一回だけインデックス再構築
			this._rebuild_flag_index();

			// *man フック（*man / n-man 出力）
			this._call_man_hooks(scope);

			// 初回レンダリング完了とインデックス再構築完了直後に１回ログを出力
			requestAnimationFrame(()=> this._call_log_hooks(scope));

			// updated フック（*updated 呼び出し）
			this._call_updated_hooks(evt, isInit);

			// 通常要素に付与された *updated / n-updated を吸収実行（子CEは無視）
			this._absorb_child_updated();
		}finally{
			// -----------------------------------
			// 必ず _updating を解除する
			// （例外が発生してもロックが残らない）
			// -----------------------------------
			this._updating = false;

			// すべての update が終了したときだけ snapshot を保存
			//if(this._root === this && this._update_depth === 0){
			//if(this._root === this){
			this._finalize();

			// 描画中に捨てた更新があれば、ここで1回だけ予約し直す
			if(this._needs_post_update){
				this._needs_post_update = false;
				this._schedule_update();
			}

			// ループカウンタはトランザクション完了でリセット
			this._update_counter = 0;
			//}
		}
	}

	// -----------------------------
	//  _renderTemplate
	// -----------------------------
	//
	// テンプレート（文字列）-> DOM にパース -> ノードごとに描画
	// - 行頭コメント（//, #）を正規化時に除去してから HTML としてパース。
	// - Document.body 直下の childNodes を順に renderNode へ。
	// 通常描画の直前で AST を生成・開放・フックに渡す。
	// this._ast_tree に格納し、フック登録があれば順次呼び出す。
	_renderTemplate(scope, mount){
		let s = String(this._template).replace(/\r\n?/g, "\n");
		s = s.replace(/^\s*(?:\/\/|#).*$/gm, "");

		// 1) DOMパース（プリフック用）---
		let doc = Sercrod._parser.parseFromString(s, "text/html");

		// プリフック呼び出し（DOMミューテート／文字列返却に対応）---
		if(this.constructor._pre_hooks && this.constructor._pre_hooks.length){
			for(const fn of this.constructor._pre_hooks){
				try{
					const r = fn(doc, this);
					if(typeof r === "string"){
						// 文字列が返ってきた場合は、それを新しいテンプレ文字列として採用
						s = r;
						doc = Sercrod._parser.parseFromString(s, "text/html");
					}
					// ※ 戻り値が Document/Node の扱いは複雑化するため非対応。ミューテート運用に統一。
				}catch(e){
					if(this.error?.warn) console.warn("[Sercrod warn] pre-hook:", e);
				}
			}
		}

		// 1.5) フラグメント化（<template>ラッパーで head/body を意識しない）---
		// this._template（およびプリフック後の s）を「文書」ではなく純粋なフラグメントとして扱う。
		// これにより、先頭の <template *template="..."> なども head に押し込まれず、その場の子ノードとして renderNode に流れてくる。
		const fragWrapper = document.createElement("template");
		fragWrapper.innerHTML = s;
		const roots = Array.from(fragWrapper.content.childNodes);

		// 2) AST生成＋キャッシュ
		// プリフックが無い場合のみ、this._template をキーに AST をキャッシュする。
		if(!(this.constructor._pre_hooks && this.constructor._pre_hooks.length) && !Sercrod._ast_cache.has(this._template)){
			const tree = roots
				.map(n => Sercrod._extract_ast(n))
				.filter(Boolean);
			Sercrod._ast_cache.set(this._template, tree);   // 文字列OK
		}

		if(this.constructor._pre_hooks && this.constructor._pre_hooks.length){
			// プリフックがある場合はキャッシュを回避して、フラグメントから直接 AST を作る
			this._ast_tree = roots
				.map(n => Sercrod._extract_ast(n))
				.filter(Boolean);
		}else{
			this._ast_tree = Sercrod._ast_cache.get(this._template);
		}

		// 3) 登録済みASTフック呼び出し
		for(const fn of Sercrod._ast_hooks){
			try{ fn(this._ast_tree, this); }catch(e){ console.warn("[Sercrod warn] AST hook:", e); }
		}

		// 4) 通常描画
		// ここも doc.body ではなく、フラグメントの直下ノードをそのまま描画する
		roots.forEach(n => {
			this.renderNode(n, scope, mount);
		});
	}

	// 個々のノードを描画（if/elseif/else, for, let, 子 Sercrod などの構文を処理）
	// 設計のポイント:
	// - テキスト / *literal は早期リターンで単純化。
	// - 子 Sercrod の検出: _isSercrod(node) によりタグ登録状態とインスタンス化済みを包括判定。
	// - 制御ディレクティブ（apply/restore/switch/each/for/if-chain/let/save/load/post/fetch）を順次判定し、該当すれば専用処理へ。
	// - ヒットしなければ通常要素として _renderElement に委譲。
	renderNode(node, scope, parent, in_static=false){

		// 1) テキストノード
		if(node.nodeType===3){
			const raw = node.textContent;
			if(in_static){
				// static 範囲ではテンプレ展開せず、そのままコピー
				parent.appendChild(document.createTextNode(raw));
			}else{
				const expanded = this._expand_text(raw, scope, node);
				parent.appendChild(document.createTextNode(expanded));
			}
			return;
		}

		// テキキスト/要素以外は無視
		if(node.nodeType!==1) return;

		//// *static / *dynamic 判定
		//const is_dynamic = node.hasAttribute("*dynamic") || node.hasAttribute("n-dynamic");
		//const is_static  = node.hasAttribute("*static")  || node.hasAttribute("n-static");
		//let next_in_static = in_static;
		//if(is_dynamic){
		//	// dynamic が付いているノードから先は static を解除
		//	next_in_static = false;
		//}else if(is_static){
		//	// static が付いているノードの「子」から static 範囲に入る
		//	next_in_static = true;
		//}

		//// 上位が static かつ自分が dynamic でない場合は、そのままクローンして返す
		//if(in_static && !is_dynamic){
		//	const cloned = node.cloneNode(true);
		//	cloned.removeAttribute("*static");
		//	cloned.removeAttribute("n-static");
		//	cloned.removeAttribute("*dynamic");
		//	cloned.removeAttribute("n-dynamic");
		//	parent.appendChild(cloned);
		//	return;
		//}

		//// static/dynamic は出力用DOMから取り除く
		//node.removeAttribute("*static");
		//node.removeAttribute("n-static");
		//node.removeAttribute("*dynamic");
		//node.removeAttribute("n-dynamic");

		// 2) 子要素（スコープ継承 or *literal でリテラル出力）
		if(node.hasAttribute("*literal") || node.hasAttribute("n-literal")){
			const lit = node.getAttribute("*literal") || node.getAttribute("n-literal");
			const text = (lit!=null && String(lit).length>0) ? String(lit) : node.innerHTML;
			parent.appendChild(document.createTextNode(text));
			return;
		}

		// 作業対象ノード／スコープ
		let work     = node;   // 属性を剥がしながら処理する“作業用”ノード
		let effScope = scope;  // 現在有効なスコープ（*let などで差し替え）

		// 条件評価のフェイルセーフ・ヘルパ
		const _eval_cond=(expr, sc, ctx)=>{
			try{
				const v = this.eval_expr(expr, sc, ctx);
				// "false" や "0" などを適切に偽扱い
				if(v===false) return false;
				if(v===true)  return true;
				if(v==null)   return false;
				if(typeof v==="number") return v!==0 && !Number.isNaN(v);
				if(typeof v==="string"){
					const s=v.trim().toLowerCase();
					if(s==="" || s==="false" || s==="0" || s==="null" || s==="undefined") return false;
					return true;
				}
				return Boolean(v);
			}catch(e){
				// "true"/"false" は直接ブール解釈（eval_expr 異常時の保険）
				if(typeof expr==="string"){
					if(/^\s*true\s*$/i.test(expr)) return true;
					if(/^\s*false\s*$/i.test(expr)) return false;
				}
				if(this.error?.warn) console.warn("[Sercrod warn] if-eval:", e, " expr=", expr, " el=", ctx?.el||null);
				return false;
			}
		};

		// ---------------------------------------
		// 非構造系（多重適用／returnしない）? ※ if より“前”に *let を評価
		// ---------------------------------------

		// 3) *let（式や複文をそのまま実行）
		// - ローカルスコープ（プロトタイプで scope を参照）を作って副作用を閉じ込める。
		// - if のゲートや各種ディレクティブの“前”に評価して、以降の判定に反映させる。
		{
			const letExpr = work.getAttribute("*let") || work.getAttribute("n-let");
			//if(letExpr){
			//	const letScope = Object.assign(Object.create(effScope), effScope);
			//	this.eval_let(letExpr, letScope, {el: work, mode:"let"});
			//	effScope = letScope;

			//	// 以降のディレクティブ適用のため *let を剥がしたクローンに差し替え
			//	work = work.cloneNode(true);
			//	work.removeAttribute("*let");
			//	work.removeAttribute("n-let");
			//}
			if(letExpr){
				//// スコープを複製して閉じ込める
				//const letScope = Object.assign(Object.create(scope), scope);
				//// let 評価時に this.constructor を通すことで SubSercrod の world に束縛
				//this.eval_let.call(this.constructor.prototype, letExpr, letScope, {el: node, mode:"let"});
				//scope = letScope;  // 子要素に伝播
				// 直前までの「有効スコープ」を継承して局所スコープを作る
				const letScope = Object.assign(Object.create(effScope), effScope);
				// インスタンスの eval_let を使って OK（prototype 呼び出しにする必要なし）
				this.eval_let(letExpr, letScope, { el: work, mode: "let" });
				// ここがポイント：子へ渡すのは effScope
				effScope = letScope;
			}
		}

		// (A) *global（副作用：_data または globalThis を更新）
		{
			const gexpr = work.getAttribute("*global") || work.getAttribute("n-global");
			if(gexpr){
				// ここではスコープを差し替えず、副作用だけ適用
				// - 同名キーが this._data にあればそちらを更新
				// - 無ければ globalThis を汚染（仕様通り）
				this.eval_global(gexpr, effScope, { el: work, mode:"global" });
				// ※ 属性は剥がさない（*let と同様、render フロー内で評価して子に影響を与えるだけ）
			}
		}

		// if -> ->each -> for の順で評価

		// ---------------------------------------
		// 構造系（return 型）: each -> if-chain -> switch -> for
		// ---------------------------------------

		// 7) if / elseif / else（兄弟で 1 つだけ描画）
		// - チェーン（elseif/else）に参加している場合は先頭 if ノードのみが処理する。
		// ---------------------------------------
		// 構造系（return 型）: if-chain -> switch -> each/for
		// ---------------------------------------

		// ---------------------------------------------
		// *if / *elseif / *else チェーン処理（単独も含めてここで完結）
		// ---------------------------------------------
		if(node.nodeType === 1){
			const has_if    = node.hasAttribute("*if")      || node.hasAttribute("n-if");
			const has_elif  = node.hasAttribute("*elseif")  || node.hasAttribute("n-elseif");
			const has_else  = node.hasAttribute("*else")    || node.hasAttribute("n-else");
			const has_cond  = has_if || has_elif || has_else;

			if(has_cond){
				const is_if_node   = has_if;
				const is_elif_node = has_elif;
				const is_else_node = has_else;

				// 1) チェーン先頭（*if）を決める
				let head = null;

				if(is_if_node){
					// 自分自身が *if / n-if のときは必ずチェーンの先頭
					head = node;
				}else{
					// *elseif / *else のときは左側にある直近の *if を探す
					let p = node.previousSibling;
					while(p){
						if(p.nodeType === 1){
							const p_has_if   = p.hasAttribute("*if")      || p.hasAttribute("n-if");
							const p_has_elif = p.hasAttribute("*elseif")  || p.hasAttribute("n-elseif");
							const p_has_else = p.hasAttribute("*else")    || p.hasAttribute("n-else");
							const p_has_cond = p_has_if || p_has_elif || p_has_else;

							if(p_has_if){
								head = p;
								break;
							}
							if(!p_has_cond){
								// 条件付き要素以外を挟んだらそこで打ち切り
								break;
							}
						}
						p = p.previousSibling;
					}
				}

				// *if までさかのぼれなかった *elseif / *else は「不正チェーン」とみなして無視
				if(!head) return;

				// チェーンの評価は先頭 (*if) のときだけ行う
				if(node !== head) return;

				// 2) head から右方向に「このチェーンに属する枝」を集める
				const chain = [];
				let cur = head;

				while(cur && cur.nodeType === 1){
					const c_has_if   = cur.hasAttribute("*if")      || cur.hasAttribute("n-if");
					const c_has_elif = cur.hasAttribute("*elseif")  || cur.hasAttribute("n-elseif");
					const c_has_else = cur.hasAttribute("*else")    || cur.hasAttribute("n-else");
					const c_has_cond = c_has_if || c_has_elif || c_has_else;
					if(!c_has_cond) break;

					let type = "if";
					if(c_has_elif) type = "elif";
					else if(c_has_else) type = "else";

					chain.push({ type, el: cur });

					// 次の兄弟を確認（要素以外はスキップ）
					let next = cur.nextSibling;
					while(next && next.nodeType !== 1) next = next.nextSibling;
					if(!next) break;

					const n_has_if   = next.hasAttribute("*if")      || next.hasAttribute("n-if");
					const n_has_elif = next.hasAttribute("*elseif")  || next.hasAttribute("n-elseif");
					const n_has_else = next.hasAttribute("*else")    || next.hasAttribute("n-else");
					const n_has_cond = n_has_if || n_has_elif || n_has_else;

					// 条件属性がない要素を挟んだらチェーン終端
					if(!n_has_cond) break;
					// 次の *if は「別チェーン」の先頭
					if(n_has_if) break;

					cur = next;
				}

				if(chain.length === 0) return;

				// 3) チェーンから採用枝を 1 つ決める
				let chosen_item  = null;
				let chosen_scope = null;

				for(const item of chain){
					// 各枝ごとのスコープ（*let があれば反映）
					let branchScope = effScope;
					const branchLet = item.el.getAttribute("*let") || item.el.getAttribute("n-let");
					if(branchLet){
						const bs = Object.assign(Object.create(branchScope), branchScope);
						this.eval_let(branchLet, bs, { el: item.el, mode: "let@if-branch" });
						branchScope = bs;
					}

					if(item.type === "else"){
						// ここまで一度もヒットしていないなら else を採用
						if(!chosen_item){
							chosen_item  = item;
							chosen_scope = branchScope;
						}
						break;
					}

					// if / elseif の評価
					let srcAttr = "";
					if(item.type === "if"){
						srcAttr = item.el.hasAttribute("*if") ? "*if" : "n-if";
					}else{
						srcAttr = item.el.hasAttribute("*elseif") ? "*elseif" : "n-elseif";
					}
					const expr = item.el.getAttribute(srcAttr) || "";
					let ok = false;
					if(expr){
						const modeName = srcAttr.replace(/^(?:\*|n-)/,"");
						try{
							ok = !!_eval_cond(expr, branchScope, { el: item.el, mode: modeName });
						}catch(_e){
							ok = false;
						}
					}
					if(ok){
						chosen_item  = item;
						chosen_scope = branchScope;
						break;
					}
				}

				// 4) 採用枝がなければ何も描画しない
				if(!chosen_item) return;

				// 5) 採用した枝のクローンを 1 つだけ描画する
				const src_el = chosen_item.el;
				const outScope = chosen_scope || effScope;

				const clone = src_el.cloneNode(true);
				clone.removeAttribute("*if");      clone.removeAttribute("n-if");
				clone.removeAttribute("*elseif");  clone.removeAttribute("n-elseif");
				clone.removeAttribute("*else");    clone.removeAttribute("n-else");
				clone.removeAttribute("*let");     clone.removeAttribute("n-let");

				this.renderNode(clone, outScope, parent);

				// この node 自体は「テンプレート」としてのみ使われるので、ここで確定
				return;
			}
		}
		// 5.4) *switch / n-switch（JS ライクに“最初にヒットした地点から break まで”描画）
		{
			const switchAttr = work.getAttribute("*switch") || work.getAttribute("n-switch");
			if(switchAttr){
				this._renderSwitchBlock(work, effScope, parent);
				return; // ホスト自身は描画しない（子だけを出力）
			}
		}

		// each の評価順はここ。if の後（子要素の if は後で回る）
		// 5.5) *each / n-each（親は1回だけ、子ノード群を反復複製）
		// - JS の for...in / for...of 準拠で動作。
		//   * "in": key 列挙（for...in 相当、key のみ）
		//   * "of": 値列挙（for...of 相当、値または [key,value] ペア）
		// - (key,value) 形式で "in" を使うのは非推奨（"of" を使用すべき）。
		{
			const eachExpr = work.getAttribute("*each") || work.getAttribute("n-each");
			if(eachExpr){

				// *each と *include / *import の併記チェック
				// 現仕様では *each が優先され、同じ要素の *include / *import は実行されないため、
				// 利用者に分かるように warn を出しておく。
				if(
					work.hasAttribute("*include") || work.hasAttribute("n-include") ||
					work.hasAttribute("*import")  || work.hasAttribute("n-import")
				){
					if(this.error?.warn){
						console.warn("[Sercrod warn] *each and *include/*import cannot be used on the same element; *include/*import will be ignored.", work);
					}
				}

				const m = eachExpr.match(/^\s*\(?\s*(\w+)(?:\s*,\s*(\w+))?\)?\s*(in|of)\s+([\s\S]+?)\s*$/);
				if(m){
					const keyName = m[2] ? m[1] : null;   // KEY 変数名（配列なら index、オブジェクトならプロパティ名）
					const valName = m[2] ? m[2] : m[1];   // VAL 変数名（要素の値/オブジェクトの値）
					const modeWord = m[3];                // "in" または "of"
					const srcExpr  = m[4];

					if(modeWord === "in" && keyName) console.warn("[Sercrod warn] Using 'in' with key/value pairs is deprecated. Use 'of' instead when specifying (key, value).");

					let iterable = this.eval_expr(srcExpr, effScope, {el: work, mode:"each"}) || [];
					const entriesMode = !!keyName;

					const container = work.cloneNode(false);
					container.removeAttribute("*each");
					container.removeAttribute("n-each");
					const children = Array.from(work.childNodes);

					// --- of: for...of 相当（値列挙） ---
					if(modeWord === "of"){
						if(entriesMode){
							// (key, value) of array/object
							if(Array.isArray(iterable)){
								iterable = Array.from(iterable.entries()); // [[0,v],[1,v]...]
							}else if(typeof iterable==="object" && iterable!==null){
								iterable = Object.entries(iterable);
							}else{
								iterable = [];
							}
							for(const [k, v] of iterable){
								const s = {...effScope, [keyName]: k, [valName]: v};
								for(const c of children) this.renderNode(c, s, container);
							}
						}else{
							// value of array/object
							if(typeof iterable==="object" && iterable!==null && !Array.isArray(iterable)){
								iterable = Object.values(iterable);
							}
							for(const v of iterable){
								const s = {...effScope, [valName]: v};
								for(const c of children) this.renderNode(c, s, container);
							}
						}
					}

					// --- in: for...in 相当（キー列挙） ---
					else if(modeWord === "in"){
						for(const k in iterable){
							const s = {...effScope, [valName]: k};
							for(const c of children) this.renderNode(c, s, container);
						}
					}

					parent.appendChild(container);
					return;
				}
			}
		}
		// 6) 子 *for
		// - JS 構文に合わせて "in" / "of" を区別する。
		//   * "in": key 列挙（for...in 相当、key のみ）
		//   * "of": 値列挙（for...of 相当、値または [key,value] ペア）
		// - (key, value) 形式で "in" を使うのは非推奨（"of" を使用すべき）。
		{
			const forExpr = work.getAttribute("*for") || work.getAttribute("n-for");
			if(forExpr){
				const m = forExpr.match(/^\s*\(?\s*(\w+)(?:\s*,\s*(\w+))?\)?\s*(in|of)\s+([\s\S]+?)\s*$/);
				if(m){
					const keyName = m[2] ? m[1] : null;   // (key,value) の key
					const valName = m[2] ? m[2] : m[1];   // value または単一変数
					const modeWord = m[3];                // "in" または "of"
					const srcExpr  = m[4];

					if(modeWord === "in" && keyName) console.warn("[Sercrod warn] Using 'in' with key/value pairs is deprecated. Use 'of' instead when specifying (key, value).");

					let iterable = this.eval_expr(srcExpr, effScope, {el: work, mode:"for"}) || [];

					// --- of: JS の for...of 相当（値列挙） ---
					if(modeWord === "of"){
						if(Array.isArray(iterable)){
							// (key,value) of array
							if(keyName){
								for(const [k, v] of iterable.entries()){
									const unit = work.cloneNode(true);
									unit.removeAttribute("*for");
									unit.removeAttribute("n-for");
									this.renderNode(unit, {...effScope, [keyName]: k, [valName]: v}, parent);
								}
							}else{
								// value of array
								for(const v of iterable){
									const unit = work.cloneNode(true);
									unit.removeAttribute("*for");
									unit.removeAttribute("n-for");
									this.renderNode(unit, {...effScope, [valName]: v}, parent);
								}
							}
						}else if(iterable && typeof iterable === "object"){
							// (key,value) of object
							for(const [k, v] of Object.entries(iterable)){
								const unit = work.cloneNode(true);
								unit.removeAttribute("*for");
								unit.removeAttribute("n-for");
								this.renderNode(unit, {...effScope, [keyName || "key"]: k, [valName]: v}, parent);
							}
						}
					}

					// --- in: JS の for...in 相当（キー列挙） ---
					// 後方互換：単一変数なら「キー」を束縛、(key,value) 指定なら key と value を束縛
					else if(modeWord === "in"){
						for(const k in iterable){
							const unit = work.cloneNode(true);
							unit.removeAttribute("*for");
							unit.removeAttribute("n-for");
							if(keyName){
								// (key,value) in X なら両方束縛
								this.renderNode(unit, {...effScope, [keyName]: k, [valName]: iterable[k]}, parent);
							}else{
								// 単一変数 in X は **キー** を束縛（JS 準拠）
								this.renderNode(unit, {...effScope, [valName]: k}, parent);
							}
						}
					}

					return;
				}
			}
		}

		// Sercrod（カスタム要素）判定は構造系の“後ろ”で行い、ここで早期 return。
		// 「*if で落とすべき要素が _isSercrod による早期 return で素通りする」問題を防止。
		// 「Sercrod である／Sercrod になる予定か」を判定
		// - カスタム要素がまだアップグレード前でも customElements.get で予定を検知可能。
		if(this._isSercrod(node)){
			//const el = node.cloneNode(true);
			const el = document.importNode(node, true);	// そのまま clone のままでも可
			const needsUpgrade = !(el instanceof Sercrod);
			if(needsUpgrade){
				console.warn("[Sercrod diag] forcing upgrade:", el);
				try{ customElements.upgrade(el); }catch{}
			}
			if(el.__sercrod_scope===undefined && !el.hasAttribute("data")) el.__sercrod_scope = effScope; // scope->effScope（*let 反映後のスコープを優先）
			this.add_flag(el, "sercrod"); // ここでも付けておく
			parent.appendChild(el);
			return; // CE はここで確定
		}

		// ---------------------------------------
		// 非構造系（多重適用／returnしない）? ここから下は *if 通過後に適用
		// ---------------------------------------

		// 4) *apply（*stage の値を本体 _data に確定）
		// - ワークバッファ _stage -> 確定領域 _data への反映ボタン等の実装に利用。
		if(work.hasAttribute("*apply") || work.hasAttribute("n-apply")){
			const el = work.cloneNode(true);
			el.addEventListener("click", ()=>{
				if(this._stage){
					Object.assign(this._data, this._stage);
					this.update(); // 確定後に再描画
					// apply 直後のスナップショットを保存（以降の restore で利用）
					try{ this._applied = structuredClone(this._data); }
					catch(e){ this._applied = JSON.parse(JSON.stringify(this._data)); }
				}
			});
			parent.appendChild(el);
			return;
		}

		// 5) *restore（*stage を復元して元データに戻す）
		// - 直前の apply スナップショットがあればそこへ巻き戻し、なければ _data をベースにする。
		if(work.hasAttribute("*restore") || work.hasAttribute("n-restore")){
			const el = work.cloneNode(true);
			el.addEventListener("click", ()=>{
				if(this.hasAttribute("*stage") || this.hasAttribute("n-stage")){
					// apply 直後のスナップショットがあれば利用
					const base = this._applied ?? this._data; // 初回は_data
					try{ this._stage = structuredClone(base); }
					catch(e){ this._stage = JSON.parse(JSON.stringify(base)); }
					this.update();
				}
			});
			parent.appendChild(el);
			return;
		}

		// 8) *save
		// - _stage があれば優先して対象にし、無ければ _data を保存。
		// - props で指定時は部分更新、未指定時はトップレベルで Object.assign。
		if(work.hasAttribute("*save") || work.hasAttribute("n-save")){
			const el = work.cloneNode(true);
			el.addEventListener("click", ()=>{
				const attr = work.getAttribute("*save") ?? work.getAttribute("n-save") ?? "";
				const props = attr.trim() ? attr.trim().split(/\s+/) : null;
				const src = this._stage ?? this._data;
				let data;
				if(props){
					data = {};
					for(const p of props){
						if(p in src) data[p] = src[p];
					}
				}else{
					data = src;
				}
				const jsonStr = JSON.stringify(data, null, 2);
				const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				const now = new Date();
				const y = now.getFullYear();
				const m = String(now.getMonth()+1).padStart(2,"0");
				const d = String(now.getDate()).padStart(2,"0");
				const hh = String(now.getHours()).padStart(2,"0");
				const mm = String(now.getMinutes()).padStart(2,"0");
				const ss = String(now.getSeconds()).padStart(2,"0");
				const ts = `${y}${m}${d}-${hh}${mm}${ss}`;

				// ファイル名
				const fileName = `Sercrod-${ts}.json`;
				a.download = fileName;

				document.body.appendChild(a);	//旧ブラウザ対策
				a.click();
				document.body.removeChild(a);	//旧ブラウザ対策
				URL.revokeObjectURL(a.href);     //片付け
				// ---- sercrod-saved フック ----
				// ※ ブラウザは実ダウンロードの完了通知を持たないため、「ファイル生成＆ダウンロード開始後」に発火します。
				this.dispatchEvent(new CustomEvent("sercrod-saved", {
					detail: {
						stage: "save",
						host: this,
						fileName,
						props: props || null,
						json: jsonStr
					},
					bubbles: true,
					composed: true
				}));
			});
			parent.appendChild(el);
			return;
		}
		// 9.1) *load
		// - JSON ファイルを input[type=file] で読み込み、_stage または _data へマージ反映。
		// - props 指定時は部分更新、未指定時はトップレベルで Object.assign。
		if(work.hasAttribute("*load") || work.hasAttribute("n-load")){
			const el = work.cloneNode(true);
			const attr  = work.getAttribute("*load") ?? work.getAttribute("n-load") ?? "";
			const props = attr.trim() ? attr.trim().split(/\s+/) : null;
			const wantAccept = work.getAttribute("accept") || "application/json";

			// 共通: 取得した File を読み込んで data/_stage に反映
			const handleFile = (file)=>{
				if(!file) return;
				const reader = new FileReader();
				reader.onload = ()=>{
					try{
						const json = JSON.parse(reader.result);
						if(props){
							for(const p of props){
								if(this._stage) this._stage[p] = json[p];
								else this._data[p] = json[p];
							}
						}else{
							if(this._stage) Object.assign(this._stage, json);
							else Object.assign(this._data, json);
						}
						this.dispatchEvent(new CustomEvent("sercrod-loaded", {
							detail: {
								stage: "load",
								host:this,
								fileName: file?.name || null,
								props: props || null,
								json
							},
							bubbles:true, composed:true
						}));
						this.update();
					}catch(e){
						if(this.error.warn) console.warn("[Sercrod warn] *load JSON parse:", e);
					}
				};
				reader.readAsText(file);
			};

			const isFileInput = el.tagName==="INPUT" && (el.getAttribute("type")||"").toLowerCase()==="file";
			if(isFileInput){
				// ネイティブ <input type="file"> をそのまま使う（ダイアログはブラウザに任せる）
				if(!el.hasAttribute("accept")) el.setAttribute("accept", wantAccept);
				el.addEventListener("change", ()=>{
					const file = el.files && el.files[0];
					handleFile(file);
				});
			}else{
				// ボタン等 -> 隠し input を作って click
				el.addEventListener("click", ()=>{
					const input = document.createElement("input");
					input.type = "file";
					input.accept = wantAccept;
					input.addEventListener("change", ()=>{
						const file = input.files && input.files[0];
						handleFile(file);
					});
					input.click();
				});
			}
			parent.appendChild(el);
			return;
		}

		// 9.3) *post
		// *post / n-post  : JSONデータを指定URLへPOST送信
		// 9.3) *post
		// *post / n-post  : JSONデータを指定URLへPOST送信し、応答を data に書き戻す
		if(work.hasAttribute("*post") || work.hasAttribute("n-post")){
			const el = work.cloneNode(true);

			// *api と同じ状態フラグを共有できるよう、初回に最低限のスロットを用意しておく
			if(this._data.$pending === undefined) this._data.$pending = false;
			if(this._data.$error   === undefined) this._data.$error   = null;
			if(this._data.$download === undefined) this._data.$download = null;
			if(this._data.$upload   === undefined) this._data.$upload   = null;

			el.addEventListener("click", async ()=>{
				// 属性値は "URL[:prop]" 形式を前提とする（prop は省略可）
				const spec_raw = work.getAttribute("*post") ?? work.getAttribute("n-post") ?? "";
				const spec     = spec_raw ? spec_raw.trim() : "";
				if(!spec){
					if(this.error.warn) console.warn("[Sercrod warn] *post requires a URL path");
					return;
				}
				const parts    = spec.split(":");
				const url      = (parts[0] || "").trim();
				const prop     = (parts[1] || "").trim();
				if(!url){
					if(this.error.warn) console.warn("[Sercrod warn] *post requires a URL path");
					return;
				}

				// 対象データ（stage があれば優先して送信元にする）
				const src = this._stage ?? this._data;
				let json_str = "";
				try{
					json_str = JSON.stringify(src, null, 2);
				}catch(e){
					if(this.error.warn) console.warn("[Sercrod warn] *post JSON stringify:", e);
					return;
				}

				// 送信中フラグの制御は *api と同じ形に合わせる
				const start = ()=>{ this._data.$pending = true; this._data.$error = null; this.update(false); };
				const stop  = ()=>{ this._data.$pending = false; this.update(false); };

				// 送信前イベント（URL と合わせて spec/prop も公開しておく）
				this.dispatchEvent(new CustomEvent("sercrod-post-start", {
					detail: {
						stage: "post",
						host: this,
						url,
						spec,
						prop,
						json: json_str
					},
					bubbles: true,
					composed: true
				}));

				start();
				try{
					const res = await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: json_str
					});

					// Content-Type を見て JSON 優先で value を決める（*api に寄せる）
					let value;
					let text;
					const ct = (res.headers.get("Content-Type") || "").toLowerCase();
					if(ct.includes("application/json")){
						value = await res.json();
						// 応答テキストはイベント用に文字列へ整形しておく
						try{ text = typeof value === "string" ? value : JSON.stringify(value); }
						catch(_){ text = String(value); }
					}else{
						text = await res.text();
						try{ value = JSON.parse(text); }
						catch(_){ value = text; }
					}

					// 書き込み系なので $upload にも格納しておく
					this._data.$upload = value;

					// data への反映ルールは *fetch と同等（prop あり: 部分更新 / prop なし: 丸ごと置換）
					const touched_paths = [];
					if(prop){
						const m = prop.match(/(.+?)\[(.+)\]/);
						if(m){
							const base = m[1];
							const key  = m[2];
							if(!this._data[base] || typeof this._data[base] !== "object"){
								this._data[base] = {};
							}
							this._data[base][key] = value;
							touched_paths.push(`${base}[${key}]`);
						}else{
							this._data[prop] = value;
							touched_paths.push(prop);
						}
					}else{
						// 丸ごと置換だけは監視ラッパーを再構築する
						this._data = this._wrap_data(value);
						touched_paths.push("$root");
					}

					this.dispatchEvent(new CustomEvent("sercrod-posted", {
						detail: {
							stage: "post",
							host: this,
							url,
							spec,
							prop,
							status: res.status,
							response: text,
							value,
							json: json_str,
							paths: touched_paths
						},
						bubbles: true,
						composed: true
					}));
				}catch(err){
					this._data.$error = { code: "POST", message: String(err) };
					this.dispatchEvent(new CustomEvent("sercrod-post-error", {
						detail: {
							stage: "post",
							host: this,
							url,
							spec,
							prop,
							error: String(err)
						},
						bubbles: true,
						composed: true
					}));
					if(this.error.warn) console.warn("[Sercrod warn] *post failed:", err);
				}finally{
					stop();
				}
			});
			parent.appendChild(el);
			return;
		}

		// ============================================================
		//  *api / n-api  …… API 呼び出しの窓口はこれひとつ
		//  *into / n-into … 受け皿の変数名（必須 / *api 専用）
		//
		//  原則：
                //    - 応答は変形しない（配列/オブジェクト/プリミティブをそのまま格納）
                //    - GET 系は $download、書き込み系は $upload にも置く（状態把握用）
                //    - *into が無ければ実行しない（事故ゼロ）
                //    - <input type="file" *api> は FormData で自動アップロード
                //    - 自動発火は「同一 (method,url,into,bodyHash)」につき 1 回だけ
                // ============================================================
                if(work.hasAttribute("*api") || work.hasAttribute("n-api")){
                        const el      = work.cloneNode(false);
                        const urlRaw  = work.getAttribute("*api") ?? work.getAttribute("n-api") ?? "";
                        // *let などでローカルに上書きされた値も拾えるように、展開時は effScope を使う
                        const resolveUrl = () => this._expand_text(urlRaw, effScope, work); // 実行時に都度展開
			const method  = (work.getAttribute("method") || "GET").toUpperCase();
			const into    = work.getAttribute("*into") ?? work.getAttribute("n-into") ?? "";
			const bodyExp = work.getAttribute("body")  || work.getAttribute("payload") || "";
			const isFile  = el.tagName==="INPUT" && (el.getAttribute("type")||"").toLowerCase()==="file";

			// --- 初期化: 初回でも参照できるよう“未宣言”を避ける ---
			if(this._data.$pending === undefined) this._data.$pending = false;
			if(this._data.$error   === undefined) this._data.$error   = null;
			//if (method === "GET") {
			//	if (this._data.$download === undefined) this._data.$download = null;
			//} else {
			//	if (this._data.$upload   === undefined) this._data.$upload   = null;
			//}
			// $download / $upload は *into の有無に関係なく常に存在させる
			if(this._data.$download  === undefined) this._data.$download  = null;
			if(this._data.$upload    === undefined) this._data.$upload    = null;
			if(into && this._data[into] === undefined) this._data[into] = null;

			parent.appendChild(el);

			// *into は任意。常に $download/$upload は更新し、into があればそこにも置く
			const place = (value)=>{
				if (isFile || method !== "GET") this._data.$upload = value;
				else this._data.$download = value;
				if(into){
					this._data[into] = value;
					this._intos.push(into);
				}
			};

			// 状態フラグを共有（読み取り専用で使う想定）
			const start = ()=>{ this._data.$pending = true; this._data.$error = null;  this.update(false); };
			const stop  = ()=>{ this._data.$pending = false; this.update(false); };
			const dispatch = (name, detail)=> {
				try{ el.dispatchEvent(new CustomEvent(name, { detail, bubbles:true, composed:true })); }
				catch(_){}
			};

			// 非ファイル：GET/POST 系
			const runJsonLike = async ()=>{
				const url = resolveUrl();  // クリック毎に最新URL（ts更新）
				start();
				try{
					let bodyVal = null;
					if(bodyExp && method!=="GET"){
						try{ bodyVal = this.eval_expr(bodyExp, scope, {el:work, mode:"body"}); }catch(_){}
					}
					const init = { method };
					if(method!=="GET" && bodyVal!=null){
						init.headers = { "Content-Type": "application/json" };
						init.body    = JSON.stringify(bodyVal);
					}
					const res = await fetch(url, init);
					let value, text;
					const ct = (res.headers.get("Content-Type")||"").toLowerCase();
					if(ct.includes("application/json")){
						value = await res.json();
					}else{
						text = await res.text();
						try{ value = JSON.parse(text); }catch{ value = text; }
					}
					place(value);
					dispatch("sercrod-api", { url, method, status:res.status, into, value });
				}catch(err){
					this._data.$error = { code:"API", message:String(err) };
					dispatch("sercrod-error", { url, method, into, error:String(err) });
				}finally{ stop(); }
			};

			// ファイル：<input type="file" *api>
			const runUpload = async (files)=>{
				const url = resolveUrl();  // アップロード時もその場のURL
				start();
				try{
					const fd = new FormData();
					const field = el.getAttribute("name") || "files[]";
					for(const f of files) fd.append(field, f);
					const res = await fetch(url, { method:(method==="GET"?"POST":method), body: fd });
					let value, text;
					const ct = (res.headers.get("Content-Type")||"").toLowerCase();
					if(ct.includes("application/json")){
						value = await res.json();
					}else{
						text = await res.text();
						try{ value = JSON.parse(text); }catch{ value = text; }
					}
					place(value);
					dispatch("sercrod-api", { url, method:"POST(FORMDATA)", status:res.status, into, value });
				}catch(err){
					this._data.$error = { code:"UPLOAD", message:String(err) };
					dispatch("sercrod-error", { url, method:"POST(FORMDATA)", into, error:String(err) });
				}finally{ stop(); }
			};

			// 自動発火は「同一 (method,url,into,bodyHash) につき 1 回だけ」
			const bodyHash = (()=>{ try{ return bodyExp ? JSON.stringify(this.eval_expr(bodyExp, scope, {el:work, mode:"body"})) : ""; }catch(_){ return ""; }})();
			// 自動発火の重複防止キーは ts を除外して安定化
			const makeAutoOnceKey = () => {
				let u;
				try { u = new URL(resolveUrl(), location.href); } catch(_){}
				let dedup = "";
				if (u) {
					u.searchParams.delete("ts");
					dedup = u.pathname + (u.search ? "?" + u.searchParams.toString() : "");
				} else {
					dedup = resolveUrl().replace(/([?&])ts=[^&]*/g, "").replace(/[?&]$/, "");
				}
				return `${method} ${dedup} :: ${into} :: ${bodyHash}`;
			};

                        const tag  = el.tagName.toUpperCase();
                        const type = (el.getAttribute("type")||"").toLowerCase();
                        const isClickable = tag==="BUTTON" || (tag==="A" && !el.hasAttribute("download")) || (tag==="INPUT" && ["button","submit","reset"].includes(type));

                        // *print / n-print のようなテキスト出力系も *api と併用できるようにする
                        const tryApplyText = ()=>{
                                if(el.hasAttribute("*print") || el.hasAttribute("n-print") || el.hasAttribute("*textContent") || el.hasAttribute("n-textContent")){
                                        const norm = this.normalizeTpl ? (s)=>this.normalizeTpl(s) : (s)=>s;
                                        const srcAttr = el.hasAttribute("*print") ? "*print" : el.hasAttribute("n-print") ? "n-print" : el.hasAttribute("*textContent") ? "*textContent" : "n-textContent";
                                        try{
                                                let expr = el.getAttribute(srcAttr);
                                                expr = norm(expr);
                                                const v = this.eval_expr(expr, scope, {el: work, mode: srcAttr.replace(/^\*/,"")});
                                                const raw = (v==null || v===false) ? "" : v;
                                                el.textContent = this.constructor._filters.text(raw, {el, expr, scope});
                                                if(this.constructor._config.cleanup.directives){
                                                        el.removeAttribute("*print");
                                                        el.removeAttribute("n-print");
                                                        el.removeAttribute("*textContent");
                                                        el.removeAttribute("n-textContent");
                                                }
                                        }catch(_){ el.textContent = ""; }
                                        return true;
                                }
                                return false;
                        };
                        const skipChildren = tryApplyText();

                        if (isFile) {
                                el.addEventListener("change", ()=>{
                                        const files = el.files ? Array.from(el.files) : [];
                                        if(files.length) runUpload(files);
                                });
			} else if (isClickable) {
				// クリック系は自動発火しない（明示トリガ）
				el.addEventListener("click", ()=> runJsonLike());
			} else {
				// 非クリック要素のみ初回自動発火。ts等は除外して一度きりにする
				const onceKey = makeAutoOnceKey();
                                if(!this.__apiOnce.has(onceKey)){
                                        this.__apiOnce.add(onceKey);
                                        requestAnimationFrame(runJsonLike);
                                }
                        }
                        // 子要素は通常描画（*for/*if 等で into 変数や $pending を参照できる）
                        if(!skipChildren) node.childNodes.forEach(c => this.renderNode(c, scope, el));
                        return;
                }

		// *upload: 「式文字列」を取り出して _bind_upload に渡す
		//  - expr は effScope（*let 反映後のスコープ）で評価させるため、
		//    バインダにスコープも一緒に渡す
		//  - 子ノードも描画してボタンラベル等を表示する
		if(work.hasAttribute("*upload") || work.hasAttribute("n-upload")){
			const el   = work.cloneNode(false);
			const expr = work.getAttribute("*upload") ?? work.getAttribute("n-upload") ?? "";
			this._bind_upload(el, expr, effScope, work); // scope と eval 用 el を明示
			parent.appendChild(el);
			node.childNodes.forEach(c => this.renderNode(c, effScope, el));
			return;
		}
		// *download: 同上（式 + スコープを渡す、子ノードも描画）
		if(work.hasAttribute("*download") || work.hasAttribute("n-download")){
			const el   = work.cloneNode(false);
			const expr = work.getAttribute("*download") ?? work.getAttribute("n-download") ?? "";
			this._bind_download(el, expr, effScope, work);
			parent.appendChild(el);
			node.childNodes.forEach(c => this.renderNode(c, effScope, el));
			return;
		}
		// *websocket / n-websocket（要素版）
		if(work.hasAttribute("*websocket") || work.hasAttribute("n-websocket")){
			const el    = work.cloneNode(false);
			const raw   = work.getAttribute("*websocket") ?? work.getAttribute("n-websocket") ?? "";
			const into  = work.getAttribute("*into") ?? work.getAttribute("n-into") ?? "";
			parent.appendChild(el);

			const spec  = this._resolve_ws_spec(raw, scope, work);
			const url   = spec?.url || "";
			const dest  = into || spec?.into || "";

			const tag   = el.tagName.toUpperCase();
			const type  = (el.getAttribute("type")||"").toLowerCase();
			const clickable = tag==="BUTTON" || (tag==="A" && !el.hasAttribute("download"))
				|| (tag==="INPUT" && ["button","submit","reset"].includes(type));

			const connect = ()=>{
				if(!url || this._has_placeholders(url)){
					if(this.error?.warn) console.warn("[Sercrod warn] *websocket(el): URL not expanded", {raw, url});
					return;
				}
				this._ws_connect(url, dest, el);
			};
			if(clickable) el.addEventListener("click", connect);
			else requestAnimationFrame(connect); // 自動接続（1 回）

			node.childNodes.forEach(c => this.renderNode(c, scope, el)); // 子は通常描画
			return;
		}

		// *ws-send / n-ws-send
		if(work.hasAttribute("*ws-send") || work.hasAttribute("n-ws-send")){
			const el    = work.cloneNode(false);
			const expr  = work.getAttribute("*ws-send") ?? work.getAttribute("n-ws-send") ?? "";
			const toRaw = work.getAttribute("*ws-to") ?? work.getAttribute("n-ws-to") ?? "";
			parent.appendChild(el);

			const tag   = el.tagName.toUpperCase();
			const type  = (el.getAttribute("type")||"").toLowerCase();
			const clickable = tag==="BUTTON" || (tag==="A" && !el.hasAttribute("download"))
				|| (tag==="INPUT" && ["button","submit","reset"].includes(type));

			const resolveTo = ()=> toRaw ? this._expand_text(toRaw, scope, work) : "";

			// ws-send 自体のクリック送信
			if(clickable){
				el.addEventListener("click", e=>{
					const payload = this.eval_expr(expr, scope, {el: work, mode: "ws-send", $event: e});
					this._ws_send(resolveTo(), payload);
				});
			}

			// 同じ要素に付いている @click / @submit などもここで処理する
			if(work.hasAttributes()){
				const attrs = Array.from(work.attributes);
				for(const attr of attrs){
					// events.prefix はたとえば "@"
					if(attr.name.startsWith(this.constructor._config.events.prefix)){
						this._renderEvent(el, attr, scope);
					}
				}
			}

			// 子ノードはこれまでどおり
			node.childNodes.forEach(c => this.renderNode(c, scope, el));
			return;
		}

		// 10) 上記いずれでもなければ「通常要素」として 1 個描画
		this._renderElement(work, effScope, parent);
	}

	// --- *switch（フォールスルー実装） ---
	// 仕様：
	//  - *switch の評価結果を $switch として子スコープへ注入
	//  - 子ノードを DOM 順に走査し、最初にヒットした *case / *default から描画開始
	//  - 以降は break（*break / n-break / *case.break / n-case.break）が出るまで「落下」して描画継続
	_renderSwitchBlock(node, scope, parent){
		// switch 値を評価
		const switchVal = this.eval_expr(
			node.getAttribute("*switch") || node.getAttribute("n-switch"),
			scope,
			{ el: node, mode:"switch" }
		);
		// 子に渡すスコープ（$switch を注入）
		const childScope = { ...scope, $switch: switchVal };

		let falling = false; // 描画開始済み（フォールスルー中）フラグ

		const children = Array.from(node.childNodes);
		for(const c of children){
			if(c.nodeType !== 1) continue; // 要素ノードのみ

			const isDefault =
				c.hasAttribute("*default") || c.hasAttribute("n-default");

			// case の式（*case / n-case / *case.break / n-case.break のいずれか）
			//   1) *case.break="expr"      （糖衣構文: 条件 + break）
			//   2) *case="expr" *break     （属性併記）
			let caseRaw = null;
			if(c.hasAttribute("*case"))             caseRaw = c.getAttribute("*case");
			else if(c.hasAttribute("n-case"))       caseRaw = c.getAttribute("n-case");
			else if(c.hasAttribute("*case.break"))  caseRaw = c.getAttribute("*case.break");
			else if(c.hasAttribute("n-case.break")) caseRaw = c.getAttribute("n-case.break");

			// case/default 以外は無視
			if(!isDefault && caseRaw==null) continue;

			// まだ開始していなければ、開始条件を判定
			if(!falling){
				if(isDefault){
					// どこにも当たっていなければ default で開始
					falling = true;
				}else{
					// 既存の _matchCase を活用（多様な書式に対応）
					if(this._matchCase(caseRaw, switchVal, childScope, c)){
						falling = true;
					}else{
						// 開始しないのでスキップ
						continue;
					}
				}
			}

			// falling 中：このノードを描画
			const clone = c.cloneNode(true);
			// 制御用属性はコピー側から剥がす（通常描画に影響させない）
			clone.removeAttribute("*case");           clone.removeAttribute("n-case");
			clone.removeAttribute("*default");        clone.removeAttribute("n-default");
			clone.removeAttribute("*case.break");     clone.removeAttribute("n-case.break");
			clone.removeAttribute("*break");          clone.removeAttribute("n-break");
			this._renderElement(clone, childScope, parent);

			// break 検知でフォールスルー終了
			const hasBreak =
				c.hasAttribute("*break") || c.hasAttribute("n-break") ||
				c.hasAttribute("*case.break") || c.hasAttribute("n-case.break");

			if(hasBreak) break; // default まで回らない
		}
	}
	// 単一要素を描画する本体。
	//    - 属性バインディング（:class / :style / :id / :value など）
	//    - n-input（双方向）
	//    - *print *textContent / *compose *innerHTML / n-print n-textContent / n-compose n-innerHTML
	//    - テキスト内 %expr% 展開
	//    - 子ノードの再帰レンダリング
	//    - <select> の選択復元（child 描画後に postApply で同期）
	_renderElement(node, scope, parent){

		// --- 子 Sercrod は親で中身をレンダリングしない（自分で描かせる） ---
		if (this._isSercrod(node)) {
			//const el = node.cloneNode(true); // テンプレートごと渡す（子が自前で再評価）
			const el = document.importNode(node, true); // ここも importNode を使う
			//if (el.__sercrod_scope === undefined && !el.hasAttribute("data")) {
			//	el.__sercrod_scope = scope;     // 反復スコープを注入
			//}
			//this.add_flag(el, "sercrod");     // 伝播更新用のフラグ
			//parent.appendChild(el);
			//return; // ここで終了。以下の属性/子レンダは CE 自身に任せる
			// 親スコープを安全に引き継ぐ（effScope 優先）
			if (el.__sercrod_scope === undefined && !el.hasAttribute("data")) {
				// Proxy の多重化を避けつつ、親 world の参照を保持
				el.__sercrod_scope = this.constructor._proxy_map.has(scope) ? scope : this._wrap_data(scope);
			}
			// world 継承情報を一時的に保持（SubSercrod用）
			el.__sercrod_world = this.constructor;
			this.add_flag(el, "sercrod");
			parent.appendChild(el);
			return;
		}

		// sercrod フラグのつけ忘れを阻止
		// - 親が Sercrod であれば "sercrod" フラグを付与してインデックスに反映可能に
		if(this._isSercrod(parent)) this.add_flag(parent, "sercrod");

		// ベース要素を浅いコピーで作成（子はまだ描かない）
		const el = node.cloneNode(false);

		// el では判定できないので、node で Sercrod 判定をしておく
		if(this._isSercrod(el)) this.add_flag(el, "sercrod");

		// ここでフラグ登録だけ行う（警告はまだ実装しない）
		// - * / @ / : で始まる属性名をフラグとして採取し、_rebuild_flag_index で逆引き可能にする
		const found_flags = this._collect_flags_from(node);
		for(const f of found_flags) this.add_flag(el, f);

		// head 内にそのまま流し込みたいタグをスペース区切りで列挙
		//for(const tag of "title link meta base".split(" ")) if(node.tagName === tag.toUpperCase() || node.localName === tag) this._head_nodes.push(el);

		// 子描画後に同期適用したい処理を後回しにするためのフック
		// - 例: <select> の option 描画後に選択状態を反映、radio/checkbox の checked 復元など
		let postApply = null;

		// ---------------------------------------------
		//  *template / n-template と *include / n-include
		// ---------------------------------------------

		// ---------------------------------------------
		// *template / n-template
		// 役割: 原本（クローン元）の宣言・登録のみ。描画はしない（スキップ）。
		// ---------------------------------------------
		if(node.hasAttribute("*template") || node.hasAttribute("n-template")){
			const raw_attr  = node.getAttribute("*template") ?? node.getAttribute("n-template") ?? "";
			const raw_text  = String(raw_attr).trim();
			const is_bare   = /^[A-Za-z_][\w-]*$/.test(raw_text) &&
				!(raw_text.startsWith("'") || raw_text.startsWith("\""));

			// 共通ヘルパーでテンプレ名を解決
			const name = this._resolve_template_name(raw_text, scope, {
				el: node,
				mode: "template"
			});

			if(!name){
				if(this.error?.warn) console.warn("[Sercrod warn] *template: empty or invalid name:", raw_text);
				return;
			}

			if(this._template_registry.has(name)){
				if(this.error?.warn) console.warn("[Sercrod warn] *template duplicated:", name);
				return;
			}

			// 原本を deep clone で保管（評価・描画はしない）
			const proto = node.cloneNode(true);
			this._template_registry.set(name, proto);
			this._template_attr_snapshot.set(proto, {
				inert:      !!(proto.hasAttribute && proto.hasAttribute("inert")),
				hidden:     !!(proto.hasAttribute && proto.hasAttribute("hidden")),
				ariaHidden: (proto.getAttribute && proto.getAttribute("aria-hidden"))
			});

			// 原本は描画しない
			return;
		}

		// ---------------------------------------------
		// *include / n-include
		// 役割: 指定テンプレートの「子ノード群」をこの要素の中身として差し込む
		// ---------------------------------------------
		// *include / n-include
		// 役割:
		//   - テンプレート名で指定された *template の「中身(innerHTML)」だけを、この要素の innerHTML に差し込む。
		//   - 自身のタグや属性はそのまま残し、中身だけを差し替える「部分テンプレート include」用ディレクティブ。
		//
		// 設計ポイント:
		//   - 名前解決ルールは *template と揃える。
		//     1) 素の識別子なら scope 優先（例: *include="myTpl"）
		//     2) それ以外（式など）は eval_expr で評価（quiet）
		//     3) それでも決まらない場合、「同名テンプレ」があれば暗黙採用
		//   - bare identifier（template など）のときは eval_expr を呼ばない。
		//     → "template is not defined" のようなノイズ warn を出さないため。
		//   - テンプレが見つからなかった場合のみ warn を出す。
		//   - 一度適用したら *include / n-include 属性を削除し、次回以降の再評価ループを防ぐ。
		//
                // *include / n-include
                // 役割:
                //   - *template で宣言されたテンプレートの「中身(innerHTML)」だけを、
                //     この要素の innerHTML に差し込む。
                //
                // 評価ルール (決定版):
                //   raw_text = *include の値として、
                //
                //   1) bare identifier（例: template, tpl_a, tpl-a）
                //        - eval_expr は呼ばない
                //        - scope にあれば scope[raw_text] を name として採用
                //        - scope に無くても、同名テンプレがあれば raw_text を name として採用
                //        - 最終的に name が空、もしくは name でテンプレが見つからなければ
                //          → 「template not found: <名前>」で warn
                //
                //   2) 単純なクォート付きリテラル（例: 'a', "card"）
                //        - eval_expr は呼ばない
                //        - クォート内の文字列をそのまま name として採用（'a' → a）
                //        - name でテンプレが見つからなければ
                //          → 「template not found: <名前>」で warn
                //
                //   3) 上記以外（式: base + '_x' など）
                //        - eval_expr(raw_text, scope, {mode:"include", quiet:true}) で評価
                //        - 結果 name でテンプレ検索
                //        - name が空 or テンプレが見つからなければ
                //          → 「template not found: <label>」で warn
                //
                // ポイント:
                //   - 「本当にどの world にもテンプレが無い」場合は、必ず warn する。
                //   - 一方、bare identifier / リテラルでは eval_expr を使わないので、
                //     "template is not defined" のような JS レベルの warn は出ない。
                //
                if(node.hasAttribute("*include") || node.hasAttribute("n-include")){
                        const raw_text = (node.getAttribute("*include") ?? node.getAttribute("n-include") ?? "").trim();

			const cfg_include = (this.constructor._config && this.constructor._config.include) || {};
			const max_depth = typeof this._include_max_depth === "number"
				? this._include_max_depth
				: (typeof cfg_include.max_depth === "number" ? cfg_include.max_depth : 16);

			// 直近の *include の depth を WeakMap 経由で取得
			const parent_depth = this._get_nearest_include_depth(node);
			const depth = parent_depth + 1;

			this._include_depth_map.set(node, depth); // このノードは depth 段目の *include

			if(depth > max_depth){
				if(cfg_include.warn_on_element){
					el.setAttribute("sercrod-include-depth-overflow", String(max_depth));
					el.removeAttribute("*include");
					el.removeAttribute("n-include");
					parent.append(el);
				}
				//node.removeAttribute("*include");
				//node.removeAttribute("n-include");
				return;
			}

                        // 何も書かれていなければ、属性を消して終了（ここは単純な書き忘れ）
                        if(!raw_text){
                                node.removeAttribute("*include");
                                node.removeAttribute("n-include");
                                return;
                        }

                        // bare identifier 判定
                        const is_ident =
                                /^[A-Za-z_][\w-]*$/.test(raw_text) &&
                                !(raw_text.startsWith("'") || raw_text.startsWith("\""));

                        // 単純なクォート付きリテラル（'a' / "a"）判定
                        let literal_name = null;
                        {
                                const m = raw_text.match(/^(['"])(.*)\1$/);
                                if(m) literal_name = m[2].trim(); // クォート内の中身
                        }

			// --- テンプレ名の解決 ---
			const name = this._resolve_template_name(raw_text, scope, {
				el: node,
				mode: "include"
			});

			if(!name){
				if(this.error?.warn){
					const label = raw_text;
					if(cfg_include.warn_on_element) node.setAttribute("sercrod-template-not-found", label);
					node.removeAttribute("*include");
					node.removeAttribute("n-include");
				}
				return;
			}

                        // name が決まっている場合、実際にテンプレを探す
                        let resolved = null;

                        // まず同一 world で検索
                        if(this._template_registry && this._template_registry.has(name)){
                                resolved = { proto: this._template_registry.get(name) };
                        }

                        // 無ければ親 world を遡る
                        if(!resolved && this._lookupTemplateNear){
                                resolved = this._lookupTemplateNear(name);
                        }

                        if(!resolved){
                                // どの world にもテンプレが無い場合は、必ず warn
                                if(this.error?.warn){
                                        const label = name || raw_text;
					// ディレクティブが擁立するタイミングの問題で、通常の出力時にも waring に出力されてしまう
					//（シンプルな *include にするためわざわざ warning にコーディングコストを費やす必要はない）
                                        //console.warn("[Sercrod warn] include: template not found:", label);
					if(this.constructor._config.include.warn_on_element) el.setAttribute("sercrod-template-not-found", label);
					el.removeAttribute("*include");
					el.removeAttribute("n-include");
					if(!this.constructor._config.include.remove_element_if_empty) parent.appendChild(el);
                                }
                                return;
                        }

                        const { proto } = resolved;

                        // テンプレ原本 proto の「中身」だけをこのノードの innerHTML にコピー
                        node.innerHTML = proto.innerHTML || "";

                        // 一過性属性としての *include / n-include を削除
                        el.removeAttribute("*include");
                        el.removeAttribute("n-include");
                        // return しない：このあと通常の子レンダリングで innerHTML 内の *if 等を処理させる
                }

                if(node.hasAttribute("*import") || node.hasAttribute("n-import")){
                        const raw_text = (node.getAttribute("*import") ?? node.getAttribute("n-import") ?? "").trim();

                        // include と同じ深さ管理（ループ防止）
                        const cfg_include = (this.constructor._config && this.constructor._config.include) || {};
                        const max_depth = typeof this._include_max_depth === "number"
                                ? this._include_max_depth
                                : (typeof cfg_include.max_depth === "number" ? cfg_include.max_depth : 16);

                        // 直近の *include / *import の depth を WeakMap 経由で取得
                        const parent_depth = this._get_nearest_include_depth(node);
                        const depth = parent_depth + 1;

                        this._include_depth_map.set(node, depth); // このノードは depth 段目の *import

                        if(depth > max_depth){
                                if(cfg_include.warn_on_element){
                                        el.setAttribute("sercrod-import-depth-overflow", String(max_depth));
                                        el.removeAttribute("*import");
                                        el.removeAttribute("n-import");
                                        parent.append(el);
                                }
                                return;
                        }

                        // 何も書かれていなければ、属性を消して終了（単純な書き忘れ）
                        if(!raw_text){
                                node.removeAttribute("*import");
                                node.removeAttribute("n-import");
                                return;
                        }

                        // ------------------------------
                        // URL 文字列の解決
                        //  - まず eval_expr で評価を試みる（変数・式対応）
                        //  - だめなら raw_text 自体が URL らしければそれを採用
                        // ------------------------------
                        let url = "";
                        try{
                                const eva = this.eval_expr(raw_text, scope, {
                                        el: node,
                                        mode: "import",
                                        quiet: true
                                });
                                if(eva !== null && eva !== undefined){
                                        const s = String(eva).trim();
                                        if(s) url = s;
                                }
                        }catch(_e){
                                // quiet:true に任せる
                        }

                        if(!url || url === "false"){
                                const raw = raw_text;
                                if(raw){
                                        const has_space        = /\s/.test(raw);
                                        const looks_http       = raw.startsWith("http://") || raw.startsWith("https://");
                                        const looks_rel_prefix = raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/");
                                        const has_dot          = raw.indexOf(".") !== -1;
                                        const has_slash        = raw.indexOf("/") !== -1;

                                        // 空白を含まず、かつ「URLらしい」パターンのときだけ採用
                                        if(!has_space && (looks_http || looks_rel_prefix || has_dot || has_slash)){
                                                url = raw;
                                        }
                                }
                        }

                        if(!url || url === "false"){
                                // URL が決まらない場合は element に印を付けて終了
                                if(this.error?.warn && cfg_include.warn_on_element){
                                        el.setAttribute("sercrod-import-invalid", raw_text);
                                }
                                el.removeAttribute("*import");
                                el.removeAttribute("n-import");
                                if(!cfg_include.remove_element_if_empty) parent.append(el);
                                return;
                        }

                        // ------------------------------
                        // URL → HTML の取得（同期XHR）
                        //  - 同じ URL はクラス単位でキャッシュ
                        // ------------------------------
                        const cfg_import = (this.constructor._config && this.constructor._config.import) || {};
                        const method      = cfg_import.method || "GET";
                        const credentials = !!cfg_import.credentials;
                        const headers     = cfg_import.headers || {};

                        if(!this.constructor._import_cache) this.constructor._import_cache = new Map();
                        const cache = this.constructor._import_cache;

                        let html = cache.get(url) ?? "";
                        let status = 0;

                        if(!html){
                                try{
                                        const xhr = new XMLHttpRequest();
                                        xhr.open(method, url, false); // 同期リクエスト

                                        if(credentials) xhr.withCredentials = true;

                                        for(const k in headers){
                                                if(Object.prototype.hasOwnProperty.call(headers, k)){
                                                        xhr.setRequestHeader(k, headers[k]);
                                                }
                                        }

                                        xhr.send(null);

                                        status = xhr.status;

                                        if(status >= 200 && status < 300){
                                                html = xhr.responseText || "";
                                                cache.set(url, html);
                                        }else{
                                                if(this.error?.warn && cfg_include.warn_on_element){
                                                        el.setAttribute("sercrod-import-error", String(status));
                                                }
                                        }
                                }catch(_e){
                                        if(this.error?.warn && cfg_include.warn_on_element){
                                                el.setAttribute("sercrod-import-error", "exception");
                                        }
                                }
                        }

                        // 取得に失敗していれば、属性だけ消して終了
                        if(!html){
                                el.removeAttribute("*import");
                                el.removeAttribute("n-import");
                                if(!cfg_include.remove_element_if_empty) parent.append(el);
                                return;
                        }

                        // ------------------------------
                        // 展開部分は *include と同じ思想：
                        // 「取得した HTML をそのまま node.innerHTML に流し込む」
                        // ------------------------------
                        node.innerHTML = html;

                        // 一過性属性としての *import / n-import を削除
                        el.removeAttribute("*import");
                        el.removeAttribute("n-import");
                        // return しない：このあと通常の子レンダリングで innerHTML 内の *if 等を処理させる
                }

		// *literal / n-literal / *rem / n-rem（この要素配下は展開せず、値（または空）をそのまま出力）
		// - 「テンプレートをそのまま文字として出したい」用途向け
		if(node.hasAttribute("*literal") || node.hasAttribute("n-literal") || node.hasAttribute("*rem") || node.hasAttribute("n-rem")){
			const attr = node.getAttribute("*literal") ?? node.getAttribute("n-literal") ?? node.getAttribute("*rem")     ?? node.getAttribute("n-rem");
			el.textContent = (attr==null || attr===false) ? "" : String(attr);

			// cleanup: ディレクティブ属性を出力 DOM から削除
			if(this.constructor._config.cleanup.directives){
				el.removeAttribute("*literal");
				el.removeAttribute("n-literal");
				el.removeAttribute("*rem");
				el.removeAttribute("n-rem");
			}

			parent.appendChild(el);
			return;
		}

		// -----------------------------
		// checkbox の復元処理
		// -----------------------------
		// ポイント：
		// 1. update のたびに <input type="checkbox"> が作り直されるため、
		//    ユーザーが付けた checked 状態は初期化で消えてしまう。
		// 2. そこで postApply の段階で「データスコープの値」と「input.value」を照合し、
		//    checked を再設定してやる必要がある。
		// 3. モデル値は「単一値」か「配列値」のどちらかであり、両対応しなければならない。
		//    - 単一値（例: n-input="isAgreed"）なら true/false で判定
		//    - 配列値（例: n-input="selectedItems"）なら includes で判定
		// 4. eval_expr を第一優先とし、失敗時には capturedScope をフォールバックとして利用する。
		if(node.tagName==="INPUT" && node.type==="checkbox" && (node.hasAttribute("n-input") || node.hasAttribute("*input"))){
			// モデル式を取得
			const inputExpr = node.getAttribute("n-input") ?? node.getAttribute("*input");
			// 初期スコープをキャプチャしておく（eval_expr が失敗したときの保険）
			const capturedScope = scope;

			postApply = () => {
				try{
					// 1) eval_expr で最新データから値を取得 ---
					let val = this.eval_expr(inputExpr, this._stage ?? this._data, {el: node, mode:"checkbox"});

					// 2) 失敗・未定義なら、描画時に使ったスコープで再評価
					if(val === undefined || val === null) val = this.eval_expr(inputExpr, capturedScope, { el: node, mode: "checkbox", quiet: true });

					// 3) それでも undefined の場合、inputExpr が単純識別子ならプロパティ参照を最後に試す
					if(val === undefined && /^[A-Za-z_$][\w$]*$/.test(inputExpr)) val = capturedScope[inputExpr];

					//// --- もし undefined/null なら capturedScope から取得 ---
					//if(val === undefined || val === null){
					//	if(this._get_by_path){
					//		val = this._get_by_path(capturedScope, inputExpr);
					//	}else{
					//		val = capturedScope[inputExpr];
					//	}
					//}

					// --- input.value を取得（空なら ""）---
					const checkVal = el.value ?? "";

					// --- 単一値と配列値で分岐 ---
					// 配列モデルの場合: value が配列に含まれていれば checked
					if(Array.isArray(val)) el.checked = val.map(String).includes(String(checkVal));
					// 単一モデルの場合: 真偽値で判定
					// 例) n-input="isChecked" のように true/false を直接バインド
					else el.checked = Boolean(val);
				}catch(e){
					// エラー時は安全のため false に倒す
					el.checked = false;
				}
			};
		}

		// radio の「復元」は n-input が無い場合のみ（n-input 側と二重にしない）
		//if(node.tagName==="INPUT" && node.type==="radio" && (node.hasAttribute("n-input") || node.hasAttribute("*input"))){
		//const input = node.getAttribute("n-input") ?? node.getAttribute("*input");
		// --- checked 復元 ---
		// あとから for に追加された場合
		// L2: Catalog & Cart などに必要
		//postApply = ()=>{
		//	console.log("not in");
		//	alert(1);
		//	try{
		//		const inputName = node.getAttribute("name") || ""; // name があるならそれをモデル名とみなす（なければ空）
		//		if(inputName){
		//			//const val = this._get_by_path(scope, input);
		//			// 最新値を評価する & el.value を参照
		//			const val = this.eval_expr(inputName, this._stage ?? this._data, {el: node, mode:"radio"});
		//
		//			//const radioVal = node.getAttribute("value") ?? "";
		//			// node ではなく el.value を参照する
		//			const radioVal = el.value ?? "";
		//
		//			el.checked = (String(val) === String(radioVal));
		//		}
		//	}catch(e){ el.checked = false; }
		//}
		//}

		// -----------------------------
		//  :attr バインディング 群
		// -----------------------------
		if(node.hasAttributes()){
			for(const attr of Array.from(node.attributes)){
				if(attr.name.startsWith(":")){
					const key = attr.name.slice(1);
					if(key==="text"||key==="html") continue;
					try{
						const val = this.eval_expr(attr.value, scope, {el: node, mode: "attr:"+key});
						if(key==="class"){
							if(typeof val==="string"){ el.className = val; }
							else if(Array.isArray(val)){ el.className = val.filter(Boolean).join(" "); }
							else if(val && typeof val==="object"){ el.className = Object.keys(val).filter(k=>!!val[k]).join(" "); }
							else{ el.className = ""; }
						}else if(key==="style"){
							el.style.cssText = val || "";
						}else{
							// scope は一切書き換えない
							if(val===false || val==null){
								el.removeAttribute(key);
							}else{
								if(key==="value" && /^(INPUT|SELECT|TEXTAREA|OPTION)$/.test(el.tagName)){
									// フォーム要素に限り、el.value にも代入
									el.value = String(val);
								}
								//el.setAttribute(key, String(val));
								if(["href","src","action","formaction","xlink:href"].includes(key)){
									const safe = this.constructor._filters.url(String(val), key, {el, scope});
									if(safe) el.setAttribute(key, safe);
								}else{
									const pair = this.constructor._filters.attr(key, val, {el, scope});
									if(pair && pair.value!=null) el.setAttribute(pair.name, pair.value===true ? "" : String(pair.value));
								}
							}
						}
					}catch(e){
						// 評価失敗時は安全側へ倒す（class/style は空、その他は空属性）
						if(key==="class"){ el.className=""; }
						else if(key==="style"){ el.style.cssText=""; }
						else{ el.setAttribute(key, ""); }
					}
					// cleanup:属性を出力 DOM から削除
					if(this.constructor._config.cleanup.handlers) el.removeAttribute(attr.name);
				}
				//else if(attr.name.startsWith("@")){
				else if(attr.name.startsWith(this.constructor._config.events.prefix)){
					// イベント系呼び出し
					this._renderEvent(el, attr, scope);

					// cleanup: イベント属性を出力 DOM から削除
					if(this.constructor._config.cleanup.handlers) el.removeAttribute(attr.name);
				}
			}
		}
                // -----------------------------
                //  *prevent-default / *prevent
                // -----------------------------
                if(node.hasAttribute("*prevent-default") || node.hasAttribute("*prevent")){
                        const raw = node.getAttribute("*prevent-default") ?? node.getAttribute("*prevent") ?? "";
			const mode = (raw || "enter").toLowerCase();

			if(mode==="enter" || mode==="all"){
				el.addEventListener("keydown", e=>{
					if(e.key==="Enter") e.preventDefault();
				});
			}
			if(mode==="submit" || mode==="all"){
				// form 要素に対して submit を止める
				if(el.tagName==="FORM"){
					el.addEventListener("submit", e=>e.preventDefault());
                                }
                        }
                }

                // -----------------------------
                //  *fetch / n-fetch
                // -----------------------------
                if(node.hasAttribute("*fetch") || node.hasAttribute("n-fetch")){
                        const spec_raw = node.getAttribute("*fetch") ?? node.getAttribute("n-fetch") ?? "";
                        const resolve_spec = () => this._resolve_fetch_spec(spec_raw, scope, node);
                        const spec = resolve_spec();

                        if(!spec && this.error?.warn) console.warn("[Sercrod warn] *fetch requires a URL spec");

                        const tag  = el.tagName.toUpperCase();
                        const type = (el.getAttribute("type")||"").toLowerCase();
                        const isClickable =
                                tag==="BUTTON" ||
                                (tag==="A" && !el.hasAttribute("download")) ||
                                (tag==="INPUT" && ["button","submit","reset","image"].includes(type));

                        const makeOnceKey=()=>{
                                const spec_now = resolve_spec();
                                if(!spec_now) return "";
                                try{
                                        const u = new URL(spec_now, location.href);
                                        u.searchParams.delete("ts");
                                        return u.pathname + (u.search ? "?" + u.searchParams.toString() : "");
                                }catch(_){
                                        return spec_now.replace(/([?&])ts=[^&]*/g, "").replace(/[?&]$/, "");
                                }
                        };

                        this.__fetchOnce = this.__fetchOnce || new Set();

                        if(isClickable){
                                el.addEventListener("click", ()=>{
                                        const spec_now = resolve_spec();
                                        if(spec_now) this._do_load(spec_now);
                                });
                        }else{
                                const onceKey = makeOnceKey();
                                if(onceKey && !this.__fetchOnce.has(onceKey)){
                                        this.__fetchOnce.add(onceKey);
                                        requestAnimationFrame(()=>{
                                                const spec_now = resolve_spec();
                                                if(spec_now) this._do_load(spec_now);
                                        });
                                }
                        }

                        if(this.constructor._config.cleanup.directives){
                                el.removeAttribute("*fetch");
                                el.removeAttribute("n-fetch");
                        }
                }

                // -----------------------------
                //  n-input（双方向バインディング）
                // -----------------------------
                const inputExpr = node.getAttribute("n-input") ?? node.getAttribute("*input");
                if(inputExpr){
			const srcAttr = node.hasAttribute("n-input") ? "n-input" : node.hasAttribute("*input") ? "*input" : null;
			const tag  = node.tagName.toUpperCase();
			const type = (node.getAttribute("type")||"").toLowerCase();

			let target = this._stage ?? this._data;
			let test;
			try {
				test = this.eval_expr(inputExpr, target, { el: node, mode: srcAttr, quiet: true});
			} catch (e) {
				if (e instanceof ReferenceError) {
					target = scope;
				} else {
					throw e;
				}
			}
			if(test === false) target = scope;

			// eager 判定用フラグ
			let eagerAttr = node.getAttribute("*eager") ?? node.getAttribute("n-eager");
			let isEager = false;
			if(node.hasAttribute("*eager") || node.hasAttribute("n-eager")) if(eagerAttr==="" || eagerAttr===null) isEager = true; // 値なし -> 有効
			else{
				try{
					const result = this.eval_expr(eagerAttr, scope, {el: node, mode:"eager"});
					isEager = Boolean(result);
				}catch(e){
					isEager = String(eagerAttr).toLowerCase() !== "false";
				}
			}

			// lazy 判定用フラグ
			let LazyAttr = node.getAttribute("*lazy") ?? node.getAttribute("n-lazy");
			let isLazy = false;
			if(node.hasAttribute("*lazy") || node.hasAttribute("n-lazy")) if(LazyAttr==="" || LazyAttr===null) isLazy = true; // 値なし -> 有効
			else{
				try{
					const result = this.eval_expr(LazyAttr, scope, {el: node, mode:"Lazy"});
					isLazy = Boolean(result);
				}catch(e){
					isLazy = String(LazyAttr).toLowerCase() !== "false";
				}
			}

			let curVal;
			try{ curVal = this.eval_expr(inputExpr, target); }catch(e){ curVal = undefined; }

			// 1) 初期反映（data -> UI）
			if(tag==="INPUT"){
				if(type==="checkbox"){
					const v = node.getAttribute("value") ?? "on";
					if(Array.isArray(curVal)) el.checked = curVal.map(String).includes(String(v));
					else el.checked = !!curVal;
				}else if(type==="radio"){
					postApply = ()=>{
						try{
							const latest = this.eval_expr(inputExpr, this._stage ?? this._data, { el: node, mode: srcAttr.replace(/^\*/,"") });
							el.checked = (String(latest) === String(el.value ?? ""));
						}catch(e){ el.checked = false; }
					};
				}else{
					//el.value = Sercrod._filters.input_out(el, curVal ?? "", {scope});
					// null/undefined/false は空に正規化し、“false” 文字列化を防ぐ
					const base = (curVal===null || curVal===undefined || curVal===false) ? "" : curVal;
					const out  = this.constructor._filters.model_out
						? this.constructor._filters.model_out(el, base, {scope})
						: base;
					el.value = (out===null || out===undefined || out===false) ? "" : String(out);
				}
			}else if(tag==="TEXTAREA"){
				//el.value = Sercrod._filters.input_out(el, curVal ?? "", {scope});
				// null や false は空文字に正規化し、入力系と同じ扱いにする
				const base = (curVal==null || curVal===false) ? "" : curVal;
				const out  = this.constructor._filters.model_out
					? this.constructor._filters.model_out(el, base, {scope})
					: base;
				el.value = (out==null || out===false) ? "" : String(out);
			}else if(tag==="SELECT"){
				// 子<option> はこのあと描画するため、選択適用は postApply に遅延
				if(node.hasAttribute("multiple")){
					const arr = Array.isArray(curVal) ? curVal.map(String) : [];
					postApply = ()=>{ Array.from(el.options).forEach(o=>o.selected = arr.includes(o.value)); };
				}else{
					const v = (curVal==null) ? "" : String(curVal);
					postApply = ()=>{ el.value = v; };
				}
			}

			// 日本語 IME などの composition 中は input で確定しない
			let composing = false;
			if((tag==="INPUT" && type!=="checkbox" && type!=="radio") || tag==="TEXTAREA"){
				el.addEventListener("compositionstart", ()=>{ composing = true; });
				el.addEventListener("compositionend",  ()=>{ composing = false; });
			}

			// 2) input イベント（text/number 等の逐次反映）
			if(tag==="INPUT" && type!=="checkbox" && type!=="radio"){
				el.addEventListener("input", ()=>{
					if(composing) return;
					let nextVal = el.value;

					// 型合わせ：入力 type=number or 既存値が number なら数値化を試みる
					let cur0;
					try{ cur0 = this.eval_expr(inputExpr, target, { el: node, mode: `${srcAttr.replace(/^\*/,"")}:input` }); }catch(e){ cur0 = undefined; }
					if(type==="number"){
						nextVal = (nextVal==="") ? "" : Number(nextVal);
					}else if(typeof cur0==="number" && nextVal!==""){
						const n = Number(nextVal);
						nextVal = Number.isNaN(n) ? nextVal : n;
					}

					const finalVal = this.constructor._filters.input_in(el, nextVal, {scope});
					this.assign_expr(inputExpr, finalVal, target);

					if(!this._stage){
						if(isEager) this.update(); // *eager -> 即反映
						//else this._updateChildren(false, this); // デフォルト lazy -> 子のみ更新
						else this._updateChildren(true, this); // デフォルト lazy -> 子のみ更新
					}
				});
			}
			// 3) textarea の逐次反映
			else if(tag==="TEXTAREA"){
				el.addEventListener("input", ()=>{
					if(composing) return;
					this.assign_expr(inputExpr, el.value, scope);
					if(!this._stage){
						if(isEager) this.update(); // *eager -> 即反映
						//else this._updateChildren(false, this); // デフォルト lazy -> 子のみ更新
						else this._updateChildren(true, this); // デフォルト lazy -> 子のみ更新
					}
				});
			}

			// 4) change（checkbox / radio / select / その他）
			el.addEventListener("change", ()=>{
				let nextVal;

				if(tag==="INPUT" && type==="checkbox"){
					const v = el.getAttribute("value") ?? "on";
					let cur;
					try{ cur = this.eval_expr(inputExpr, target, { el: node, mode: `${srcAttr.replace(/^\*/,"")}:change` }); }catch(e){ cur = undefined; }

					if(Array.isArray(cur)){
						const vv = String(v);
						const has = cur.map(String).includes(vv);
						nextVal = el.checked
							? (has ? cur : [...cur, v])
							: cur.filter(x => String(x)!==vv);
					}
					else nextVal = el.checked;
				}else if(tag==="INPUT" && type==="radio"){
					if(el.checked) nextVal = el.value;
					const finalVal = this.constructor._filters.input_in(el, nextVal, {scope});
					this.assign_expr(inputExpr, finalVal, target);

				}else if(tag==="SELECT"){
					nextVal = node.hasAttribute("multiple")
						? Array.from(el.selectedOptions).map(o=>o.value)
						: el.value;
				}
				else{
					nextVal = el.value;
				}

				// 型合わせ：元値が number なら number に寄せる（配列は除外）
				let cur0;
				try{ cur0 = this.eval_expr(inputExpr, target, { el: node, mode: `${srcAttr.replace(/^\*/,"")}:change` }); }catch(e){ cur0 = undefined; }
				if(typeof cur0==="number" && nextVal!=="" && !Array.isArray(nextVal)){
					const n = Number(nextVal);
					if(!Number.isNaN(n)) nextVal = n;
				}

				const finalVal = this.constructor._filters.input_in(el, nextVal, {scope});
				this.assign_expr(inputExpr, finalVal, target);

				if(!this._stage){
					if(!isLazy) this.update();
					else this._updateChildren(false, this);
				}
			});
		}

		// -----------------------------
		//  *print / n-print | *textContent / n-textContent
		// -----------------------------
		// normalizeTpl: バンドル環境によっては式文字列を正規化するためのフック
		const norm = this.normalizeTpl ? (s)=>this.normalizeTpl(s) : (s)=>s;

		if(node.hasAttribute("*print") || node.hasAttribute("n-print") || node.hasAttribute("*textContent") || node.hasAttribute("n-textContent")){
			const srcAttr = node.hasAttribute("*print") ? "*print" : node.hasAttribute("n-print") ? "n-print" : node.hasAttribute("*textContent") ? "*textContent" : "n-textContent";
			try{
				let expr = node.getAttribute(srcAttr);
				expr = norm(expr);
				const v = this.eval_expr(expr, scope, {el: node, mode: srcAttr.replace(/^\*/,"")});
				const raw = (v==null || v===false) ? "" : v;
				el.textContent = this.constructor._filters.text(raw, {el, expr, scope});

				// cleanup: ディレクティブ属性を出力 DOM から削除
				if(this.constructor._config.cleanup.directives){
					el.removeAttribute("*print");
					el.removeAttribute("n-print");
					el.removeAttribute("*textContent");
					el.removeAttribute("n-textContent");
				}
			}catch(e){ el.textContent = ""; }
			parent.appendChild(el);
			return;
		}else if(node.childNodes.length===1 && node.firstChild.nodeType===3){
			// 静的テキストノードがある場合はコピー
			const raw = node.textContent;
			if(raw.includes("%")){
				// % 展開がある -> expand_text を使う
				const expanded = this._expand_text(raw, scope, node);
				el.textContent = expanded;
			}else{
				// 純粋な静的テキスト -> そのままコピー
				el.textContent = raw;
			}
			parent.appendChild(el);
			return;
		}

		// -----------------------------
		//  *compose / n-compose , *innerHTML / n-innerHTML（HTMLとして挿入）
		// -----------------------------
		if(node.hasAttribute("*compose") || node.hasAttribute("n-compose") || node.hasAttribute("*innerHTML") || node.hasAttribute("n-innerHTML")){
			const srcAttr = node.hasAttribute("*compose") ? "*compose" : node.hasAttribute("n-compose") ? "n-compose" : node.hasAttribute("*innerHTML") ? "*innerHTML" : "n-innerHTML";
			let expr = node.getAttribute(srcAttr);
			try{
				const v = this.eval_expr(expr, scope, {el: node, mode: srcAttr.replace(/^\*/,"")});
				const raw = (v==null || v===false) ? "" : v;
				const ctx = {el, expr, scope};   // ここで ctx を用意

				el.innerHTML = this.constructor._filters.html(raw, ctx);
			}catch(e){
				if(this.error.warn) console.warn("[Sercrod warn] html filter:", e.message,
					"\n expr=", expr,
					"\n scope=", scope,
					"\n el=", el);
				el.innerHTML = "";
			}
		}

		// -----------------------------
		//  n-class / n-style（式でまとめて指定）
		// -----------------------------
		//if(node.hasAttribute("*class") || node.hasAttribute("n-class")){
		//	const srcAttr = node.hasAttribute("*class") ? "*class" : "n-class";
		//	const expr = node.getAttribute(srcAttr);
		//	try{
		//		//const v = this.eval_expr(expr, scope, {el: node, mode: srcAttr.replace(/^:/,"")});
		//		const v = this.eval_expr(expr, scope, {el: node, mode: srcAttr.replace(/^(?:\*|n-)/,"")});
		//		if(typeof v==="string"){ el.className = v; }
		//		else if(Array.isArray(v)){ el.className = v.filter(Boolean).join(" "); }
		//		else if(v && typeof v==="object"){ el.className = Object.keys(v).filter(k=>!!v[k]).join(" "); }
		//		else{ el.className = ""; }
		//	}
		//	catch(e){ el.className = ""; }
		//}
		//if(node.hasAttribute("*style") || node.hasAttribute("n-style")){
		//	const srcAttr = node.hasAttribute("*style") ? "*style" : "n-style";
		//	const expr = node.getAttribute(srcAttr);
		//	try{
		//		const v = this.eval_expr(expr, scope, {el: node, mode: srcAttr.replace(/^:/,"")});
		//		el.style.cssText = this.constructor._filters.style(v || "", {el, expr, scope});
		//	}
		//	catch(e){ el.style.cssText = ""; }
		//}

		// -----------------------------
		//  プレーンテキスト子 1 個のみ -> %expr% 展開
		// -----------------------------
		if(!node.hasAttribute("*print") && !node.hasAttribute("n-print") && !node.hasAttribute("*textContent") && !node.hasAttribute("n-textContent") &&
			node.childNodes.length===1 && node.firstChild?.nodeType===3 &&
			node.textContent.includes("%")){
			const expanded = this._expand_text(node.textContent, scope, node);
			el.textContent = expanded;
			parent.appendChild(el);
			return;
		}

		// -----------------------------
		//  子ノードを再帰描画
		// -----------------------------
		node.childNodes.forEach(c => this.renderNode(c, scope, el));

		// -----------------------------
		//  子描画が終わってから postApply を同期実行
		//  （<select> の選択状態など、子<option>の存在が前提のもの）
		// -----------------------------
		if(postApply) try{ postApply(); }catch(e){}

		// これから CE(<serc-rod>) をマウントするなら、反復で作った “今回のスコープ” を子 CE に渡してから append する。
		if (this._isSercrod(el)) {
			if (el.__sercrod_scope === undefined && !el.hasAttribute("data")) {
				el.__sercrod_scope = scope; // data が明示されていない時は親スコープを注入
			}
			this.add_flag(el, "sercrod"); // インデックスにも載せておく（伝播更新用）
		}

		// -----------------------------
		// cleanup: ディレクティブ属性の一括削除
		// -----------------------------
		if(this.constructor._config.cleanup.directives){
			for(const attr of Array.from(el.attributes)){
				const name = attr.name;
				// Sercrod ディレクティブに該当する属性だけ消す
				if(this.constructor.directives.has(name)){
					el.removeAttribute(name);
				}
			}
		}

		// 最後に親へマウント
		parent.appendChild(el);

		// log フックをこの要素単位で処理する
		this._call_log_hooks(scope, el);
	}
_dummy(){void(/\/\//);} // vim 整形のためのダミー
	// @event 属性を処理する専用ハンドラ
	//   - 例: <button @click="doSomething(x)">...</button>
	//   - @click.prevent.stop など修飾子もサポート
	//   - scope 内の値を式に展開して Function で評価
	_renderEvent(el, attr, scope){
		// イベント属性の接頭辞（例： "@", "ne-" など）
		const prefix = this.constructor._config.events.prefix || "@";

		// attr.name から接頭辞を取り除く
		// 例）"@click.prevent" → "click.prevent"
		//     "ne-click.stop"  → "click.stop"
		let raw = attr.name;
		raw = raw.slice(prefix.length);

		const parts = raw.split(".");
		const ev = parts.shift();          // 最初の部分はイベント名（例: "click"）
		if(!ev) return;                    // イベント名が取れない場合は何もしない

		const mods = new Set(parts);       // 残りは修飾子（prevent / stop / once / capture / passive）
		const expr = attr.value;           // 属性値そのまま（式文字列）

		// イベントリスナー登録オプション
		const opt = {
			capture: mods.has("capture"),
			passive: mods.has("passive"),
			// once はブラウザに任せる（手動 remove は廃止）
			once: mods.has("once")
		};

		// 実際のイベントハンドラ関数
		const handler = (e)=>{
			// 修飾子処理
			if(mods.has("prevent")) e.preventDefault();
			if(mods.has("stop")) e.stopPropagation();

			// スコープにイベントを注入
			//const merged = { ...scope, $event: e, $e: e };

			// window フォールバック付きスコープ構築
			const merged = new Proxy(scope, {
				get(t, k){
					if(k==="$event" || k==="$e") return e;
					if(k==="el" || k==="$el") return el;
					// data優先 -> windowフォールバック
					return (k in t) ? t[k] : window[k];
				},
				set(t, k, v){
					if(k==="$event" || k==="$e" || k==="el" || k==="$el") return true;
					t[k] = v;
					if(this._data && k in this._data) this._data[k] = v;
					return true;
				}
			});

			try{
				// JS評価式一括：文としてそのまま実行
				//this.eval_let(expr, merged, { el, $event: e, mode:"event" });
				// 評価関数を let から event 用へ
				this.eval_event(expr, merged, { el, $event: e });

				// --- 再描画方針を決定 ---
				// 非破壊（hover/移動系）は既定で更新しない（差し替えで再発火のループ回避）
				const raw = this.constructor._config.events.non_mutating;
				const NON_MUTATING = raw instanceof Set ? raw : new Set(raw);

				// 更新反映（stage なら子だけ、通常なら全体）
				//if(!this._stage){
				//	this.update();
				//}else{
				//	this._updateChildren(false, this);
				//}
				//if(!this._stage){
				//	this._schedule_update();      // 直呼びせずトランザクションへ
				//}else{
				//	this._updateChildren(false, this);
				//}
				// 更新反映：フォーカス保持のため、常に子だけを軽量更新
				// デフォルト方針（任意）：フォーカス中は子だけ、そうでなければ全体
				// --- 最終反映（@click 経由か、直接の入力操作かで分岐）---
				const t = e && e.target;
				const tag = t && t.tagName;
				const is_form_ctrl = !!(t && (t.isContentEditable || tag==="INPUT" || tag==="TEXTAREA" || tag==="SELECT"));

				// 入力系イベント or フォーム要素上の click は「入力」
				//ev.startsWith = composition[start|update|end]
				const is_inputish = ev==="input" || ev==="change" || ev==="beforeinput" || ev==="keydown" || ev==="keyup" || ev.startsWith("composition") || (ev==="click" && is_form_ctrl);

				// 明示修飾子で上書き可能
				// @mouseover.update="..." なら強制更新 / @mouseover.noupdate で明示抑止
				let wantsUpdate = !NON_MUTATING.has(ev);
				if (mods.has("update"))   wantsUpdate = true;
				if (mods.has("noupdate")) wantsUpdate = false;
				// `.once` + 非破壊イベントは特に更新しない（新ノード再登録で再発火するため）
				if (mods.has("once") && NON_MUTATING.has(ev)) wantsUpdate = false;

				// - 入力イベントやフォーム系クリックは「子のみ軽量更新」
				// - それ以外（通常クリックなど）は「自身を更新」
				//if(ev==="click" && is_form_ctrl) this._updateChildren(false, this);
				//if(is_inputish) this._updateChildren(false, this);
				if(is_inputish || (ev==="click" && is_form_ctrl)) this._updateChildren(false, this);
				else if(wantsUpdate){
					if (ev==="click" && is_form_ctrl) this._updateChildren(false, this);
					else this.update();
				}

				//else this.update();
				// すべての @event で軽量更新のみ行う
				//this._updateChildren(false, this);
			}
			catch(err){
				if(this.error.warn) console.warn("[Sercrod warn] @event handler:", err);
			}

			// once 修飾子 -> 一度だけで解除
			if(mods.has("once")) el.removeEventListener(ev, handler, opt);
		};

		// 実際にイベントを登録
		//el.addEventListener(ev, handler, opt);
		// --- 重複登録防止（再描画時に既存を除去）---
		if(!el._sercrod_handlers) el._sercrod_handlers = {};
		if(el._sercrod_handlers[ev]){
			// capture/passiveが同じでも問題ない、確実に削除
			el.removeEventListener(ev, el._sercrod_handlers[ev], opt);
		}

		el._sercrod_handlers[ev] = handler;
		el.addEventListener(ev, handler, opt);
	}

	// 子 Sercrod を一括更新（親からの軽量伝播）
	// - 子に対し update(force) を伝播。force=true は親の強制更新時に合わせて子も強制。
	// 今は、force = false だと、実質なにもしなくなったので、いずれ引数を callser だけに書き換えなければならない 
	_updateChildren(force=false, callser=null){
		const sercrods = this._flag_index["sercrod"];
		if(!sercrods || !sercrods.size) return;

		for(const child of sercrods){
			if(child._updating) continue;

			// 子にも update を伝播
			if(force) child.update(true, this);
			// else child._schedule_update();
		}
	}

	// -----------------------------------
	// 通常要素の *updated / n-updated を吸収処理
	// -----------------------------------
	// 目的:
	// - 「通常要素」に付与された *updated を、ホスト Sercrod の文脈で安全に実行する。
	// - 子 Custom Elements の内部へは立ち入らず（他ライブラリ領域に干渉しない）。
	_absorb_child_updated(){
		// TreeWalker を使って this 配下の通常要素を走査する
		// ポイント:
		//   - 子 CustomElement (<serc-rod>, <hello-world> など) の内部には絶対に入らない
		//   - つまり「通常要素に付与された *updated / n-updated」だけを吸収できる

		const walker = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT, {
			acceptNode: (node)=>{
				if(node===this) return NodeFilter.FILTER_SKIP;  // 自分自身(this)は対象外

				// -> そのノード自体も配下も調べない (FILTER_REJECT)

				// A 案
				// Sercrod 以外の CE の内部は、他のライブラリ・アプリの領域だから勝手に触らない（customElements.get(localName) が登録されていれば CustomElement とみなす）
				//if(customElements.get(node.localName)) return NodeFilter.FILTER_REJECT;

				// B 案
				// Sercrod のみ CE の内部は干渉しない（通常要素に絞って走査。通常要素の子も走査。Sercrod なら子を含めて走査しない。）
				if(node instanceof Sercrod) return NodeFilter.FILTER_REJECT;

				return NodeFilter.FILTER_ACCEPT; // それ以外は調べる
			}
		});

		let el;
		while((el = walker.nextNode())){
			// *updated / n-updated を持たない要素はスキップ（propagate は別途処理）
			if(el.hasAttribute("*updated") || el.hasAttribute("n-updated")){
				const expr = el.getAttribute("*updated") ?? el.getAttribute("n-updated");
				if(expr){
					try{
						let host = this;
						if(!(el instanceof Sercrod)){
							let cur = el.parentElement;
							while(cur){
								if(cur instanceof Sercrod){
									host = cur; // 一番外側まで更新
								}
								cur = cur.parentElement;
							}
						}

						// 疑似イベントオブジェクトを組み立てる
						const evt   = { type:"updated", target: el, host };
						//// データスコープに $event を注入
						//const scope = { ...host._data, $event: evt };
						// データスコープは host._data をベースにする
						const scope = { ...host._data };

						// *updated の式を安全に評価（JS 評価式一択）
						if(/^\(.*\)$/.test(expr)){
							// --- 1) セレクタ指定 "(...)" ---
							const sel = expr.slice(1, -1);
							try{
								const root = host; // ルート Sercrod から検索
								if(root.matches(sel) && root instanceof Sercrod) root.update(true);
								root.querySelectorAll(sel).forEach(el=>{ if(el instanceof Sercrod) el.update(true); });
								// querySelectorAll 廃止
								try {
									// root 自身の一致は別途見る（_get_flagged は自分を含まない）
									if (root.matches(sel) && this._isSercrod(root)) root.update(true);

									// 親を使う場合だけ、インデックスを新鮮化
									if (root !== this && root._rebuild_flag_index) root._rebuild_flag_index();

									const list = root._get_flagged ? root._get_flagged("sercrod") : [];

									// :scope や先頭結合子を含む場合はスコープ付きクエリにフォールバック
									const needsScopedQS = /(^|\s)(:scope|[>+~]\s)/.test(sel);

									if(!needsScopedQS && list && list.length) for (const el of list) if (el.matches(sel)) el.update(true);
									else if(root.querySelectorAll) root.querySelectorAll(sel).forEach(el => { if (el instanceof Sercrod) el.update(true); });
								} catch (e) {
									if (this.error?.warn) console.warn(`[Sercrod warn] selector:`, e);
								}
							}catch(e){
								if(this.error.warn) console.warn("[Sercrod warn] *updated selector:", e, el);
							}
						}else{
							// --- 2) 通常の JS の文/式として実行 ---
							try{
								//host.eval_let(expr, scope, { el });
								host.eval_let(expr, scope, { el, $event: evt });
							}catch(e){
								if(this.error.warn) console.warn("[Sercrod warn] *updated expr:", e, el);
							}
						}
					}catch(e){
						if(this.error.warn) console.warn("[Sercrod warn] *updated absorb:", e, el);
					}
				}
			}

			// --- *updated-propagate / n-updated-propagate の処理を追加 ---
			// - セレクタ/数値/root/任意文字列（セレクタ解釈）の順で解決
			const propAttr = el.getAttribute("*updated-propagate") || el.getAttribute("n-updated-propagate");
			if(propAttr!=null){
				try{
					const spec = (propAttr || "1").trim();
					if(/^\(.*\)$/.test(spec)){
						// セレクタ指定
						const sel = spec.slice(1, -1);
						const target = el.closest(sel);
						if(target instanceof Sercrod) target.update(true, this);
					}else if(spec === "root"){
						// すでに this._root があるなら、それを使う
						if(this._root){
							this._root.update(true, this);
						}else{
							// 念のため、DOMを親方向にたどって Sercrod インスタンスを探す
							let cur = el;
							while(cur){
								if(cur instanceof Sercrod){
									// 最外層まで登る
									while(cur.parentElement && cur.parentElement instanceof Sercrod){
										cur = cur.parentElement;
									}
									cur.update(true, this);
									break;
								}
								cur = cur.parentElement;
							}
						}
					}else if(/^\d+$/.test(spec)){
						// 数値指定（階層数ぶん親をさかのぼる）
						let steps = parseInt(spec, 10);
						// 通常要素に付いていた場合は直近の Sercrod を起点にするため 1 減算
						if(!(el instanceof Sercrod)) steps = Math.max(0, steps - 1);
						let p = el.parentElement;
						while(steps > 0 && p){
							if(p instanceof Sercrod){
								steps--;
								if(steps === 0){
									p.update(true, this);
									break;
								}
							}
							p = p.parentElement;
						}
					}else{
						// フォールバック: セレクタとして解釈
						const target = el.closest(spec);
						if(target instanceof Sercrod) target.update(true, this);
					}
				}catch(e){
					if(this.error.warn) console.warn("[Sercrod] *updated-propagate absorb:", e, el);
				}
			}
		}
	}
	_do_load(spec){
		// *fetch / n-fetch 用のローダー
		// 期待フォーマット: "path/to.json[:prop]"（prop 指定で data[prop] に格納、未指定で data 丸ごと置換）
		const [file, prop] = spec.split(":");
		// ロード開始イベント（外部フック用）
		this.dispatchEvent(new CustomEvent("sercrod-load-start", {
			detail: { stage: "fetch", host: this, spec, file, prop },
			bubbles:true, composed:true
		}));
		fetch(file).then(r=>r.json()).then(json=>{
			const touchedPaths = [];
			if(prop){
				// data の一部にアサイン（foo[bar] の簡易記法に対応）
				if(/\[(.+)\]/.test(prop)){
					const [base,key] = prop.match(/(.+?)\[(.+)\]/).slice(1);
					this._data[base] = this._data[base]||{};
					this._data[base][key] = json;
					touchedPaths.push(`${base}[${key}]`);

				}else{
					this._data[prop] = json;
					touchedPaths.push(prop);

				}
			}else{
				// 丸ごと置換時は必ず再ラップして、監視と差分検出の一貫性を保つ
				//this._data = json;
				this._data = this._wrap_data(json); // “丸ごと置換”だけは再ラップ必須
				touchedPaths.push("$root");

			}
			// ここでロード完了を通知（描画前）
			this.dispatchEvent(new CustomEvent("sercrod-loaded", {
				detail: { stage: "fetch", host: this, spec, file, prop, json, paths:touchedPaths },
				bubbles:true, composed:true
			}));
			//requestAnimationFrame(()=> this.update());
			// ロード反映もトランザクションへ
			//requestAnimationFrame(()=> this._schedule_update());
			this._loading = false;
			// 初回描画/再描画を rAF タイミングで実施（フォーカス喪失などの副作用を減らす）
			requestAnimationFrame(()=> this.update());
		}).catch(err=>{
			// 失敗時イベント（外部が UI/リトライ制御を実装できるよう通知）
			this.dispatchEvent(new CustomEvent("sercrod-load-error", {
				detail: { stage: "fetch", host: this, spec, file, prop, error: String(err) },
				bubbles:true, composed:true
			}));
		});
	}
	// Sercrod または Sercrod になる予定の要素かを判定
	// - 既に upgrade 済み (instanceof Sercrod) か、customElements に登録されたタグ名かで判定
	_isSercrod(node){
		//if(!node || node.nodeType !== 1) return false; // 要素以外は除外
		//// すでにインスタンス化されている
		//if(node instanceof Sercrod) return true;
		//// まだ登録予定のタグだが、customElements に紐付いている
		//const ctor = customElements.get(node.localName);
		//return ctor === Sercrod;
		// すでに Sercrod またはその派生クラスのインスタンス化済みなら true
		if(node instanceof Sercrod) return true;
		// customElements 登録済みで Sercrod の派生であれば true
		const ctor = customElements.get(node.localName);
		if(!ctor) return false;
		try{
			return ctor === Sercrod || (ctor.prototype instanceof Sercrod);
		}catch{
			return false;
		}
	}

	// 要素が *name / n-name / :name / @name のいずれかを持っているか
	// - name 省略時は「Sercrod が解釈対象とする属性がひとつでもあるか」を調べるユーティリティ
	_is_attribute(el, name){
		if(!el.hasAttributes()) return false;

		for(const attr of el.attributes){
			if(!this.constructor.directives.has(attr.name)) continue;

			if(!name) return true;

			if(attr.name === "*" + name || attr.name === "n-" + name){
				return true;
			}
		}
		return false;
	}
	// el が自分以外の CE 内にあるか判定
	// - 異種 Custom Element の内部へは立ち入らない方針の判定補助
	_is_inside_other_ce(el){
		let cur = el.parentElement;
		while(cur && cur!==this){
			if(customElements.get(cur.localName)) return true;
			cur = cur.parentElement;
		}
		return false;
	}
	//_log(level="log", msg, {expr, scope, el, error})
	// - ログ整形ユーティリティ。開発時のデバッグ用（本番運用では this.log/error.* と合わせて制御）
	_log(level="log", msg, {expr, scope, el, error} = {}){
		const fn = console[level] ?? console.log; // 不正なlevelはlogにフォールバック
		fn(
			"[Sercrod " + level + "] ",
			"\n", msg,
			"\n ^", expr ?? "(none)",
			"\n >", scope ? JSON.stringify(scope, null, 2) : "(none)",
			"\n >>", el?.outerHTML ?? "(n/a)",
			error ? "\n error: " + (error.message || error) : ""
			//error ? "\n error: " + (error.stack || error) : ""	//真にデバッグする場合はスタックを出力
		);
	}
	// 2つのオブジェクトの差分を、階層ごとに JSON.stringify を使って効率的に比較
	// - ネストオブジェクト/配列両対応。値の等価は JSON 表現で近似（順序差のあるオブジェクトは非対応）
	// - 差分は {key:{OLD:..., NEW:...}} もしくはネスト差分を返す
	_diffObjects(source, target){
		const differences = Array.isArray(source) || Array.isArray(target) ? [] : {};
		const allKeys = new Set([...Object.keys(source || {}), ...Object.keys(target || {})]);

		for(const key of allKeys){
			const val1 = source ? source[key] : undefined;
			const val2 = target ? target[key] : undefined;

			if(!(key in (source || {}))){
				differences[key] = { [this.OLD]: undefined, [this.NEW]: val2 };
				continue;
			}
			if(!(key in (target || {}))){
				differences[key] = { [this.OLD]: val1, [this.NEW]: undefined };
				continue;
			}

			const str1 = JSON.stringify(val1);
			const str2 = JSON.stringify(val2);

			if(str1 !== str2){
				if(typeof val1 === "object" && val1 !== null && typeof val2 === "object" && val2 !== null){
					const nestedDiff = this._diffObjects(val1, val2);
					if(Object.keys(nestedDiff).length > 0){
						differences[key] = nestedDiff;
					}
				} else {
					differences[key] = { [this.OLD]: val1, [this.NEW]: val2 };
				}
			}
		}
		return differences;
	}

	// ネスト差分を "a.b[3].c" のようなフラットなキーに変換
	// - UI 表示/ログ出力/外部イベントの負荷軽減に有用
	_flattenDiff(diffObj, basePath = "", result = {}){
		// diffObj が配列かどうかを判定
		const isArray = Array.isArray(diffObj);

		// diffObj の各キーを走査
		for(const key in diffObj){
			const val = diffObj[key];

			// パス文字列を生成（配列なら [n]、オブジェクトなら .key）
			let path;
			if(isArray){
				path = `${basePath}[${key}]`;
			} else {
				path = basePath ? `${basePath}.${key}` : key;
			}

			// 値がオブジェクトの場合のみさらに処理
			if(val && typeof val === "object"){
				// OLD と NEW の両方を持つ -> 差分ノードとみなす
				if(Object.prototype.hasOwnProperty.call(val, this.OLD) && Object.prototype.hasOwnProperty.call(val, this.NEW)){
					// パスをキーにして { old, new } 形式で格納
					result[path] = {
						old: val[this.OLD],
						new: val[this.NEW]
					};
				} else {
					// まだネストがある -> 再帰的に探索
					this._flattenDiff(val, path, result);
				}
			}
		}

		// 最終的に { "path": { old: x, new: y }, ... } の形で返す
		return result;
	}

	// diff（_diffObjectsの返り値）を“型”として使い、source から差分に該当する部分だけ抜き出す
	// - "差分に関与した元の値だけ" をスナップショット化したいときに利用する内部ユーティリティ
	_snapshot_from_by_diff(source, diff){
		if(source==null || typeof diff!=="object" || diff==null) return {};

		const out = Array.isArray(source) ? [] : {};
		for(const key in diff){
			const d = diff[key];

			// 末端（__old/__new or Symbol OLD/NEW がある）なら、そのキーの値を丸ごと拾う
			if(d && typeof d==="object" && Object.prototype.hasOwnProperty.call(d, this.OLD) && Object.prototype.hasOwnProperty.call(d, this.NEW)){
				out[key] = source ? source[key] : undefined;
				continue;
			}

			// ネストしている場合は再帰で部分オブジェクトを抽出
			const child_src = source ? source[key] : undefined;
			const picked = this._snapshot_from_by_diff(child_src, d);

			// 空オブジェクト/空配列は入れない（=“差分だけ”を維持）
			if(Array.isArray(picked) ? picked.length>0 : Object.keys(picked).length>0){
				// 配列なら sparse になる可能性がある点だけ注意（必要なら再パック）
				out[key] = picked;
			}
		}
		return out;
	}

	// ログ用に人間が読みやすい形に変換
	// これは外部ように設けた関数で、内部では使用していません。
	// - Symbol キーを __old/__new に写し替え、JSON 出力に載せやすくする
	stringifyDiff(diff){
		const replacer = (key, value) => {
			if(key === "") return value; // root
			if(typeof value === "object" && value !== null){
				const newObj = {};
				for(const k of Reflect.ownKeys(value)){
					if(typeof k === "symbol"){
						if(k.description === "oldValue") newObj.__old = value[k];
						if(k.description === "newValue") newObj.__new = value[k];
					}else{
						newObj[k] = value[k];
					}
				}
				return newObj;
			}
			return value;
		};
		return JSON.stringify(diff, replacer, 2);
	}
	_wrap_data(obj){

		//if(!this._observe_mode) return obj;
		// 監視オフ時は包まない（終了時の全体差分のみ）
		if(!this._observe_mode) return obj;

		// そのまま返して問題ない型は素通り
		if(obj==null || typeof obj!=="object") return obj;

		// すでに Sercrod が包んだ Proxy なら二重ラップしない
		//if(this.constructor._proxy_map.has(obj)) return obj;
		// 既存の raw->proxy があれば再利用
		if(this.constructor._raw_to_proxy_map.has(obj)) return this.constructor._raw_to_proxy_map.get(obj);

		const raw = obj;
		// Proxy ハンドラ:
		// - get: 観測対象の枝だけ遅延プロキシ化（深いネストでも必要な所のみラップ）
		// - set: 既存値と同値は無視、観測対象キーのみ sercrod-change を発火
		//   差分自体は finalize で集計（大量更新をトランザクションでまとめる）
		const proxy = new Proxy(raw, {
			get:(target, key, receiver)=>{
				const v = Reflect.get(target, key, receiver);
				// 「観測対象」に該当する枝だけ遅延プロキシ化
				if(this._observe_mode && v && typeof v==="object"){
					if(this._shouldWrapChild(target, key, v)){
						if(this.constructor._proxy_map.has(v)) return v;
						if(this.constructor._raw_to_proxy_map.has(v)) return this.constructor._raw_to_proxy_map.get(v);
						return this._wrap_data(v);
					}
				}
				return v;
			},
			set:(target, key, value, receiver)=>{
				const oldVal = target[key];
				const ok = Reflect.set(target, key, value, receiver);

				// 差分計算は finalize 時にまとめる
				//this._schedule_update();
				// 1) 同値なら何もしない（タッチ代入対策）
				if(oldVal === value) return ok;

				// 観測対象のキーだけイベント発火
				if(this._isObservedKey(target, key)){
					this.dispatchEvent(new CustomEvent("sercrod-change", {
						detail: { host:this, parent:target, key, old:oldVal, new:value }
					}));
				}

				// 2) 差分計算は finalize 時にまとめる
				//this._schedule_update();

				return ok;
			}
		});
		// Proxy 自身にはプロパティを置けないため、WeakMap に対応を保存
		this.constructor._proxy_map.set(proxy, raw);
		// 双方向の対応を保存（unwrap と raw->proxy 再利用のため）
		this.constructor._raw_to_proxy_map.set(raw, proxy);

		return proxy;
	}
	_unwrap_data(obj){
		// Sercrod 管理の Proxy -> raw を取り出す（外部連携などで生が必要な場合の内部用）
		if(obj && typeof obj==="object"){
			// Sercrod 管理の Proxy なら生を返す
			const raw = this.constructor._proxy_map.get(obj);
			if(raw) return raw;

			// 旧実装との互換（self-loop を避ける）
			if(obj.__raw && obj.__raw !== obj) return obj.__raw;
		}
		return obj;
	}

	// 1フレームに1回だけ update を予約
	// - 描画中の変更は _needs_post_update に積み、描画終了後に一度だけ再スケジュール
	_schedule_update(){
		//if(this._updating) return;               // 描画中は無視
		//if(this._update_scheduled) return;
		// 描画中に来た更新は、後で1回だけ再実行するために記録
		if(this._updating){
			this._needs_post_update = true;
			return;
		}
		if(this._update_scheduled) return;

		this._update_scheduled = true;
		requestAnimationFrame(()=>{
			this._update_scheduled = false;
		});
	}
	// フラグ逆引きインデックス（this配下専用）
	// - 再構築は _rebuild_flag_index から呼び出し。O(N) 順走査で軽量に作成。
	_clear_flag_index(){
		this._flag_index = Object.create(null);
	}
	_index_add(el, flag){
		(this._flag_index[flag] || (this._flag_index[flag] = new Set())).add(el);
	}
	// （将来使う想定）指定フラグの要素を取得
	_get_flagged(flag){
		const s = this._flag_index[flag];
		return s ? Array.from(s) : [];
	}

	// 指定要素にフラグを追加（直接プロパティ版）
	// - node._sercrod_flags は Set：重複防止、GC による自然解放
	add_flag(el, flag){
		// セットが無ければ作成
		if(!el._sercrod_flags) el._sercrod_flags = new Set();	// Set は JavaScript の重複禁止コレクション
		el._sercrod_flags.add(flag);
		return el._sercrod_flags;
	}
	// 要素が指定フラグを持っているか調べる（直接プロパティ版）
	has_flag(el, flag){
		return !!(el && el._sercrod_flags && el._sercrod_flags.has(flag));
	}

	// ノードの属性から Sercrod 対象フラグ（*, @, :）を抽出
	_collect_flags_from(node){
		const out = [];
		if(!node.hasAttributes()) return out;
		for(const a of Array.from(node.attributes)){
			let n = a.name;
			if(n.startsWith("n-")) n = "*" + n.slice(2);
			//if(n.startsWith("*") || n.startsWith("@") || n.startsWith(":")){
			if(n.startsWith("*") || n.startsWith(this.constructor._config.events.prefix) || n.startsWith(":")){
				out.push(n);
			}
		}
		return out;
	}

	// querySelectorAll を使わない再構築
	// - 各要素に直付与した _sercrod_flags（Set）を順走査で収集
	_rebuild_flag_index(){
		this._clear_flag_index();
		// this 配下を丁寧に順走査して、_sercrod_flags が無ければ即スキップ
		const walk = (node)=>{
			// 要素ノードのみ見る（テキスト等は素通り）
			if(node.nodeType === 1){
				const flags = node._sercrod_flags;
				if(flags && flags.size){
					for(const f of flags) this._index_add(node, f);
				}
				// 子をループ（firstChild/nextSibling で軽量に）
				for(let c = node.firstChild; c; c = c.nextSibling){
					walk(c);
				}
				return;
			}
			// 非要素でも子は持ち得るので念のため
			for(let c = node.firstChild; c; c = c.nextSibling){
				walk(c);
			}
		};
		// ルート直下から開始（ホスト自身は除外でOK／必要なら walk(this) に変える）
		for(let c = this.firstChild; c; c = c.nextSibling){
			walk(c);
		}
	}

	// 単体登録: keys 省略でその raw の全キー監視
	// - 返り値: 呼び出し側が以後 Proxy を使えるよう、該当 raw の Proxy（なければ raw のまま）
	observe(rawOrProxy, ...keys){
		// 1) Proxy なら raw へ正規化
		const raw = this.constructor._proxy_map.get(rawOrProxy) || rawOrProxy;
		if(!raw || typeof raw!=="object") return raw;

		// 2) 監視登録（true か Set）
		if(keys.length === 0){
			this._observed.set(raw, true);
		}else{
			const cur = this._observed.get(raw);
			if(cur !== true){
				const s = cur instanceof Set ? cur : new Set();
				for(const k of keys) s.add(String(k));
				this._observed.set(raw, s);
			}
		}

		// 3 observe モード時は「その場で」ラップを用意（遅延ラップのプライム）
		if(this._observe_mode && !this.constructor._raw_to_proxy_map.has(raw)){
			this._wrap_data(raw);                    // 親にまだ挿さっていても、raw -> proxy を準備
		}

		// 4) 呼び出し側が以後 Proxy を使えるよう返す（なければ raw のまま）
		return this.constructor._raw_to_proxy_map.get(raw) || raw;
	}

	// 複数登録: [[raw, 'key1','key2'], [raw2], ...]
	// - 戻り値: 登録した各 raw の Proxy（または raw）
	observeMany(list){
		const proxies = [];
		for(const item of list){
			const [raw, ...keys] = item;
			proxies.push(this.observe(raw, ...keys));
		}
		return proxies; // 返り値が欲しくなければ void でもOK
	}

	// その raw 自体が観測対象か
	_isObservedObj(raw){
		const m = this._observed.get(raw);
		return m === true || (m instanceof Set && m.size > 0);
	}
	// raw の特定キーが観測対象か
	_isObservedKey(raw, key){
		const m = this._observed.get(raw);
		if(m === true) return true;
		return (m instanceof Set) && m.has(String(key));
	}
	// ユーティリティ: case 判定
	// - *switch の *case 判定に使用。関数/正規表現/配列/Set/真偽/プリミティブ等を包括サポート。
	_matchCase(raw, switchVal, scope, node){
		let v, evalOk = true;
		try{
			v = this.eval_expr(raw, {...scope, $switch: switchVal}, {el: node, mode:"case"});
		}catch(e){ evalOk = false; }

		if(evalOk){
			// 1) 型に応じて判定
			if(typeof v === "function") try{ return !!v(switchVal, scope); }catch{ return false; }
			if(v instanceof RegExp) try{ return v.test(String(switchVal)); }catch{ return false; }
			if(Array.isArray(v)) return v.some(x => Object.is(x, switchVal));
			// Set 等
			if(v && typeof v === "object" && typeof v.has === "function") try{ return v.has(switchVal); }catch{ /* noop */ }
			if(typeof v === "boolean") return v;
			if(["string","number","bigint"].includes(typeof v)) return Object.is(v, switchVal);
			return false;
		}

		// 2) フォールバック：値リスト "a|b" / "1,2"
		const tokens = raw.split(/[,|]/).map(s=>s.trim()).filter(Boolean);
		if(!tokens.length) return false;
		for(const t of tokens){
			let vv;
			try{ vv = this.eval_expr(t, scope, {el: node, mode:"caseval"}); }
			catch{ vv = t; }
			if(Object.is(vv, switchVal)) return true;
		}
		return false;
	}
	// 判定ユーティリティ
	// - _observe_mode に従い、対象(target,key)を監視すべきかどうか
	_shouldWatch(target, key){
		if(this._observe_mode === "off") return false;
		if(this._observe_mode === "all") return true;

		// "observed"
		const mark = this._observed.get(target);
		if(mark === true) return true;               // そのraw配下すべて
		if(mark instanceof Set) return mark.has(String(key)); // キー限定
		return false;
	}

	// 親raw/keyの指定、もしくは子raw自身の登録があれば包む
	//_shouldWrapChild(parentRaw, key, childRaw){
	//	return this._isObservedKey(parentRaw, key) || this._isObservedObj(childRaw);
	//}
	// observe モード別の詳細条件で判定
	_shouldWrapChild(target, key, childObj){
		if(this._observe_mode === "off") return false;
		if(this._observe_mode === "all") return true;

		// "observed":
		// 1) 親に対して全監視/キー監視が付いている
		if(this._observed.get(target) === true) return true;
		const s = this._observed.get(target);
		if(s instanceof Set && s.has(String(key))) return true;

		// 2) 取り出された child 自体が観測登録されている（raw 単位）
		return this._observed.has(childObj);
	}
	// 反復対象を [k,v] の配列へ正規化
	_normalize_pairs(iterable, modeWord, hasKeyVar){
		const pairs = [];
		if(Array.isArray(iterable)){
			// 単一変数 + "in" は後方互換で値列挙（= of）
			const treatAsOf = (modeWord==="of") || (!hasKeyVar && modeWord==="in");
			if(treatAsOf){
				let i = 0;
				for(const v of iterable) pairs.push([i++, v]);
			}else{
				// 厳密 "in": キー列挙（v も取りたいので配列から取り直す）
				for(const k in iterable) pairs.push([k, iterable[k]]);
			}
		}else if(iterable && typeof iterable==="object"){
			if(modeWord==="of"){
				for(const [k,v] of Object.entries(iterable)) pairs.push([k, v]);
			}else{ // "in": キー列挙（v は k から取得）
				for(const k in iterable) pairs.push([k, iterable[k]]);
			}
		}
		return pairs;
	}
	_data_has_key(key){
		// _data が未設定なら即 false。以降の判定をスキップして安全に抜ける。
		if(this._data==null) return false;

		// まずは hasOwnProperty（最も厳密）。「自分の」プロパティであるかを判定。
		if(Object.prototype.hasOwnProperty.call(this._data, key)) return true;

		// 次に "in"（継承・Proxy も含める）。own でなくとも「見える」なら true。
		try{
			return (key in this._data);
		}catch(_e){
			// Proxy が例外を投げる等の想定外に備え、最後にフォールバック。
			try{
				return Object.prototype.hasOwnProperty.call(this._data||{}, key);
			}catch(__e){
				// すべてダメなら安全側で false。
				return false;
			}
		}
	}

	_find_scope_owner(scope, key){
		// with() 下で使う「評価スコープ」の原型チェーンを上に辿る。
		// inner(Object.create(effScope)) -> effScope -> ... -> Object.prototype
		let cur = scope;
		while(cur && cur!==Object.prototype){
			// 「自分の」プロパティを最優先で返す（shadowing を尊重）。
			if(Object.prototype.hasOwnProperty.call(cur, key)) return cur;
			// 一段ずつ上に上がる。
			cur = Object.getPrototypeOf(cur);
		}
		// どこにも無ければ null（＝所有者はいない）。
		return null;
	}

	_assign_scoped_simple(scope, key, value){
		// 1) まず「スコープ連鎖上の所有者」を探し、見つかればそこへ書く。
		const owner = this._find_scope_owner(scope, key);
		if(owner){
			owner[key] = value;                    // 所有者を直接更新（最優先）
			return "scope-owner";                 // デバッグ用の戻り値
		}

		// 2) 所有者がいない -> data に既存キーがあれば data へ書く。
		if(this._data_has_key(key)){
			this._data[key] = value;              // data 側を更新
			return "data";
		}

		// 3) 最後に globalThis（window）へフォールバック。
		globalThis[key] = value;                      // 明示的にグローバルへ
		return "global";
	}

	_setpath(root, path, value){
		// ネスト代入の下準備：途中にオブジェクトが無ければ都度つくる（安全側）。
		// 例: path=["user","profile","name"] を順に潜る。
		let cur = root;
		for(let i=0;i<path.length-1;i++){
			const k = path[i];
			// 値が未定義 or オブジェクト以外 -> 空オブジェクトで用意
			if(cur[k]==null || typeof cur[k]!=="object") cur[k] = {};
			// 次の段へ。
			cur = cur[k];
		}
		// 最終段に value をセット。
		cur[path[path.length-1]] = value;
	}

	_makehole_scoped(path, scope){
		// “穴（hole）”はプロパティアクセスの「途中段」で返すプレースホルダ。
		// 例: a.b.c = v のとき、a.b に get された時点では値が無いので「穴」を返し、
		//     最後の = で set が来た瞬間に「どこへ書くか」を決めて一気に書き込む。
		return new Proxy(Object.create(null), {
			get: (_t,k)=>{
				// + 演算などの型変換が走ったときにエラー化しないための最低限の実装。
				if(k===Symbol.toPrimitive) return (hint)=> (hint==="string" ? "" : undefined);
				if(k==="toString") return ()=> "";
				if(k==="valueOf")  return ()=> undefined;
				// さらに深いプロパティへ進むたびに path を伸ばした新しい穴を返す。
				return this._makehole_scoped(path.concat(String(k)), scope);
			},
			set: (_t,k,v)=>{
				// = が来た瞬間に「代入の着地点」を確定する。
				const root_name = path[0];

				// 1) まず scope 連鎖の所有者を優先（shadowing を壊さない）。
				let root = this._find_scope_owner(scope, root_name);

				// 2) 所有者がいなければ data 既存キー -> 無ければ global の順。
				if(!root) root = this._data_has_key(root_name) ? this._data : globalThis;

				// 確定した root に対してネスト代入を実行。
				this._setpath(root, path.concat(String(k)), v);
				return true;
			},
			has(){
				// with() 内の "in" 判定で false が返ると評価が崩れることがあるため、常に true。
				return true;
			}
		});
	}
	_mark_dirty(target, key){
		// すでにdirtyならスキップ
		if(Sercrod._pending_updates.has(target)) return;

		// どの world に属する Proxy か識別（弱参照などで）
		const world = Sercrod._world_map.get(target);
		if(world){
			world._dirty = true;
			Sercrod._pending_updates.add(world);
		}

		// スケジュール（1フレームに1回だけ）
		Sercrod._schedule_update();
	}
	// === 追記（Sercrod クラス内）=================================================
	// 1) ディレクティブ登録（既存の static directives へ追記）
	// "*upload",              "n-upload",
	// "*download",            "n-download",

	// 2) ディレクティブ分配ロジック（既存のスイッチ等へ追記）
	// case "n-upload": this._bind_upload(el, value); break;
	// case "n-download": this._bind_download(el, value); break;

	// 3) 実装本体（以下のメソッド群を Sercrod クラスへ追加）
	// ---------------------------------------------------------------------------
	// 目的:
	// - *upload: 任意要素を装飾可能な「アップロードボタン」にする
	//   - hidden な <input type="file"> を要素直下に生成・再利用
	//   - 選択されたファイルを XMLHttpRequest + FormData で送信（進捗対応）
	// - *download: 任意要素を「ダウンロードボタン」にする
	//   - 既定は fetch で Blob を取得し、<a download> で保存
	//   - corporate proxy 等の事情で fetch が不安定な環境向けに transport:"xhr" で XHR も選択可
	//
	// イベント（bubbles:true, composed:true で外側からも受け取りやすい）:
	// - アップロード:
	//   "sercrod-upload-start"    detail:{host, el, files, url, with}
	//   "sercrod-upload-progress" detail:{host, el, loaded, total, percent}
	//   "sercrod-uploaded"        detail:{host, el, response, status}
	//   エラー時: "sercrod-error" detail:{host, el, stage:"upload"|"upload-init", error}
	// - ダウンロード:
	//   "sercrod-download-start"  detail:{host, el, url}
	//   "sercrod-downloaded"      detail:{host, el, url, filename, status}
	//   エラー時: "sercrod-error" detail:{host, el, stage:"download"|"download-init", error}
	//
	// 設定値（式の評価結果で指定、文字列/オブジェクトの両対応）:
	// - *upload 値（string|object）:
	//   string -> { url }
	//   object -> { url(必須), method="POST", field="file", with={}, headers={}, credentials=false }
	//   ※ FormData に file を詰める。複数は file[0], file[1]... の配列風キー。
	//   ※ 要素側の属性 accept/multiple/capture は hidden input に反映。
	// - *download 値（string|object）:
	//   string -> { url }
	//   object -> { url(必須), method="GET", headers={}, credentials=false, filename=null, transport="fetch"|"xhr"(既定 "fetch") }
	//
	// コーディング規約対応:
	// - 変数/関数はスネークケース、ダブルクォート、if( や ){ のスペースなし、テンプレートリテラル積極活用。
	// ---------------------------------------------------------------------------

	// === アップロードのバインド ==================================================
	// upload オプションは「式」を与える設計に統一
	// - expr を scope で評価して {url, method, ...} に正規化
	// - ctx_el は eval の文脈（エラーログやフィルタ向け）
	_bind_upload(el, expr, scope=this._data, ctx_el=el){
		// === 多重バインド防止 ===
		// 再レンダ時に同じ要素へ重ねてイベントを付与しないためのフラグ。
		// 既存要素の場合は URL/opts の更新だけ行い、リスナは再登録しません。
		if(el.__sercrod_upload_bound){
			try{
				const resolved=this._coerce(expr, scope, ctx_el);           // 下のローカル関数で評価/フォールバック
				const opt=_merge_opts_from_attrs(this._normalize_upload_opts(resolved), ctx_el);
				el.__sercrod_upload_opt = opt;
				// 入力要素の accept/name を更新（存在すれば）
				if(el.__sercrod_upload_input){
					if(opt.accept!=null) el.__sercrod_upload_input.setAttribute("accept", opt.accept);
					if(opt.name!=null)   el.__sercrod_upload_input.setAttribute("name",   opt.name);
				}
				return;
			}catch(error){
				this.dispatchEvent(new CustomEvent("sercrod-error",{
					detail:{host:this,el,stage:"upload-init",error},
					bubbles:true, composed:true
				}));
				return;
			}
		}
		el.__sercrod_upload_bound = true; // ここで初回バインド扱い

		// --- 1) 式 or リテラル or 関数 or オブジェクトを安全に解決 ---
		let resolved;
		try{
			resolved=this._coerce(expr, scope, ctx_el);
		}catch(error){
			// 準備段階（式評価/設定不備等）でのエラー
			this.dispatchEvent(new CustomEvent("sercrod-error",{
				detail:{host:this,el,stage:"upload-init",error},
				bubbles:true, composed:true
			}));
			return;
		}

		// 正規化（url/with/name/accept などに揃える）＋ 属性からの補完
		const opt=_merge_opts_from_attrs(this._normalize_upload_opts(resolved), ctx_el);
		el.__sercrod_upload_opt = opt;

		// --- 2) アクセシビリティ補完 ---
		// クリック・Enter・Space で操作できるよう role/tabindex を補完
		this._ensure_clickable(el);

		// --- 3) 隠し <input type="file"> 準備（初回のみ生成・以降再利用） ---
		const _input=this._ensure_hidden_file_input(el, opt);
		el.__sercrod_upload_input = _input;

		// --- 4) *into の取り出し（成功時にレスポンスを格納） ---
		const into = ctx_el.getAttribute("*into") ?? ctx_el.getAttribute("n-into") ?? null;
		el.__sercrod_upload_into = into;

		// --- 5) イベントハンドラ定義（参照を保持しておくと解除も可能） ---
		const on_click = ()=>_input.click();
		const on_key   =(e)=>{ if((e.key==="Enter"||e.key===" ")&&!e.repeat){ e.preventDefault(); _input.click(); } };

		el.addEventListener("click", on_click);
		el.addEventListener("keydown", on_key);
		el.__sercrod_upload_on_click = on_click;
		el.__sercrod_upload_on_key   = on_key;

		// ファイル選択後に送信開始
		const on_change = async()=>{
			// キャンセル等でファイル無しなら何もしない
			if(!_input.files||_input.files.length===0)return;

			try{
				// 送信開始イベント（UI でローディング表示の切替等に活用）
				this.dispatchEvent(new CustomEvent("sercrod-upload-start",{
					detail:{host:this,el,files:_input.files,url:opt.url,with:opt.with},
					bubbles:true, composed:true
				}));

				// XHR で送信（進捗イベント対応）
				const res=await this._xhr_upload(opt, _input.files, el);

				// 完了イベント。response はテキスト/JSON 自動判定で JSON 化（失敗時は文字列）
				this.dispatchEvent(new CustomEvent("sercrod-uploaded",{
					detail:{host:this,el,response:res.body,status:res.status},
					bubbles:true, composed:true
				}));

				// --- 5.1) 結果の格納 ---
				// *into への反映（あれば） ---
				// 既定: *into 未指定なら "$upload" に格納して保持（_intos へは積まない）
				// 明示: *into 指定がある場合は、そのキーへ格納し、_intos に積んで次周でクリア
				const key = el.__sercrod_upload_into || "$upload"; // 念のためフォールバック
				this._data[key] = res.body;
				if(!this._data.$upload) this._data.$upload = res.body;
				// finalize のクリア対象にするのは「*into を明示した場合のみ」
				//if(this._intos && el.__sercrod_upload_into_is_explicit) this._intos.push(key);
				this._intos.push(key);
				this.update(true);
			}catch(error){
				// 送信中のエラー（ネットワーク/HTTP 非 2xx 等）
				this.dispatchEvent(new CustomEvent("sercrod-error",{
					detail:{host:this,el,stage:"upload",error},
					bubbles:true, composed:true
				}));
			}finally{
				// 同じファイルを続けて選べるよう値をクリア
				_input.value="";
			}
		};
		_input.addEventListener("change", on_change);
		el.__sercrod_upload_on_change = on_change;

		// attribute に書かれた accept/name を opt に補完
		function _merge_opts_from_attrs(opt, el){
			if(!opt||typeof opt!=="object") opt = {};
			if(opt.accept==null && el.hasAttribute("accept")) opt.accept = el.getAttribute("accept");
			if(opt.name==null   && el.hasAttribute("name"))   opt.name   = el.getAttribute("name");
			return opt;
		}
	}

	// === ダウンロードのバインド ==================================================
	// download も upload と同様に「式 + スコープ」を評価してから実行
	// 値の評価から取得・保存までを一貫処理。transport で fetch/xhr を選択可能
	_bind_download(el, expr, scope = this._data, ctx_el = el){
		try{
			const opt = this._normalize_download_opts(
				this.eval_expr(expr, scope, { el: ctx_el, mode: "download" })
			);

			// クリック/Enter/Space 操作に対応
			this._ensure_clickable(el);

			// 実行本体（クリック/キー共通で呼ぶ）
			const on_click=async(e)=>{
				// <a> であっても既定遷移は停止し、Blob から保存を行う
				e.preventDefault();

				try{
					// 開始イベント
					this.dispatchEvent(new CustomEvent("sercrod-download-start",{
						detail:{host:this,el,url:opt.url},
						bubbles:true, composed:true
					}));

					let _blob=null, _status=200;

					if(opt.transport==="xhr"){
						// corporate proxy 等で fetch が不安定な場合の代替経路
						const res=await this._xhr_download(opt);
						_blob=res.blob;
						_status=res.status;
					}else{
						// 既定は fetch。認証やキャッシュ制御はオプションに従う
						const res=await fetch(opt.url,{
							method:opt.method||"GET",
							headers:opt.headers||{},
							credentials:opt.credentials?"include":"same-origin",
							cache:"no-cache"
						});
						if(!res.ok)throw new Error(`HTTP ${res.status}`);
						_status=res.status;
						_blob=await res.blob();
					}

					// ObjectURL + <a download> の標準的な保存トリガー
					const _a=document.createElement("a");
					const _u=URL.createObjectURL(_blob);
					_a.href=_u;
					_a.download=opt.filename||"download";
					document.body.appendChild(_a);
					_a.click();
					document.body.removeChild(_a);
					URL.revokeObjectURL(_u);

					// 完了イベント
					this.dispatchEvent(new CustomEvent("sercrod-downloaded",{
						detail:{host:this,el,url:opt.url,filename:opt.filename||"download",status:_status},
						bubbles:true, composed:true
					}));
				}catch(error){
					// ダウンロード中のエラー
					this.dispatchEvent(new CustomEvent("sercrod-error",{
						detail:{host:this,el,stage:"download",error},
						bubbles:true, composed:true
					}));
				}
			};

			el.addEventListener("click", on_click);
			el.addEventListener("keydown",(e)=>{ if((e.key==="Enter"||e.key===" ")&&!e.repeat){ e.preventDefault(); on_click(e); } });
		}catch(error){
			// 準備段階（式評価/設定不備等）でのエラー
			this.dispatchEvent(new CustomEvent("sercrod-error",{
				detail:{host:this,el,stage:"download-init",error},
				bubbles:true, composed:true
			}));
		}
	}

	// === オプション正規化（upload） ==============================================
	// 許容形:
	// - 文字列 -> { url: "<文字列>" }
	// - オブジェクト -> { url(必須), method="POST", field="file", with={}, headers={}, credentials=false }
	_normalize_upload_opts(v){
		if(typeof v==="string")return{url:v,method:"POST",field:"file",with:{},headers:{},credentials:false};
		if(!v||!v.url)throw new Error("upload url required");
		if(!v.method)v.method="POST";   // 既定は POST
		if(!v.field)v.field="file";     // 単一: "file", 複数: "file[0]" 形式で付与
		if(!v.with)v.with={};           // 追加の FormData キーを自由に送れる
		if(!v.headers)v.headers={};     // CSRF 等のヘッダー
		return v;
	}

	// === オプション正規化（download） ============================================
	// 許容形:
	// - 文字列 -> { url: "<文字列>" }
	// - オブジェクト -> { url(必須), method="GET", headers={}, credentials=false, filename=null, transport="fetch"|"xhr" }
	_normalize_download_opts(v){
		if(typeof v==="string")return{url:v,method:"GET",headers:{},credentials:false,filename:null,transport:"fetch"};
		if(!v||!v.url)throw new Error("download url required");
		if(!v.method)v.method="GET";      // 既定は GET
		if(!v.headers)v.headers={};       // 認証等のヘッダー
		if(!v.transport)v.transport="fetch"; // 互換性事情で XHR を使いたい場合は "xhr"
		return v;
	}

	// === 操作性補助（クリック/キー操作のアクセシビリティ） ========================
	_ensure_clickable(el){
		// 既に role/tabindex がある場合は尊重
		if(!el.hasAttribute("role"))el.setAttribute("role","button");
		if(!el.hasAttribute("tabindex"))el.tabIndex=0;
	}

	// === 隠し <input type="file"> の生成・反映 ====================================
	// - display:none だと一部ブラウザで .click() が遮断される懸念があるため、画面外へ移動させる
	// - 要素側に記述した accept/multiple/capture を hidden input に反映する
	_ensure_hidden_file_input(el, opt){
		let _input=el.querySelector("input[type=\"file\"][data-sercrod-generated=\"1\"]");
		if(!_input){
			_input=document.createElement("input");
			_input.type="file";
			_input.setAttribute("data-sercrod-generated","1");
			_input.style.position="fixed";
			_input.style.left="-100rem";
			_input.style.top="-100rem";
			el.appendChild(_input);
		}
		// 受け入れ拡張子・MIME
		if(el.hasAttribute("accept"))_input.setAttribute("accept", el.getAttribute("accept")||"");
		else _input.removeAttribute("accept");

		// 複数選択の可否
		if(el.hasAttribute("multiple"))_input.setAttribute("multiple","");
		else _input.removeAttribute("multiple");

		// カメラ等の優先入力（対応端末のみ）
		if(el.hasAttribute("capture"))_input.setAttribute("capture", el.getAttribute("capture")||"");
		else _input.removeAttribute("capture");

		// 参照として保持（現状未使用、拡張時のため）
		_input._sercrod_upload_opt=opt;
		return _input;
	}

	// === XHR でアップロード（進捗イベント対応） ==================================
	// - fetch はアップロード進捗イベントが標準化途上のため XHR を採用
	// - Content-Type は XHR が FormData から自動設定するため、明示指定は不要
	_xhr_upload(opt, file_list, el){
		return new Promise((resolve,reject)=>{
			const fd=new FormData();

			// ファイルの詰め方:
			// 単一: fd.append("file", file)
			// 複数: fd.append("file[0]", f0), fd.append("file[1]", f1)...
			const field=opt.field||"file";
			for(let i=0;i<file_list.length;i++){
				fd.append(file_list.length>1?`${field}[${i}]`:field, file_list[i]);
			}

			// 追加のキー（メタ情報や CSRF トークン等）
			if(opt.with&&typeof opt.with==="object"){
				for(const k in opt.with)fd.append(k, opt.with[k]);
			}

			const xhr=new XMLHttpRequest();
			xhr.open(opt.method||"POST", opt.url, true);

			// Cookie を同送する場合（SameSite/ドメイン設定に留意）
			if(opt.credentials)xhr.withCredentials=true;

			// 任意の追加ヘッダー（Content-Type は FormData 任せにする）
			if(opt.headers){
				for(const k in opt.headers)xhr.setRequestHeader(k, opt.headers[k]);
			}

			// アップロード進捗（lengthComputable のときのみ % を算出）
			xhr.upload.onprogress=(e)=>{
				if(!e.lengthComputable)return;
				const percent=Math.round(e.loaded*100/e.total);
				this.dispatchEvent(new CustomEvent("sercrod-upload-progress",{
					detail:{host:this,el,loaded:e.loaded,total:e.total,percent},
					bubbles:true, composed:true
				}));
			};

			// ネットワーク層の失敗
			xhr.onerror=()=>reject(new Error("network error"));

			// 完了監視
			xhr.onreadystatechange=()=>{
				if(xhr.readyState===4){
					const status=xhr.status;
					let body=xhr.responseText;

					// JSON ならパース（失敗時は文字列のまま返す）
					try{ body=JSON.parse(body); }catch(_e){}

					// HTTP 2xx を成功とする
					if(status>=200&&status<300)resolve({status,body});
					else reject(new Error(`HTTP ${status}`));
				}
			};

			// 実送信
			xhr.send(fd);
		});
	}

	// === XHR でダウンロード（transport:"xhr" 指定時に使用） ======================
	_xhr_download(opt){
		return new Promise((resolve,reject)=>{
			const xhr=new XMLHttpRequest();
			xhr.open(opt.method||"GET", opt.url, true);
			xhr.responseType="blob";

			if(opt.credentials)xhr.withCredentials=true;

			if(opt.headers){
				for(const k in opt.headers)xhr.setRequestHeader(k, opt.headers[k]);
			}

			xhr.onerror=()=>reject(new Error("network error"));

			xhr.onload=()=>{
				const s=xhr.status;
				if(s>=200&&s<300)resolve({status:s, blob:xhr.response});
				else reject(new Error(`HTTP ${s}`));
			};

			xhr.send();
		});
	}
	// =============================
	//  WebSocket MVP
	// =============================
	_ensure_ws_state(){
		// _data が未設定 or プリミティブ（文字列など）の場合でも安全に扱えるようにする
		let d = this._data;

		if(!d || typeof d !== "object"){
			// WebSocket 用のメタだけが欲しいので、ここでは空オブジェクトを新規採用
			const raw = {};
			// Proxy ラップ（既に Sercrod がラップ済みの raw を渡すことは基本的にないが念のため）
			this._data = this.constructor._proxy_map.has(raw) ? raw : this._wrap_data(raw);
			d = this._data;
		}

		if(d.$ws_ready     === undefined) d.$ws_ready     = false;
		if(d.$ws_error     === undefined) d.$ws_error     = null;
		if(d.$ws_last      === undefined) d.$ws_last      = null;
		if(!Array.isArray(d.$ws_messages)) d.$ws_messages = [];

		// 直近の切断情報は新規接続試行時にクリア（ログは保持）
		d.$ws_closed_at    = null;
		d.$ws_close_code   = null;
		d.$ws_close_reason = null;
	}
	_has_placeholders(s){
		return typeof s === "string" && (s.includes("${") || /%[^%]+%/.test(s));
	}
	// spec を「式 → テンプレ展開」の順で解決し、{url, protocols, into} に正規化
	_resolve_ws_spec(spec, scope={}, el=null){
		if(spec == null) return null;
		let out = null;
		try{ out = this.eval_expr(String(spec), scope, {el, mode:"attr"}); }catch(_){}
		if(out == null || out === spec) out = this._expand_text(String(spec), scope, el);
		if(typeof out === "object" && out){
			return { url: out.url || "", protocols: out.protocols, into: out.into || "" };
		}
		return { url: String(out || ""), protocols: undefined, into: "" };
	}
	// ホスト属性での自動接続（1 回だけ）
	_init_websocket_host(rawSpec, intoAttr=""){
		this._ensure_ws_state();
		const scope = this._stage ?? this._data;
		const spec  = this._resolve_ws_spec(rawSpec, scope, this);
		const url   = spec?.url || "";
		const into  = intoAttr || spec?.into || "";
		if(!url || this._has_placeholders(url)){
			if(this.error?.warn) console.warn("[Sercrod warn] *websocket(host): URL not expanded", {raw:rawSpec, url});
			return;
		}
		const onceKey = `HOST ${url}`;
		if(this.__wsOnce.has(onceKey)) return;
		this.__wsOnce.add(onceKey);
		this._ws_connect(url, into, this);
	}
	// --- WS: 接続失敗時に抑止フラグ等をクリア（自動リトライはしない） ---
	_ws_clear_retry_flags(url=""){
		try{
			// 以後の判定で「未接続」に見えるようにする
			if(this._ws_map) this._ws_map.delete(url);
		}catch(_){}
		// この update で「試した扱い」になっている場合でも、次回の手動 update で再評価できるようにする
		try{
			if(this._ws_connect_tried instanceof Set){
				this._ws_connect_tried.delete(url);
			}
		}catch(_){}
		// 一度きり実行の抑止セットがあれば解除（ホスト/要素いずれにも対応）
		try{
			if(this.__wsOnce instanceof Set){
				this.__wsOnce.delete(url);
				this.__wsOnce.delete(`HOST ${url}`);
			}
		}catch(_){}
		// 要素版で data-フラグを使っていれば解除（存在すれば）
		try{
			if(this.dataset && this.dataset.wsAutoOnce) delete this.dataset.wsAutoOnce;
		}catch(_){}
		// ループ抑止用ロックが残っていても、次回の手動 update では影響させない
		this._ws_reconnect_lock = false;
	}
	_ws_connect(url, into="", elForEvent=null){

		// before-connect フック（キャンセル・書換可）
		try{
			const detail = { url, into, controller: this.websocket };
			const ev = new CustomEvent("sercrod-ws-before-connect", {
				detail,
				bubbles: true,
				composed: true,
				cancelable: true
			});
			// イベントは elForEvent（子要素経由）優先、無ければホストへ
			(elForEvent || this).dispatchEvent(ev);
			if(ev.defaultPrevented) return null;               // 接続自体を中止
			url  = detail.url || url;                          // フックでの上書きを採用
			into = (detail.into!==undefined ? detail.into : into) || "";
		}catch(_){}

		// 直近の接続引数を保持（reconnect 用）
		this._ws_last_url  = url;
		this._ws_last_into = into;

		const prev = this._ws_map.get(url);
		if(prev && prev.ws && (prev.ws.readyState===WebSocket.OPEN || prev.ws.readyState===WebSocket.CONNECTING)){
			if(into) prev.into = into;
			return prev.ws;
		}
		this._ensure_ws_state();
		this._data.$pending = true;
		this.update(false);
		let ws;
		try{ ws = new WebSocket(url); }
		catch(err){
			this._data.$ws_error = String(err);
			this._data.$pending  = false;
			// 失敗時は抑止系フラグを解除して「次回の明示的な update でだけ」再評価できる状態にする
			this._ws_clear_retry_flags(url);
			// 接続に失敗: 次回の明示的な update でのみ再評価・再接続させるため AST キャッシュを無効化
			this._invalidate_ast_cache_for_next_update();
			this.update(false);
			return null;
		}
		const holder = { ws, into, el: elForEvent || this };
		this._ws_map.set(url, holder);

		// 以後 status() は _data 側のメトリクスを参照（互換維持）

		const dispatch = (name, detail)=>{
			try{ holder.el.dispatchEvent(new CustomEvent(name, { detail, bubbles:true, composed:true })); }catch(_){}
		};
		const place = (value)=>{
			this._data.$ws_last = value;
			try{ this._data.$ws_messages.push(value); }catch(_){}
			if(holder.into){
				this._data[holder.into] = value;
				this._intos.push(holder.into);
			}
			this.update(false);
		};
		ws.onopen = ()=>{
			this._data.$pending  = false;
			this._data.$ws_ready = true;
			this._data.$ws_error = null;
			this.update(false);
			dispatch("sercrod-ws-open", { url });
		};
		ws.onmessage = (ev)=>{
			let payload = ev.data;
			if(typeof payload === "string"){
				const t = payload.trim();
				if((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))){
					try{ payload = JSON.parse(t); }catch(_){}
				}
			}
			place(payload);
			dispatch("sercrod-ws-message", { url, payload });
		};
		ws.onerror = (ev)=>{
			const msg = (ev && ev.message) ? ev.message : "WebSocket error";
			this._data.$ws_error = msg;
			// 次回の手動 update で再試行できるよう、抑止フラグを解除
			try{
				if(this.__wsOnce instanceof Set){
					this.__wsOnce.delete(url);
					this.__wsOnce.delete(`HOST ${url}`);
				}
				this._ws_map.delete(url);
			}catch(_){}
			this.update(false);
			dispatch("sercrod-ws-error", { url, error: msg });
		};
		ws.onclose = (ev)=>{
			this._data.$ws_ready = false;
			// 次回の手動 update で再試行できるよう、抑止フラグを解除
			try{
				if(this.__wsOnce instanceof Set){
					this.__wsOnce.delete(url);
					this.__wsOnce.delete(`HOST ${url}`);
				}
				this._ws_map.delete(url);
			}catch(_){}
			this.update(false);
			// 切断メタを記録（$ws_last は保持：最後に何を受けたかの追跡のため）
			try{
				this._data.$ws_closed_at    = Date.now();
				this._data.$ws_close_code   = ev?.code ?? null;
				this._data.$ws_close_reason = ev?.reason ?? null;
			}catch(_){}
			this.update(false);
			dispatch("sercrod-ws-close", { url, code: this._data.$ws_close_code, reason: this._data.$ws_close_reason, closedAt: this._data.$ws_closed_at });

		};
		return ws;
	}
	_ws_send(urlOrEmpty, payload){
		let target = null;
		if(urlOrEmpty){
			const h = this._ws_map.get(urlOrEmpty);
			if(h && h.ws && h.ws.readyState===WebSocket.OPEN) target = h.ws;
		}else{
			for(const {ws} of this._ws_map.values()){
				if(ws && ws.readyState===WebSocket.OPEN){ target = ws; break; }
			}
		}
		if(!target) return false;
		let out = payload;
		if(typeof out === "object"){
			try{ out = JSON.stringify(out); }catch(_){ out = String(out); }
		}else out = String(out);
		try{ target.send(out); return true; }catch(_){ return false; }
	}

	// ヘルパー：直近の *include ノードの depth を返す
	_get_nearest_include_depth(el){
		let cur = el.parentElement;
		const depth_map = this._include_depth_map;
		while(cur){
			const d = depth_map.get(cur);
			if(typeof d === "number") return d; // 直近の *include（depth 設定済み）発見
			cur = cur.parentElement;
		}
		return 0;
	}
	_resolve_template_name(raw_text, scope, opt){
		const src = String(raw_text==null ? "" : raw_text).trim();
		if(!src) return "";
		const el   = opt && opt.el   ? opt.el   : null;
		const mode = opt && opt.mode ? opt.mode : "include";

		// 1) JS 式として評価を試みる
		try{
			const eva = this.eval_expr(src, scope, {
				el: el,
				mode: mode,
				quiet: true        // ReferenceError 等は握りつぶす
			});
			if(eva!==null && eva!==undefined){
				const s = String(eva).trim();
				if(s) return s;    // 有効な文字列が得られた
			}
		}catch(_e){
			// quiet:true に任せるのでここでは何もしない
		}

		// 2) 評価で有効な値が得られなかった場合、
		//    元の文字列を「そのまま名前として使ってよいか」を判定する
		//    ここでは「JS の変数名風」のものだけ許可する（必要なら調整可）
		const ident_re = /^[A-Za-z_][A-Za-z0-9_-]*$/;
		if(ident_re.test(src)) return src;

		// どちらもダメなら解決失敗
		return "";
	}
	// 直近の world（this → 親 Sercrod → …）を遡って *template を解決
	_lookupTemplateNear(name){
		let w = this; // この Sercrod インスタンス（= 現在の world）
		while(w){
			// 現在の world に登録があればそれを返す
			if(w._template_registry && w._template_registry.has(name)){
				const proto = w._template_registry.get(name);
				const snap  = w._template_attr_snapshot
					? (w._template_attr_snapshot.get(proto) || { inert:false, hidden:false, ariaHidden:null })
					: { inert:false, hidden:false, ariaHidden:null };
				return { proto, snap, world:w };
			}

			// 親方向に素直にたどり、「次の Sercrod(world)」だけを探す
			let el = w;
			// this は Sercrod インスタンスなので HTMLElement でもある前提
			if(!(el instanceof Element) && el.host instanceof Element) el = el.host;

			let cur = el.parentElement;
			while(cur && !this._isSercrod(cur)){
				cur = cur.parentElement;
			}

			// 親 Sercrod が見つかれば次の world、見つからなければ探索終了
			w = cur || null;
		}
		return null;
	}
	// expr を「式→評価」し、失敗したら「リテラル文字列」として扱う。
	// 関数が得られた場合は呼び出して最終値を解決（URL 文字列 or オプションオブジェクト）。
	_coerce(expr, scope, ctx_el){
		// 空文字はそのまま空扱い（normalize 側で検証）
		if(expr===""||expr==null)return expr;
		let v;
		try{
			v = (typeof this!=="undefined" && this.eval_expr)
				? this.eval_expr(expr, scope, {el: ctx_el, mode: "upload"})
				: expr; // テスト等で eval_expr 不在なら素通し
		}catch(_e){
			// ここがフォールバックの肝：評価失敗→リテラルとして使う
			v = expr;
		}
		// 関数なら呼び出して最終値にする（scope/ctx を渡す）
		if(typeof v==="function"){
			try{ v = v.call(scope, {host:this, el:ctx_el, scope}); }
			catch(e){ /* 関数実行に失敗した場合は上位でハンドリング */ throw e; }
		}
		return v;
	}

	//_head(){
	//	// head に流し込むノードが無ければ何もしない
	//	if(!this._head_nodes || this._head_nodes.length===0){
	//		return;
	//	}

	//	const doc  = this.ownerDocument || document;
	//	let head = doc.head;

	//	// head が無い環境への保険
	//	if(!head){
	//		head = doc.createElement("head");
	//		const html = doc.documentElement || doc;
	//		if(html){
	//			html.insertBefore(head, html.firstChild || null);
	//		}else{
	//			doc.appendChild(head);
	//		}
	//	}

	//	// renderNode 側で拾っておいた title / link などを、そのまま head に移動する
	//	for(const el of this._head_nodes){
	//		if(!el) continue;

	//		// もともとの場所から外す（body 側などに残さない）
	//		if(el.parentNode && el.parentNode!==head){
	//			el.parentNode.removeChild(el);
	//		}

	//		// head に追加
	//		head.appendChild(el);
	//	}

	//	// 再利用防止
	//	this._head_nodes.length = 0;
	//}

	// Sercrod クラスのメソッドとして追加
	_unwrap(){
		// *unwrap が無ければ何もしない
		if(!this.hasAttribute("*unwrap")) return;

		// 以後 DOM 上に *unwrap を残さない
		// wrap そのものが消えるので不要になった
		//this.removeAttribute("*unwrap");

		var parent = this.parentNode;
		if(!parent) return;

		// DocumentFragment 経由で、ラッパだけ外す
		var frag = document.createDocumentFragment();
		while(this.firstChild) frag.appendChild(this.firstChild);

		parent.replaceChild(frag, this);
	}

	_finalize(){

		// ヘッド処理
		//this._head();

		// ラッパーを外す
		this._unwrap();

		// $upload と $download のクリア
		requestAnimationFrame(() => {
			this._data.$upload = null;
			this._data.$download = null;
			if(this._intos && this._intos.length) for(const key of this._intos) if(key) this._data[key] = null;
		});

		// 直接指定を追加するので、いったん全体監視は止めておく
		// メモ: ここは現在早期 return（差分集計無効）。将来的に差分イベント/監視を復活させる拡張ポイント。
		if(true) return;
		console.log("finalize");
		const raw = this._unwrap_data(this._data);
		if(!this._snapshot) this._snapshot = structuredClone(raw || {});

		// finalize のタイミングで差分計算
		const differences = raw && this._snapshot ? this._diffObjects(this._snapshot, raw) : {};
		if(differences && Object.keys(differences).length){
			//const flat = this._flattenDiff(differences);
			//this._differences = flat;

			const k_old = this.OLD || "old", k_new = this.NEW || "new";
			const flat = this._flattenDiff(differences);
			this._differences = Object.fromEntries(Object.entries(flat).map(([p, a])=>[p, {
				[k_old]: typeof a?.[k_old]==="object" ? structuredClone(a[k_old]) : a?.[k_old],
				[k_new]: typeof a?.[k_new]==="object" ? structuredClone(a[k_new]) : a?.[k_new]
			}]));

			console.log(flat,"final diff");
		}
		this._snapshot = structuredClone(raw || {});
		this._differences = {}; // 次回に備えてクリア
	}
}

// auto-define for "serc-rod"
(() => {
	try{
		const w = typeof window !== "undefined" ? window : null;
		if(!w || w.SERCROD_NO_AUTO_DEFINE) return;
		//document.addEventListener("DOMContentLoaded", () => { if(!customElements.get("serc-rod")) customElements.define("serc-rod", Sercrod); });
		if(!customElements.get("serc-rod")) customElements.define("serc-rod", Sercrod);
	}catch(_e){}
})();
