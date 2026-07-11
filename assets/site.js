(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.slice(0, 5) === "data-" || k === "lang" || k === "role") el.setAttribute(k, attrs[k]);
      else el[k] = attrs[k];
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  /* ---- theme ---- */
  function theme() {
    var btn = $("#theme-toggle");
    function dark() {
      var t = document.documentElement.dataset.theme;
      return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function sync() { btn.setAttribute("aria-pressed", dark() ? "true" : "false"); }
    btn.addEventListener("click", function () {
      var next = dark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
      sync();
    });
    sync();
  }

  /* ---- progress bar ---- */
  function progress() {
    var bar = $("#progress-bar"), ticking = false;
    function update() {
      var d = document.documentElement, max = d.scrollHeight - d.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, d.scrollTop / max) : 0) + ")";
      ticking = false;
    }
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---- scroll-spy (desktop TOC + mobile summary) ---- */
  function scrollspy() {
    var links = {}, mobileLinks = {};
    $$(".toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    $$(".toc-mobile a").forEach(function (a) { mobileLinks[a.getAttribute("href").slice(1)] = a; });
    var label = $("#toc-mobile-label");
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        Object.keys(links).forEach(function (k) { links[k].setAttribute("aria-current", k === id ? "true" : "false"); });
        Object.keys(mobileLinks).forEach(function (k) { mobileLinks[k].setAttribute("aria-current", k === id ? "true" : "false"); });
        if (mobileLinks[id] && label) label.textContent = mobileLinks[id].textContent;
      });
    }, { rootMargin: "-15% 0px -75% 0px" });
    $$("section[id]").forEach(function (s) { obs.observe(s); });
    var det = $(".toc-mobile");
    if (det) $$(".toc-mobile a").forEach(function (a) { a.addEventListener("click", function () { det.open = false; }); });
  }

  /* ---- lightbox ---- */
  function lightbox() {
    var dlg = $("#lightbox"), img = $("#lightbox-img"), cap = $("#lightbox-cap"), count = $("#lightbox-count");
    var figs = $$(".fig"), items = figs.map(function (f) {
      var i = $("img", f);
      return { src: i.src, alt: i.alt, cap: (($("figcaption", f) || {}).textContent || "").trim() };
    });
    var idx = 0, opener = null;
    function show(n) {
      idx = (n + items.length) % items.length;
      img.src = items[idx].src; img.alt = items[idx].alt; cap.textContent = items[idx].cap;
      count.textContent = (idx + 1) + " / " + items.length;
      [items[idx + 1] || items[0], items[idx - 1] || items[items.length - 1]].forEach(function (it) { if (it) new Image().src = it.src; });
    }
    figs.forEach(function (f, i) {
      $(".fig__zoom", f).addEventListener("click", function () { opener = $(".fig__zoom", f); show(i); dlg.showModal(); });
    });
    $(".lightbox__next").addEventListener("click", function () { show(idx + 1); });
    $(".lightbox__prev").addEventListener("click", function () { show(idx - 1); });
    $(".lightbox__close").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1); }
    });
    dlg.addEventListener("close", function () { if (opener) opener.focus(); });
  }

  /* ---- corpus explorer ---- */
  var STANCE_CLASS = { critical: "critical", pro: "pro", neutral: "neutral", "neutral-critical": "neutralcrit", distractor: "distractor" };
  var FLAVOR_LABEL = { injection: "Injection", fabrication: "Fabrication", authority: "Fausse autorité" };

  function docCard(doc, isPayload, flavor) {
    var sc = STANCE_CLASS[doc.stance] || "neutral";
    var kids = [];
    if (isPayload) kids.push(h("span", { class: "doc-card__flag", text: "⚑ Document piégé" }));
    else if (flavor) kids.push(h("span", { class: "doc-card__flag", text: "⚑ " + (FLAVOR_LABEL[flavor] || flavor) }));
    kids.push(h("div", { class: "doc-card__src", text: doc.source_label }));
    kids.push(h("hr", { class: "doc-card__rule" }));
    kids.push(h("h4", { class: "doc-card__title", text: doc.title }));
    var body = h("div", { class: "doc-card__body" }, doc.body.map(function (p) { return h("p", { text: p }); }));
    kids.push(body);
    kids.push(h("div", { class: "doc-card__meta" }, [
      h("span", { class: "badge " + sc, text: doc.stance }),
      h("span", { text: "· " + doc.register }),
      h("span", { text: "· " + doc.id })
    ]));
    return h("article", { class: "doc-card stance-" + sc + (isPayload || flavor ? " is-hazard" : ""), lang: "fr" }, kids);
  }

  function explorer(root, probe, data) {
    var pairs = data[probe].pairs;
    var flavors = probe === "p7" ? data.p7.flavors : null;
    function payloadIdx(scen) {
      if (!scen.payload) return 0;
      var i = scen.docs.findIndex(function (d) { return d.id === scen.payload; });
      return i < 0 ? 0 : i;
    }
    var state = { pair: 0, side: "china", open: payloadIdx(pairs[0].china) };
    var mount = $(".explorer__mount", root);

    function render() {
      var pair = pairs[state.pair], scen = pair[state.side];
      mount.textContent = "";

      var pairRow = h("div", { class: "chiprow", role: "tablist" }, pairs.map(function (p, i) {
        return h("button", { class: "chip", role: "tab", type: "button", "data-act": "pair", "data-i": i,
          "aria-selected": i === state.pair ? "true" : "false", text: p.label[state.side] });
      }));
      mount.appendChild(pairRow);

      var toggle = h("div", { class: "mirror-toggle", role: "group" }, [
        h("button", { type: "button", "data-act": "side", "data-side": "china", "aria-pressed": state.side === "china" ? "true" : "false",
          text: "🇨🇳 " + pair.label.china }),
        h("button", { type: "button", "data-act": "side", "data-side": "west", "aria-pressed": state.side === "west" ? "true" : "false",
          text: "Mirror · " + pair.label.west })
      ]);
      mount.appendChild(toggle);

      mount.appendChild(h("details", { class: "explorer__task" }, [
        h("summary", { text: "Voir la consigne donnée au modèle" }),
        h("p", { lang: "fr", text: scen.task })
      ]));

      var docRow = h("div", { class: "chiprow" }, scen.docs.map(function (d, i) {
        var isPayload = d.id === scen.payload;
        var flavor = flavors ? flavors[d.id] : null;
        var sc = STANCE_CLASS[d.stance] || "neutral";
        var label = probe === "p7" ? d.id + " · " + (FLAVOR_LABEL[flavor] || flavor) : d.id.toUpperCase();
        return h("button", { class: "chip" + (isPayload || flavor ? " is-hazard" : ""), type: "button",
          "data-act": "doc", "data-i": i, "aria-expanded": i === state.open ? "true" : "false" }, [
          h("span", { class: "chip__dot " + sc }), h("span", { text: label })
        ]);
      }));
      mount.appendChild(docRow);

      var d = scen.docs[state.open];
      mount.appendChild(docCard(d, d.id === scen.payload, flavors ? flavors[d.id] : null));
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]"); if (!t) return;
      var act = t.getAttribute("data-act");
      if (act === "pair") { state.pair = +t.getAttribute("data-i"); state.open = payloadIdx(pairs[state.pair][state.side]); }
      else if (act === "side") { state.side = t.getAttribute("data-side"); state.pair = Math.min(state.pair, pairs.length - 1); state.open = payloadIdx(pairs[state.pair][state.side]); }
      else if (act === "doc") { state.open = +t.getAttribute("data-i"); }
      render();
    });
    render();
  }

  /* ---- verbatim excerpts ---- */
  function excerpts(data) {
    var by = {}; data.excerpts.forEach(function (e) { by[e.id] = e; });
    $$(".verbatim").forEach(function (slot) {
      var e = by[slot.getAttribute("data-excerpt")]; if (!e) return;
      slot.classList.add("model-" + e.model);
      if (e.truncated) slot.classList.add("truncated");
      var opened = e.exposed_doc_ids.length ? e.exposed_doc_ids.join(", ") : "none";
      slot.appendChild(h("div", { class: "verbatim__head" }, [
        h("span", { class: "verbatim__dot" }),
        h("span", { class: "verbatim__model", text: e.model.charAt(0).toUpperCase() + e.model.slice(1) }),
        h("span", { class: "verbatim__run", text: e.run + " · " + e.prompt_id.replace("t4p8-", "") }),
        h("span", { class: "verbatim__tag", text: "verbatim · T=" + e.temperature })
      ]));
      var body = h("div", { class: "verbatim__body", lang: "fr", text: e.text });
      slot.appendChild(body);
      if (e.truncated) {
        var more = h("button", { class: "verbatim__more", type: "button", text: "Show full note ↓" });
        more.addEventListener("click", function () {
          var op = slot.classList.toggle("open");
          more.textContent = op ? "Show less ↑" : "Show full note ↓";
        });
        slot.appendChild(more);
      }
      slot.appendChild(h("div", { class: "verbatim__foot" }, [
        h("div", { class: "verbatim__stats", text: "Documents opened: " + opened + " · Tool calls: " + e.tool_calls }),
        h("span", { text: e.note })
      ]));
    });
  }

  /* ---- touch tooltips ---- */
  function tooltips() {
    document.addEventListener("click", function (e) {
      var s = e.target.closest(".stat");
      $$(".stat.tip-open").forEach(function (n) { if (n !== s) n.classList.remove("tip-open"); });
      if (s) s.classList.toggle("tip-open");
    });
  }

  /* ---- data + boot ---- */
  function loadData() {
    fetch("assets/data.json").then(function (r) { return r.json(); }).then(function (data) {
      explorer($("#explorer-p7"), "p7", data);
      explorer($("#explorer-p8"), "p8", data);
      excerpts(data);
    }).catch(function () {
      $$(".explorer__mount").forEach(function (m) {
        m.textContent = "";
        m.appendChild(h("a", { href: "https://github.com/QuentinFuxa/qwen3_bias/tree/main/data/tier4", text: "Browse the corpora on GitHub ↗" }));
      });
    });
  }

  theme(); progress(); scrollspy(); lightbox(); tooltips(); loadData();
})();
