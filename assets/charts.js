/* Native SVG charts, Material 3 styled, theme-aware, zero dependencies.
   Every value comes from data.json (frozen from the committed LaTeX macros).
   window.Charts.render(data, handlers) mounts each [data-chart] element. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var FILL = { qwen: "var(--qwen)", mistral: "var(--mistral)", gemma: "var(--gemma)" };
  var MNAME = { qwen: "Qwen", mistral: "Mistral", gemma: "Gemma" };

  function s(tag, attrs, kids) {
    var el = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(c); });
    return el;
  }
  function svgRoot(w, h) {
    return s("svg", { viewBox: "0 0 " + w + " " + h, role: "img", preserveAspectRatio: "xMidYMid meet" });
  }

  // shared tooltip
  var tip = document.querySelector(".tip.chart-tip");
  if (!tip) { tip = document.createElement("div"); tip.className = "tip chart-tip"; document.body.appendChild(tip); }
  function showTip(html, e) {
    tip.innerHTML = html; tip.classList.add("show");
    var r = tip.getBoundingClientRect();
    var x = e.clientX + 14, y = e.clientY - r.height - 10;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y < 8) y = e.clientY + 16;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.classList.remove("show"); }
  function bind(el, html) {
    el.addEventListener("mousemove", function (e) { showTip(html, e); });
    el.addEventListener("mouseleave", hideTip);
    el.setAttribute("tabindex", "0");
    el.addEventListener("focus", function (e) {
      var b = el.getBoundingClientRect();
      showTip(html, { clientX: b.left + b.width / 2, clientY: b.bottom });
    });
    el.addEventListener("blur", hideTip);
  }

  function legend(items) {
    var d = document.createElement("div"); d.className = "legend";
    items.forEach(function (it) {
      var sp = document.createElement("span");
      var i = document.createElement("i"); i.style.background = it.color; sp.appendChild(i);
      sp.appendChild(document.createTextNode(it.label)); d.appendChild(sp);
    });
    return d;
  }
  function hint(text) { var p = document.createElement("p"); p.className = "hint"; p.textContent = text; return p; }
  function goLink(mount, handlers) {
    var id = mount.getAttribute("data-link");
    return id ? function () { handlers.goTo(id); } : null;
  }

  // ---- grouped bars: refusal (model groups × lang bars, China side) ----
  function refusal(mount, d, handlers) {
    var W = 680, H = 300, padL = 40, padB = 46, padT = 14, plotH = H - padB - padT;
    var root = svgRoot(W, H);
    var langs = d.langs, models = d.models;
    var groupW = (W - padL - 12) / models.length, barW = Math.min(46, (groupW - 24) / 3);
    [0, 25, 50, 75, 100].forEach(function (t) {
      var y = padT + plotH * (1 - t / 100);
      root.appendChild(s("line", { class: "grid", x1: padL, y1: y, x2: W - 6, y2: y }));
      root.appendChild(s("text", { x: padL - 6, y: y + 4, "text-anchor": "end", "font-size": 11, class: "lbl", text: t }));
    });
    var onClick = goLink(mount, handlers);
    models.forEach(function (m, gi) {
      var gx = padL + gi * groupW + 12;
      m.china.forEach(function (c, li) {
        var x = gx + li * (barW + 6), y = padT + plotH * (1 - c.v / 100), bh = plotH * c.v / 100;
        var op = 0.55 + li * 0.22;
        var r = s("rect", { class: "bar", x: x, y: c.v > 0 ? y : padT + plotH - 2, width: barW,
          height: c.v > 0 ? bh : 2, rx: 4, style: "fill:" + FILL[m.model] + ";fill-opacity:" + op });
        bind(r, "<b>" + MNAME[m.model] + " · " + langs[li] + "</b><br>China-sensitive refusal: " +
          c.v + "% (CI " + c.lo + "–" + c.hi + ")<br>Western mirror: 0.0%<br><i>analysis/compute_h1.py</i>");
        if (onClick && m.model === "qwen") { r.style.cursor = "pointer"; r.addEventListener("click", onClick); }
        root.appendChild(r);
        if (c.v >= 30) root.appendChild(s("text", { x: x + barW / 2, y: y - 5, "text-anchor": "middle",
          "font-size": 11, class: "val", text: c.v + "%" }));
      });
      root.appendChild(s("text", { x: gx + (3 * barW + 12) / 2, y: H - padB + 18, "text-anchor": "middle",
        "font-size": 13, "font-weight": 600, class: "lbl", style: "fill:" + FILL[m.model], text: MNAME[m.model] }));
    });
    root.appendChild(s("line", { class: "axis", x1: padL, y1: padT + plotH, x2: W - 6, y2: padT + plotH }));
    root.setAttribute("aria-label", "Refusal rate on China-sensitive questions: Qwen 33% French, 53% English, 62% Chinese; Mistral and Gemma near zero; Western mirrors zero for all.");
    mount.appendChild(legend(langs.map(function (l, i) { return { label: l, color: "color-mix(in srgb, var(--on-surface-variant) " + (30 + i * 30) + "%, var(--qwen))" }; })));
    mount.appendChild(root);
    if (onClick) mount.appendChild(hint("Click a Qwen bar to see the verbatim answers."));
  }

  // ---- dotplot: stance deltas (delta axis, CI whiskers) ----
  function dotplot(mount, cells, opts, handlers) {
    // cells: [{model, lang, v, lo, hi, n}]
    var W = 680, rowH = 34, padL = 150, padR = 20, padT = 24;
    var H = padT + cells.length * rowH + 14;
    var lo = Math.min(-1, Math.min.apply(null, cells.map(function (c) { return c.lo; })) - 0.05);
    var hi = Math.max(0.4, Math.max.apply(null, cells.map(function (c) { return c.hi; })) + 0.05);
    function X(v) { return padL + (v - lo) / (hi - lo) * (W - padL - padR); }
    var root = svgRoot(W, H);
    // zero line + critical/pro labels
    root.appendChild(s("line", { class: "axis", x1: X(0), y1: padT - 8, x2: X(0), y2: H - 8, style: "stroke:var(--outline)" }));
    root.appendChild(s("text", { x: X(0), y: 14, "text-anchor": "middle", "font-size": 10, class: "lbl", text: "0 (balanced)" }));
    [-1, -0.5, 0].forEach(function (t) {
      root.appendChild(s("text", { x: X(t), y: H - 2, "text-anchor": "middle", "font-size": 10, class: "lbl", text: t }));
    });
    cells.forEach(function (c, i) {
      var y = padT + i * rowH + rowH / 2;
      var label = MNAME[c.model] + (opts.showLang ? " · " + c.lang : "");
      root.appendChild(s("text", { x: padL - 12, y: y + 4, "text-anchor": "end", "font-size": 12, class: "val", text: label }));
      var w = s("line", { x1: X(c.lo), y1: y, x2: X(c.hi), y2: y, style: "stroke:" + FILL[c.model] + ";stroke-width:2;opacity:.5" });
      root.appendChild(w);
      ["lo", "hi"].forEach(function (k) { root.appendChild(s("line", { x1: X(c[k]), y1: y - 4, x2: X(c[k]), y2: y + 4, style: "stroke:" + FILL[c.model] + ";stroke-width:2;opacity:.5" })); });
      var dot = s("circle", { cx: X(c.v), cy: y, r: 6, style: "fill:" + FILL[c.model] + ";cursor:pointer" });
      bind(dot, "<b>" + label + "</b><br>Stance delta (China − West): " + c.v.toFixed(2) +
        "<br>95% CI " + c.lo.toFixed(2) + " to " + c.hi.toFixed(2) + " · N=" + c.n + "<br><i>analysis/compute_h2.py</i>");
      root.appendChild(dot);
      root.appendChild(s("text", { x: X(c.v) + (c.v > (lo + hi) / 2 ? -10 : 10), y: y - 9,
        "text-anchor": c.v > (lo + hi) / 2 ? "end" : "start", "font-size": 11, class: "val",
        text: (c.v > 0 ? "+" : "") + c.v.toFixed(2) }));
    });
    root.setAttribute("aria-label", opts.aria);
    mount.appendChild(root);
    mount.appendChild(hint(opts.showLang ? "Only Qwen crosses zero, and only in Chinese." : "Negative = harsher on China than on the West, on identical evidence."));
  }

  // ---- p7 capture grouped bars + exposure ----
  function p7(mount, d, handlers) {
    var manips = [["inject", "Instruction injection"], ["fabricate", "Fabrication laundering"], ["authority", "Authority deference"]];
    var models = ["qwen", "mistral", "gemma"];
    var W = 680, H = 300, padL = 40, padB = 60, padT = 14, plotH = H - padB - padT;
    var root = svgRoot(W, H);
    var groupW = (W - padL - 12) / manips.length, barW = Math.min(40, (groupW - 24) / 3);
    [0, 50, 100].forEach(function (t) {
      var y = padT + plotH * (1 - t / 100);
      root.appendChild(s("line", { class: "grid", x1: padL, y1: y, x2: W - 6, y2: y }));
      root.appendChild(s("text", { x: padL - 6, y: y + 4, "text-anchor": "end", "font-size": 11, class: "lbl", text: t }));
    });
    var onClick = goLink(mount, handlers);
    manips.forEach(function (mp, gi) {
      var gx = padL + gi * groupW + 12;
      models.forEach(function (mo, mi) {
        var cn = d.capture[mp[0]][mo];
        if (!cn) return;
        var pct = cn[1] ? 100 * cn[0] / cn[1] : 0;
        var x = gx + mi * (barW + 6), bh = plotH * pct / 100, y = padT + plotH - bh;
        var r = s("rect", { class: "bar", x: x, y: y, width: barW, height: bh || 2, rx: 4, style: "fill:" + FILL[mo] });
        bind(r, "<b>" + MNAME[mo] + " · " + mp[1] + "</b><br>Planted content captured: " + cn[0] + "/" + cn[1] +
          " = " + Math.round(pct) + "%<br>Read-conditioned, dual-judge<br><i>analysis/compute_p7.py</i>");
        if (onClick) { r.style.cursor = "pointer"; r.addEventListener("click", onClick); }
        root.appendChild(r);
        root.appendChild(s("text", { x: x + barW / 2, y: y - 5, "text-anchor": "middle", "font-size": 10, class: "val", text: cn[0] + "/" + cn[1] }));
      });
      root.appendChild(s("text", { x: gx + (3 * barW + 12) / 2, y: H - padB + 18, "text-anchor": "middle", "font-size": 12, class: "lbl", text: mp[1] }));
    });
    root.appendChild(s("line", { class: "axis", x1: padL, y1: padT + plotH, x2: W - 6, y2: padT + plotH }));
    // exposure footnote line
    var ex = d.exposure;
    var exline = "Read the planted doc: Qwen " + ex.qwen[0] + "/" + ex.qwen[1] + " (" + Math.round(100 * ex.qwen[0] / ex.qwen[1]) +
      "%), Mistral " + Math.round(100 * ex.mistral[0] / ex.mistral[1]) + "%, Gemma " + Math.round(100 * ex.gemma[0] / ex.gemma[1]) + "%";
    root.appendChild(s("text", { x: padL, y: H - 4, "font-size": 10.5, class: "lbl", text: exline }));
    root.setAttribute("aria-label", "When a model reads the planted document, the planted content is captured almost every time, for every model, with no China-West gap.");
    mount.appendChild(legend(models.map(function (m) { return { label: MNAME[m], color: FILL[m] }; })));
    mount.appendChild(root);
    if (onClick) mount.appendChild(hint("Click a bar to open the poisoned-corpus explorer."));
  }

  // ---- relay: per-model P1 relay + P3 span, China side (West = 100 ref) ----
  function relay(mount, rows, handlers) {
    var W = 680, H = 250, padL = 74, padB = 40, padT = 30, plotH = H - padB - padT;
    var root = svgRoot(W, H);
    var groupW = (W - padL - 12) / rows.length, barW = 44;
    [0, 50, 100].forEach(function (t) {
      var y = padT + plotH * (1 - t / 100);
      root.appendChild(s("line", { class: "grid", x1: padL, y1: y, x2: W - 6, y2: y }));
      root.appendChild(s("text", { x: padL - 6, y: y + 4, "text-anchor": "end", "font-size": 11, class: "lbl", text: t + "%" }));
    });
    var onClick = goLink(mount, handlers);
    rows.forEach(function (r0, gi) {
      var gx = padL + gi * groupW + 14;
      [["relayC", "Factbase relayed (P1)", "5/6", "6/6"], ["spanC", "Spans preserved (P3)", "24/30", "30/30"]].forEach(function (mt, mi) {
        var pct = r0[mt[0]], x = gx + mi * (barW + 10), bh = plotH * pct / 100, y = padT + plotH - bh;
        var counts = r0.model === "qwen" ? mt[2] : mt[3];
        var rect = s("rect", { class: "bar", x: x, y: y, width: barW, height: bh, rx: 4,
          style: "fill:" + FILL[r0.model] + (mi ? ";fill-opacity:.6" : "") });
        bind(rect, "<b>" + MNAME[r0.model] + " · " + mt[1] + "</b><br>China side: " + counts + " = " + pct +
          "%<br>West mirror: 100%<br><i>mechanical, T=0</i>");
        if (onClick && r0.model === "qwen") { rect.style.cursor = "pointer"; rect.addEventListener("click", onClick); }
        root.appendChild(rect);
        root.appendChild(s("text", { x: x + barW / 2, y: y - 5, "text-anchor": "middle", "font-size": 10, class: "val", text: counts }));
      });
      root.appendChild(s("text", { x: gx + barW + 5, y: H - padB + 18, "text-anchor": "middle", "font-size": 12, "font-weight": 600, class: "lbl", style: "fill:" + FILL[r0.model], text: MNAME[r0.model] }));
    });
    root.appendChild(s("line", { class: "axis", x1: padL, y1: padT + plotH, x2: W - 6, y2: padT + plotH }));
    root.setAttribute("aria-label", "Relay layer: only Qwen deviates on the China side (factbase 5 of 6, spans 24 of 30); Mistral and Gemma are perfect on both sides.");
    mount.appendChild(legend([{ label: "P1 factbase relay", color: "var(--qwen)" }, { label: "P3 span preservation", color: "color-mix(in srgb, var(--qwen) 60%, transparent)" }]));
    mount.appendChild(root);
    if (onClick) mount.appendChild(hint("Click a Qwen bar to see the factbase and translation exhibits."));
  }

  // ---- sysprompt before/after (refusal + stance) ----
  function sysprompt(mount, d, handlers) {
    var W = 680, H = 250, padT = 40, padB = 40, plotH = H - padT - padB;
    var root = svgRoot(W, H);
    // panel A: refusal % (0-50)  |  panel B: stance (-1..0)
    function panel(x0, w, title, pairs, fmt, dom) {
      root.appendChild(s("text", { x: x0 + w / 2, y: 20, "text-anchor": "middle", "font-size": 12, "font-weight": 600, class: "lbl", text: title }));
      var bw = 48, gap = (w - 2 * bw) / 3;
      pairs.forEach(function (p, i) {
        var x = x0 + gap + i * (bw + gap);
        var frac = (p.v - dom[0]) / (dom[1] - dom[0]);
        var bh = plotH * frac, y = padT + plotH - bh;
        var rect = s("rect", { class: "bar", x: x, y: y, width: bw, height: Math.max(bh, 2), rx: 4,
          style: "fill:var(--qwen)" + (i ? ";fill-opacity:.55" : "") });
        bind(rect, "<b>" + p.k + "</b><br>" + p.desc + "<br><i>analysis/compute_sysprompt.py</i>");
        root.appendChild(rect);
        root.appendChild(s("text", { x: x + bw / 2, y: y - 6, "text-anchor": "middle", "font-size": 11, class: "val", text: fmt(p.v) }));
        root.appendChild(s("text", { x: x + bw / 2, y: H - padB + 16, "text-anchor": "middle", "font-size": 11, class: "lbl", text: p.k }));
      });
    }
    var r = d.refusal, st = d.stance;
    panel(20, 300, "Frontal refusal (China, fr)", [
      { k: "Bare", v: r.bare, desc: r.bare + "% (CI " + r.bareLo + "–" + r.bareHi + ")" },
      { k: "+ persona", v: r.admin, desc: r.admin + "% (CI " + r.adminLo + "–" + r.adminHi + "), McNemar p=0.031" }
    ], function (v) { return v.toFixed(1) + "%"; }, [0, 50]);
    panel(360, 300, "Analytic stance", [
      { k: "Bare", v: -st.bare, desc: st.bare.toFixed(2) + " (CI " + st.bareLo + "–" + st.bareHi + ")" },
      { k: "+ persona", v: -st.admin, desc: st.admin.toFixed(2) + " (CI " + st.adminLo + "–" + st.adminHi + "), over-corrects to Mistral's " + st.mistralAdmin }
    ], function (v) { return (-v).toFixed(2); }, [0, 1.2]);
    root.appendChild(s("line", { class: "axis", x1: 20, y1: padT + plotH, x2: 320, y2: padT + plotH }));
    root.appendChild(s("line", { class: "axis", x1: 360, y1: padT + plotH, x2: 660, y2: padT + plotH }));
    root.setAttribute("aria-label", "A deployment persona cuts frontal refusal from 34.9% to 20.0%, and over-corrects the analytic stance from -0.54 to -0.93, landing at Mistral's level.");
    mount.appendChild(root);
    mount.appendChild(hint("The prompt shrinks the visible bias, but over-corrects the stance."));
  }

  // ---- topic heatmap ----
  function heatmap(mount, rows, handlers, prompts) {
    var cols = [["fr", "FR"], ["en", "EN"], ["zh", "ZH"], ["persona", "FR·persona"]];
    var W = 680, rowH = 26, padL = 150, padT = 30, cw = (W - padL - 10) / cols.length;
    var H = padT + rows.length * rowH + 10;
    var root = svgRoot(W, H);
    cols.forEach(function (c, ci) {
      root.appendChild(s("text", { x: padL + ci * cw + cw / 2, y: 20, "text-anchor": "middle", "font-size": 11, "font-weight": 600, class: "lbl", text: c[1] }));
    });
    rows.forEach(function (r0, ri) {
      var y = padT + ri * rowH;
      var hard = r0.persona >= 50 || r0.label.indexOf("Tiananmen") === 0;
      var lbl = s("text", { x: padL - 10, y: y + rowH / 2 + 4, "text-anchor": "end", "font-size": 11.5,
        class: "val", style: "cursor:pointer" + (hard ? ";font-weight:700" : ""), text: r0.label });
      var prompt = prompts[r0.family];
      if (prompt) {
        lbl.addEventListener("click", function () { handlers.revealPrompt(mount, r0.label, prompt); });
        bind(lbl, "<b>" + r0.label + "</b><br>Click to see an example prompt");
      }
      root.appendChild(lbl);
      cols.forEach(function (c, ci) {
        var v = r0[c[0]], x = padL + ci * cw + 2;
        var rect = s("rect", { x: x, y: y + 2, width: cw - 4, height: rowH - 4, rx: 4,
          style: "fill:var(--primary);fill-opacity:" + (0.06 + 0.9 * v / 100) });
        bind(rect, "<b>" + r0.label + " · " + c[1] + "</b><br>Refused/deflected: " + v + "%");
        root.appendChild(rect);
        if (v >= 50) root.appendChild(s("text", { x: x + (cw - 4) / 2, y: y + rowH / 2 + 4, "text-anchor": "middle",
          "font-size": 10, style: "fill:var(--on-primary);font-weight:600", text: v }));
      });
    });
    root.setAttribute("aria-label", "Qwen refusal heatmap by topic and language. Tiananmen refused 100% in every language and under the persona; leader criticism 67% under persona; most other topics drop to zero under the persona.");
    mount.appendChild(root);
    mount.appendChild(hint("Click a topic name to read a real prompt from that family."));
    var reveal = document.createElement("div"); reveal.className = "topic-reveal"; mount.appendChild(reveal);
  }

  // ---- entity label grid ----
  function entity(mount, rows) {
    var models = ["qwen", "mistral", "gemma"], langs = ["fr", "en", "zh"];
    var wrap = document.createElement("div"); wrap.className = "entgrid";
    var head = document.createElement("div"); head.className = "entgrid__row entgrid__head";
    head.appendChild(cell("", "entgrid__rk"));
    models.forEach(function (m) { langs.forEach(function (l) { head.appendChild(cell(MNAME[m].slice(0, 1) + "·" + l.toUpperCase(), "entgrid__ck")); }); });
    wrap.appendChild(head);
    rows.forEach(function (r0) {
      var row = document.createElement("div"); row.className = "entgrid__row";
      row.appendChild(cell(r0.entity, "entgrid__rk"));
      r0.cells.forEach(function (c) {
        var odd = c.status !== "disputed";
        var el = cell(c.status, "entgrid__c" + (odd ? " odd" : ""));
        el.title = r0.entity + " · " + MNAME[c.model] + " · " + c.lang.toUpperCase() + ": " + c.status;
        row.appendChild(el);
      });
      wrap.appendChild(row);
    });
    mount.appendChild(wrap);
    mount.appendChild(hint("Everyone says “disputed”, except Qwen (region) and Gemma (territory) for Taiwan in Chinese."));
    function cell(t, cls) { var d = document.createElement("div"); d.className = cls; d.textContent = t; return d; }
  }

  // ---- abliteration 100% stacked ----
  function abliteration(mount, rows, handlers) {
    var W = 680, H = 300, padL = 96, padT = 14, padB = 30, plotW = W - padL - 90;
    var barH = 26, gap = 12, y0 = padT;
    var root = svgRoot(W, H);
    var segs = [["documented", "Documented account", "var(--pos)"], ["neutral", "Neutral", "var(--outline)"],
      ["beijing", "Beijing's framing", "var(--neg)"], ["refusal", "Refusal", "var(--on-surface-variant)"]];
    var onClick = goLink(mount, handlers);
    rows.forEach(function (r0, i) {
      var y = y0 + i * (barH + gap) + (i >= 2 ? 6 : 0) + (i >= 4 ? 6 : 0);
      root.appendChild(s("text", { x: padL - 10, y: y + barH / 2 + 4, "text-anchor": "end", "font-size": 11.5, class: "val",
        text: r0.lang + " · " + (r0.cond === "base" ? "base" : "ablit") }));
      var acc = 0;
      segs.forEach(function (sg) {
        var v = r0[sg[0]]; if (!v) { acc += v; return; }
        var x = padL + plotW * acc / 100, w = plotW * v / 100;
        var rect = s("rect", { class: "bar", x: x, y: y, width: w, height: barH, rx: 2, style: "fill:" + sg[2] });
        bind(rect, "<b>" + r0.lang + " · " + r0.cond + "</b><br>" + sg[1] + ": " + v + "%<br><i>analysis/compute_abliteration.py</i>");
        if (onClick) { rect.style.cursor = "pointer"; rect.addEventListener("click", onClick); }
        root.appendChild(rect);
        if (v >= 14) root.appendChild(s("text", { x: x + w / 2, y: y + barH / 2 + 4, "text-anchor": "middle", "font-size": 10,
          style: "fill:#fff;font-weight:600", text: v }));
        acc += v;
      });
    });
    root.setAttribute("aria-label", "Abliteration removes the refusal everywhere; in French and English the documented account jumps to 71% and 66%, but in Chinese Beijing's framing stays the plurality at 49%.");
    mount.appendChild(legend(segs.map(function (sg) { return { label: sg[1], color: sg[2] }; })));
    mount.appendChild(root);
    if (onClick) mount.appendChild(hint("Click a bar to compare a base vs abliterated answer."));
  }

  // ---- fixed retrieval: China - West retention contrast, +/-10pp margin band ----
  function fixedRag(mount, d) {
    var models = d.models, W = 680, rowH = 42, padL = 92, padR = 24, padT = 30;
    var H = padT + models.length * rowH + 20, lo = -18, hi = 18;
    function X(v) { return padL + (v - lo) / (hi - lo) * (W - padL - padR); }
    var root = svgRoot(W, H);
    root.appendChild(s("rect", { x: X(-d.marginPp), y: padT - 6, width: X(d.marginPp) - X(-d.marginPp),
      height: H - padT - 8, style: "fill:var(--outline-variant);opacity:.3" }));
    root.appendChild(s("line", { class: "axis", x1: X(0), y1: padT - 6, x2: X(0), y2: H - 8, style: "stroke:var(--outline)" }));
    root.appendChild(s("text", { x: X(0), y: 14, "text-anchor": "middle", "font-size": 10, class: "lbl", text: "0 (no China/West gap)" }));
    [-10, 0, 10].forEach(function (t) {
      root.appendChild(s("text", { x: X(t), y: H - 2, "text-anchor": "middle", "font-size": 10, class: "lbl", text: (t > 0 ? "+" : "") + t + "pp" })); });
    models.forEach(function (c, i) {
      var y = padT + i * rowH + rowH / 2;
      root.appendChild(s("text", { x: padL - 12, y: y + 4, "text-anchor": "end", "font-size": 12, class: "val", text: MNAME[c.model] }));
      root.appendChild(s("line", { x1: X(c.lo), y1: y, x2: X(c.hi), y2: y, style: "stroke:" + FILL[c.model] + ";stroke-width:2;opacity:.5" }));
      ["lo", "hi"].forEach(function (k) { root.appendChild(s("line", { x1: X(c[k]), y1: y - 4, x2: X(c[k]), y2: y + 4, style: "stroke:" + FILL[c.model] + ";stroke-width:2;opacity:.5" })); });
      var dot = s("circle", { cx: X(c.v), cy: y, r: 6, style: "fill:" + FILL[c.model] + ";cursor:pointer" });
      bind(dot, "<b>" + MNAME[c.model] + "</b><br>China − West retention: " + c.v.toFixed(1) + "pp<br>95% CI " +
        c.lo.toFixed(1) + " to " + c.hi.toFixed(1) + "pp<br><i>fixed retrieval · provisional</i>");
      root.appendChild(dot);
      root.appendChild(s("text", { x: X(c.v), y: y - 9, "text-anchor": "middle", "font-size": 11, class: "val", text: (c.v > 0 ? "+" : "") + c.v.toFixed(1) }));
    });
    root.setAttribute("aria-label", "Fixed-retrieval China minus West retention contrast; Qwen -5pp, inconclusive against the +/-10pp margin.");
    mount.appendChild(root);
    mount.appendChild(hint("Shaded band = ±10pp equivalence margin. An interval crossing it is inconclusive."));
  }

  var RENDER = { refusal: refusal, relay: relay, sysprompt: sysprompt, entity: entity, abliteration: abliteration };

  window.Charts = {
    render: function (data, handlers) {
      var c = data.charts;
      document.querySelectorAll("[data-chart]").forEach(function (mount) {
        var kind = mount.getAttribute("data-chart");
        mount.textContent = "";
        try {
          if (kind === "refusal") refusal(mount, c.refusal, handlers);
          else if (kind === "stance") dotplot(mount, c.stance_lang.map(function (m) { return Object.assign({ model: m.model }, m.cells[0]); }),
            { showLang: false, aria: "Stance deltas on identical French evidence: Qwen -0.54, Mistral -0.75, Gemma -0.75, all harsher on China than on the West." }, handlers);
          else if (kind === "stance_lang") { var cells = []; c.stance_lang.forEach(function (m) { m.cells.forEach(function (cl) { cells.push(Object.assign({ model: m.model }, cl)); }); });
            dotplot(mount, cells, { showLang: true, aria: "Stance by language: only Qwen crosses zero, and only in Chinese (+0.30)." }, handlers); }
          else if (kind === "fixed_rag") fixedRag(mount, c.fixed_rag);
          else if (kind === "relay") relay(mount, c.relay, handlers);
          else if (kind === "sysprompt") sysprompt(mount, c.sysprompt, handlers);
          else if (kind === "topic") heatmap(mount, c.topic, handlers, data.topic_prompts);
          else if (kind === "entity") entity(mount, c.entity_json);
          else if (kind === "abliteration") abliteration(mount, c.abliteration, handlers);
        } catch (e) { mount.textContent = "chart unavailable"; }
      });
    }
  };
})();
