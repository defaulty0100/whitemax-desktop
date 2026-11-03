// WhiteMAX: выполняется в web.max.ru до загрузки страницы.
(() => {
  if (window.__whitemax) return;
  window.__whitemax = true;

  // ---------- НАСТРОЙКИ (хранятся в localStorage, правятся из панели) ----------
  const KEY = "wm:settings";
  const DEFAULTS = {
    block: true,
    domains: ["apptracer.ru"],
    zoom: 1,
    css: "",
    log: false,
  };
  let cfg = { ...DEFAULTS };
  try {
    cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {}
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
  };

  const stats = { blocked: 0 };

  // ---------- БЛОКИРОВКА ТЕЛЕМЕТРИИ ----------
  const hostOf = (u) => {
    try { return new URL(u, location.href).hostname; } catch { return ""; }
  };
  const isBlocked = (u) => {
    if (!cfg.block) return false;
    const h = hostOf(u);
    return !!h && cfg.domains.some((d) => d && (h === d || h.endsWith("." + d)));
  };
  const note = (kind, u, blocked) => {
    if (blocked) stats.blocked++;
    if (cfg.log) console.log(`[WhiteMAX] ${blocked ? "BLOCKED" : "ok"} ${kind}`, String(u));
  };

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const u = typeof input === "string" ? input : input && input.url;
    const b = isBlocked(u);
    note("fetch", u, b);
    if (b) return Promise.resolve(new Response(null, { status: 204 }));
    return origFetch.apply(this, arguments);
  };

  const xo = XMLHttpRequest.prototype.open;
  const xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__wm = isBlocked(url);
    note("xhr", url, this.__wm);
    return xo.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__wm) {
      try { this.abort(); } catch {}
      return;
    }
    return xs.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    const ob = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      const b = isBlocked(url);
      note("beacon", url, b);
      return b ? true : ob(url, data);
    };
  }

  const OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const b = isBlocked(url);
    note("ws", url, b);
    if (b) throw new DOMException("Blocked", "SecurityError");
    return protocols === undefined ? new OrigWS(url) : new OrigWS(url, protocols);
  };
  window.WebSocket.prototype = OrigWS.prototype;
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

  const patchSrc = (Ctor, kind) => {
    const d = Object.getOwnPropertyDescriptor(Ctor.prototype, "src");
    if (!d || !d.set) return;
    Object.defineProperty(Ctor.prototype, "src", {
      ...d,
      set(v) {
        const b = isBlocked(v);
        note(kind, v, b);
        if (b) return;
        d.set.call(this, v);
      },
    });
  };
  patchSrc(HTMLImageElement, "img");
  patchSrc(HTMLScriptElement, "script");

  // ---------- ПРИМЕНЕНИЕ НАСТРОЕК ----------
  const clampZoom = (z) => Math.min(2, Math.max(0.5, Number(z) || 1));
  const applyZoom = () => {
    document.documentElement.style.zoom = String(clampZoom(cfg.zoom));
  };
  const applyCss = () => {
    let s = document.getElementById("wm-css");
    if (!cfg.css) { if (s) s.remove(); return; }
    if (!s) {
      s = document.createElement("style");
      s.id = "wm-css";
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = cfg.css;
  };
  const applyAll = () => { applyZoom(); applyCss(); };

  // ---------- ПАНЕЛЬ ----------
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el[k] = v;
    }
    for (const kid of kids) el.append(kid);
    return el;
  };

  const PANEL_CSS = `
#wm-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-family:system-ui,"Segoe UI",sans-serif}
#wm-panel{--bg:#1f2026;--fg:#f3f4f6;--mut:#9ca3af;--bd:#34363f;--in:#2a2c34;--ac:#4f8cff;width:min(520px,92vw);max-height:88vh;overflow:auto;background:var(--bg);color:var(--fg);border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);box-sizing:border-box}
html[data-color-scheme="light"] #wm-panel{--bg:#fff;--fg:#111;--mut:#666;--bd:#e3e3e8;--in:#f3f3f6}
#wm-panel h2{margin:0 0 14px;font-size:18px;font-weight:600}
#wm-panel .wm-row{display:flex;align-items:center;gap:10px;margin:12px 0;font-size:14px}
#wm-panel label.wm-col{display:block;margin:12px 0;font-size:14px}
#wm-panel .wm-hint{color:var(--mut);font-size:12px;margin-top:4px}
#wm-panel textarea,#wm-panel input[type=number]{width:100%;box-sizing:border-box;background:var(--in);color:var(--fg);border:1px solid var(--bd);border-radius:10px;padding:8px 10px;font:13px ui-monospace,Consolas,monospace;margin-top:6px}
#wm-panel textarea{min-height:80px;resize:vertical}
#wm-panel input[type=checkbox]{width:18px;height:18px;accent-color:var(--ac)}
#wm-panel .wm-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
#wm-panel button{border:0;border-radius:10px;padding:9px 16px;font-size:14px;cursor:pointer;background:var(--in);color:var(--fg)}
#wm-panel button.wm-primary{background:var(--ac);color:#fff}
`;

  function closePanel() {
    const o = document.getElementById("wm-overlay");
    if (o) o.remove();
  }

  function openPanel() {
    if (document.getElementById("wm-overlay")) return;

    const cbBlock = h("input", { type: "checkbox", checked: cfg.block });
    const taDomains = h("textarea", { value: cfg.domains.join("\n"), spellcheck: false });
    const inZoom = h("input", { type: "number", min: 50, max: 200, step: 5, value: Math.round(clampZoom(cfg.zoom) * 100) });
    const taCss = h("textarea", { value: cfg.css, spellcheck: false, placeholder: "/* свой CSS */" });
    const cbLog = h("input", { type: "checkbox", checked: cfg.log });

    const onSave = () => {
      cfg.block = cbBlock.checked;
      cfg.domains = taDomains.value.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean);
      cfg.zoom = clampZoom(Number(inZoom.value) / 100);
      cfg.css = taCss.value;
      cfg.log = cbLog.checked;
      save();
      applyAll();
      closePanel();
    };

    const panel = h("div", { id: "wm-panel" },
      h("h2", null, "Настройки WhiteMAX"),
      h("label", { class: "wm-row" }, cbBlock, "Блокировать телеметрию"),
      h("label", { class: "wm-col" },
        "Домены для блокировки (по одному в строке)",
        taDomains,
        h("div", { class: "wm-hint" }, `Заблокировано запросов с запуска: ${stats.blocked}`),
      ),
      h("label", { class: "wm-col" }, "Масштаб, %", inZoom),
      h("label", { class: "wm-col" }, "Свой CSS", taCss),
      h("label", { class: "wm-row" }, cbLog, "Лог запросов в консоль (F12)"),
      h("div", { class: "wm-btns" },
        h("button", { onclick: closePanel }, "Отмена"),
        h("button", { class: "wm-primary", onclick: onSave }, "Сохранить"),
      ),
    );

    const overlay = h("div", { id: "wm-overlay" }, panel);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closePanel(); });
    const style = h("style");
    style.textContent = PANEL_CSS;
    overlay.prepend(style);
    document.body.appendChild(overlay);
  }

  // ---------- ПУНКТ В НАСТРОЙКАХ MAX ----------
  // Клонируем соседний пункт («Сочетания клавиш»), чтобы взять его классы как есть.
  function injectItem() {
    const tab = document.querySelector('[class*="settingsTab"]');
    if (!tab || tab.querySelector("[data-wm-item]")) return;
    const use = tab.querySelector('use[href="#icon_keyboard"]');
    const src = use && use.closest("button");
    if (!src) return;

    const item = src.cloneNode(true);
    item.setAttribute("data-wm-item", "1");
    const u = item.querySelector("use");
    if (u) u.setAttribute("href", "#icon_settings");
    for (const n of item.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) n.textContent = " Настройки WhiteMAX ";
    }
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    }, true);
    src.after(item);
  }

  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; injectItem(); });
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyAll();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    schedule();
  });

  // ---------- ГОРЯЧИЕ КЛАВИШИ ----------
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
    if (!e.ctrlKey) return;
    if (e.key === "=" || e.key === "+") { e.preventDefault(); cfg.zoom = clampZoom(cfg.zoom + 0.1); save(); applyZoom(); }
    else if (e.key === "-") { e.preventDefault(); cfg.zoom = clampZoom(cfg.zoom - 0.1); save(); applyZoom(); }
    else if (e.key === "0") { e.preventDefault(); cfg.zoom = 1; save(); applyZoom(); }
    else if (e.shiftKey && (e.key === "L" || e.key === "l")) {
      e.preventDefault();
      cfg.log = !cfg.log;
      save();
      console.log(`[WhiteMAX] log ${cfg.log ? "ON" : "OFF"}, blocked so far: ${stats.blocked}`);
    }
  }, true);
})();
