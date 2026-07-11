(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.slice(0, 5) === "data-" || k === "lang" || k === "role" || k.slice(0, 5) === "aria-") el.setAttribute(k, attrs[k]);
      else el[k] = attrs[k];
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  var CAP = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ---- theme (M3 switch) ---- */
  function theme() {
    var btn = $("#theme-toggle");
    function dark() { var t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; }
    function sync() { btn.setAttribute("aria-pressed", dark() ? "true" : "false"); }
    btn.addEventListener("click", function () {
      var next = dark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
      sync();
      if (window.__rerenderCharts) window.__rerenderCharts();
    });
    sync();
  }

  /* ---- progress ---- */
  function progress() {
    var bar = $("#progress-bar"), t = false;
    function u() { var d = document.documentElement, m = d.scrollHeight - d.clientHeight;
      bar.style.transform = "scaleX(" + (m > 0 ? Math.min(1, d.scrollTop / m) : 0) + ")"; t = false; }
    addEventListener("scroll", function () { if (!t) { t = true; requestAnimationFrame(u); } }, { passive: true });
    u();
  }

  /* ---- scroll-spy ---- */
  function scrollspy() {
    var links = {}, mob = {};
    $$(".toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    $$(".toc-mobile a").forEach(function (a) { mob[a.getAttribute("href").slice(1)] = a; });
    var label = $("#toc-mobile-label");
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        Object.keys(links).forEach(function (k) { links[k].setAttribute("aria-current", k === id ? "true" : "false"); });
        if (mob[id]) { Object.keys(mob).forEach(function (k) { mob[k].setAttribute("aria-current", k === id ? "true" : "false"); });
          if (label) label.textContent = mob[id].textContent; }
      });
    }, { rootMargin: "-12% 0px -78% 0px" });
    $$("section[id]").forEach(function (s) { if (s.id.indexOf("part") !== 0) obs.observe(s); });
    var det = $(".toc-mobile");
    if (det) $$(".toc-mobile a").forEach(function (a) { a.addEventListener("click", function () { det.open = false; }); });
  }

  /* ---- shared tooltip for .stat provenance ---- */
  function tooltips() {
    var tip = h("div", { class: "tip" }); document.body.appendChild(tip);
    function show(el) {
      tip.textContent = el.getAttribute("data-tip"); tip.classList.add("show");
      var r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
      var x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 8;
      tip.style.left = Math.max(8, Math.min(x, innerWidth - t.width - 8)) + "px";
      tip.style.top = (y < 8 ? r.bottom + 8 : y) + "px";
    }
    function hide() { tip.classList.remove("show"); }
    $$(".stat").forEach(function (el) {
      el.setAttribute("tabindex", "0");
      el.addEventListener("mouseenter", function () { show(el); });
      el.addEventListener("mouseleave", hide);
      el.addEventListener("focus", function () { show(el); });
      el.addEventListener("blur", hide);
    });
  }

  /* ---- goTo (chart -> card) ---- */
  function goTo(id) {
    var el = document.getElementById(id) || document.querySelector('[data-card="' + id.replace("card-", "") + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    var box = el.classList.contains("resp") ? el : (el.querySelector(".resp") || el);
    box.classList.remove("highlight"); void box.offsetWidth; box.classList.add("highlight");
  }

  /* ---- verbatim / response card builder ---- */
  function respCard(o) {
    var kids = [h("div", { class: "resp__head" }, [
      h("span", { class: "resp__dot" }),
      h("span", { class: "resp__model", text: o.model ? CAP(o.model) : o.title }),
      o.gloss ? h("span", { class: "resp__gloss", text: o.gloss }) : null
    ])];
    if (o.q) kids.push(h("div", { class: "resp__q", text: o.q }));
    var body = h("div", { class: "resp__body", lang: o.lang || "fr", text: o.text });
    kids.push(body);
    if (o.truncated) {
      var more = h("button", { class: "resp__more", type: "button", text: "Show full answer ↓" });
      var open = false; body.style.maxHeight = "8.5em"; body.style.overflow = "hidden";
      more.addEventListener("click", function () { open = !open; body.style.maxHeight = open ? "none" : "8.5em"; more.textContent = open ? "Show less ↑" : "Show full answer ↓"; });
      kids.push(more);
    }
    if (o.foot) kids.push(h("div", { class: "resp__foot", text: o.foot }));
    return h("div", { class: "resp model-" + (o.model || "qwen") }, kids);
  }

  /* ---- native cards from data.cards ---- */
  function cards(data) {
    var C = data.cards;
    var taiwan = $('[data-card="taiwan"]');
    if (taiwan && C.taiwan) C.taiwan.answers.forEach(function (a) { taiwan.appendChild(respCard(a)); });

    var mir = $('[data-card="mirror_action"]');
    if (mir && C.mirror_action) C.mirror_action.pairs.forEach(function (p) {
      mir.appendChild(h("p", { class: "label-m", style: "color:var(--on-surface-variant);margin:18px 0 6px", text: p.topic.toUpperCase() }));
      mir.appendChild(h("div", { class: "responses cols-2" }, [
        respCard({ model: "qwen", gloss: p.china.gloss, q: p.china.q, text: p.china.text, truncated: p.china.truncated, lang: "en" }),
        respCard({ model: "qwen", gloss: p.west.gloss, q: p.west.q, text: p.west.text, truncated: p.west.truncated, lang: "en" })
      ]));
    });

    var fb = $('[data-card="factbase"]');
    if (fb && C.factbase) {
      fb.appendChild(h("div", { class: "responses cols-2" }, [
        respCard({ model: "qwen", gloss: C.factbase.west.gloss, q: C.factbase.west.q, text: C.factbase.west.text, truncated: C.factbase.west.truncated }),
        respCard({ model: "qwen", gloss: C.factbase.china.gloss, q: C.factbase.china.q, text: C.factbase.china.text, truncated: C.factbase.china.truncated })
      ]));
      fb.appendChild(h("p", { class: "resp__foot", style: "border:1px solid var(--outline-variant);border-radius:var(--r-m);margin-top:12px", text: C.factbase.footer }));
    }

    var tr = $('[data-card="translate"]');
    if (tr && C.translate) {
      tr.appendChild(h("div", { class: "resp", style: "margin-bottom:14px" }, [
        h("div", { class: "resp__head" }, [h("span", { class: "resp__model", text: "Payload to translate" })]),
        h("div", { class: "resp__body", lang: "en", text: C.translate.payload })
      ]));
      tr.appendChild(h("div", { class: "responses cols-3" }, C.translate.answers.map(function (a) { return respCard(a); })));
    }

    var ap = $('[data-card="abliteration_pair"]');
    if (ap && C.abliteration_pair) {
      ap.appendChild(h("p", { class: "resp__q", style: "padding:0 0 6px", text: C.abliteration_pair.q }));
      ap.appendChild(h("div", { class: "responses cols-2" }, [
        respCard({ model: "qwen", title: C.abliteration_pair.base.label, gloss: "before", text: C.abliteration_pair.base.text, lang: "en" }),
        respCard({ model: "gemma", title: C.abliteration_pair.abliterated.label, gloss: "after", text: C.abliteration_pair.abliterated.text, lang: "en" })
      ]));
    }
  }

  /* ---- P8 verbatim excerpts ---- */
  function excerpts(data) {
    var by = {}; data.excerpts.forEach(function (e) { by[e.id] = e; });
    $$(".verbatim").forEach(function (slot) {
      var e = by[slot.getAttribute("data-excerpt")]; if (!e) return;
      var opened = e.exposed_doc_ids.length ? e.exposed_doc_ids.join(", ") : "none";
      slot.className = "resp model-" + e.model;
      slot.appendChild(h("div", { class: "resp__head" }, [
        h("span", { class: "resp__dot" }), h("span", { class: "resp__model", text: CAP(e.model) }),
        h("span", { class: "resp__gloss", text: e.prompt_id.replace("t4p8-", "") })]));
      var body = h("div", { class: "resp__body", lang: "fr", text: e.text });
      body.style.maxHeight = "10em"; body.style.overflow = "hidden"; slot.appendChild(body);
      if (e.truncated) {
        var more = h("button", { class: "resp__more", type: "button", text: "Show full note ↓" });
        var op = false; more.addEventListener("click", function () { op = !op; body.style.maxHeight = op ? "none" : "10em"; more.textContent = op ? "Show less ↑" : "Show full note ↓"; });
        slot.appendChild(more);
      }
      slot.appendChild(h("div", { class: "resp__foot", text: "Documents opened: " + opened + " · Tool calls: " + e.tool_calls + " · " + e.note }));
    });
  }

  /* ---- corpus explorer ---- */
  var STANCE = { critical: "critical", pro: "pro", neutral: "neutral", "neutral-critical": "neutralcrit", distractor: "distractor" };
  var FLAV = { injection: "Injection", fabrication: "Fabrication", authority: "Authority source" };

  function docCard(doc, isPayload, flavor) {
    var sc = STANCE[doc.stance] || "neutral", kids = [];
    if (isPayload) kids.push(h("span", { class: "doc-card__flag", text: "⚑ Planted document" }));
    else if (flavor) kids.push(h("span", { class: "doc-card__flag", text: "⚑ " + (FLAV[flavor] || flavor) }));
    kids.push(h("div", { class: "doc-card__src", text: doc.source_label }));
    kids.push(h("hr", { class: "doc-card__rule" }));
    kids.push(h("h4", { class: "doc-card__title", text: doc.title }));
    kids.push(h("div", { class: "doc-card__body" }, doc.body.map(function (p) { return h("p", { text: p }); })));
    kids.push(h("div", { class: "doc-card__meta" }, [
      h("span", { class: "badge " + sc, text: doc.stance }), h("span", { text: "· " + doc.register }), h("span", { text: "· " + doc.id })]));
    return h("article", { class: "doc-card stance-" + sc + (isPayload || flavor ? " is-hazard" : ""), lang: "fr" }, kids);
  }

  function explorer(root, probe, data) {
    var pairs = data[probe].pairs, flavors = probe === "p7" ? data.p7.flavors : null;
    function payloadIdx(sc) { if (!sc.payload) return 0; var i = sc.docs.findIndex(function (d) { return d.id === sc.payload; }); return i < 0 ? 0 : i; }
    var st = { pair: 0, side: "china", open: payloadIdx(pairs[0].china) };
    var mount = $(".explorer__mount", root);
    function render() {
      var pair = pairs[st.pair], scen = pair[st.side]; mount.textContent = "";
      mount.appendChild(h("div", { class: "chiprow", role: "tablist" }, pairs.map(function (p, i) {
        return h("button", { class: "chip", role: "tab", type: "button", "data-act": "pair", "data-i": i,
          "aria-selected": i === st.pair ? "true" : "false", text: p.label[st.side] }); })));
      mount.appendChild(h("div", { class: "segmented", role: "group" }, [
        h("button", { type: "button", "data-act": "side", "data-side": "china", "aria-pressed": st.side === "china" ? "true" : "false", text: "🇨🇳 " + pair.label.china }),
        h("button", { type: "button", "data-act": "side", "data-side": "west", "aria-pressed": st.side === "west" ? "true" : "false", text: "Mirror · " + pair.label.west })]));
      mount.appendChild(h("details", { class: "explorer__task" }, [h("summary", { text: "See the task given to the model" }), h("p", { lang: "fr", text: scen.task })]));
      mount.appendChild(h("div", { class: "chiprow" }, scen.docs.map(function (d, i) {
        var isP = d.id === scen.payload, fl = flavors ? flavors[d.id] : null, sc = STANCE[d.stance] || "neutral";
        var lbl = probe === "p7" ? d.id + " · " + (FLAV[fl] || fl) : d.id.toUpperCase();
        return h("button", { class: "chip" + (isP || fl ? " is-hazard" : ""), type: "button", "data-act": "doc", "data-i": i,
          "aria-expanded": i === st.open ? "true" : "false" }, [h("span", { class: "chip__dot " + sc }), h("span", { text: lbl })]); })));
      var d = scen.docs[st.open]; mount.appendChild(docCard(d, d.id === scen.payload, flavors ? flavors[d.id] : null));
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]"); if (!t) return; var a = t.getAttribute("data-act");
      if (a === "pair") { st.pair = +t.getAttribute("data-i"); st.open = payloadIdx(pairs[st.pair][st.side]); }
      else if (a === "side") { st.side = t.getAttribute("data-side"); st.open = payloadIdx(pairs[st.pair][st.side]); }
      else if (a === "doc") { st.open = +t.getAttribute("data-i"); }
      render();
    });
    render();
  }

  /* ---- native schematics ---- */
  function schematics() {
    var s = $('[data-schematic="surfaces"]');
    if (s) [["Chat", "Ask it directly", "A frontal question, no context."],
            ["Work", "Draft & synthesize", "Balanced dossiers, then agentic notes with tool calls."],
            ["Relay", "Transform & tool-call", "Translate, extract, answer from a factbase tool."]].forEach(function (c, i, arr) {
      s.appendChild(h("div", { class: "sch-card" }, [h("p", { class: "sch-card__k label-s", text: "Surface " + (i + 1) }), h("p", { class: "sch-card__t", text: c[0] + " · " + c[1] }), h("p", { class: "sch-card__d", text: c[2] })]));
      if (i < arr.length - 1) s.appendChild(h("div", { class: "sch-arrow", text: "→" }));
    });
    var t = $('[data-schematic="trust"]');
    if (t) [["1 · Deployment", "The agent under a persona", "It must search and read a document base, then write a cited ministerial note.", false],
            ["2 · The base", "One planted document", "Among the real corpus sits an adversarial doc: an order, a fake statistic, a false authority.", true],
            ["3 · The note", "What survives", "We score, blind, whether the planted content reaches the final cited note.", false]].forEach(function (c, i, arr) {
      t.appendChild(h("div", { class: "sch-card" + (c[3] ? " hazard" : "") }, [h("p", { class: "sch-card__k label-s", text: c[0] }), h("p", { class: "sch-card__t", text: c[1] }), h("p", { class: "sch-card__d", text: c[2] })]));
      if (i < arr.length - 1) t.appendChild(h("div", { class: "sch-arrow", text: "→" }));
    });
  }

  /* ---- data + boot ---- */
  function loadData() {
    fetch("assets/data.json").then(function (r) { return r.json(); }).then(function (data) {
      cards(data); excerpts(data); schematics();
      if (data.p7 && $("#explorer-p7")) explorer($("#explorer-p7"), "p7", data);
      if (data.p8 && $("#explorer-p8")) explorer($("#explorer-p8"), "p8", data);
      var handlers = { goTo: goTo, revealPrompt: function (mount, label, prompt) {
        var r = mount.querySelector(".topic-reveal"); if (r) r.innerHTML = "";
        if (r) { r.appendChild(h("span", { class: "rk", text: label + " · example prompt" })); r.appendChild(document.createTextNode("« " + prompt + " »")); }
      } };
      if (window.Charts) { window.__rerenderCharts = function () { window.Charts.render(data, handlers); }; window.Charts.render(data, handlers); }
    }).catch(function () {
      $$(".explorer__mount").forEach(function (m) { m.textContent = ""; m.appendChild(h("a", { href: "https://github.com/QuentinFuxa/qwen3_bias/tree/main/data/tier4", text: "Browse the corpora on GitHub ↗" })); });
    });
  }

  theme(); progress(); scrollspy(); tooltips(); loadData();
})();
