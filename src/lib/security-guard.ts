/**
 * Client-side hardening — camadas defensivas contra inspeção casual.
 *
 * IMPORTANTE: nenhuma proteção client-side é 100% à prova de engenheiro
 * determinado (o navegador é do usuário). Estas camadas dificultam bastante
 * inspeção casual, cópia, download de HTML e uso de DevTools, mas a
 * segurança real permanece no backend (RLS, auth, validação server-side).
 *
 * Ativação opt-in via `installSecurityGuard()`. Só roda em produção para
 * não atrapalhar o desenvolvimento local.
 */

const isProd =
  typeof import.meta !== "undefined" &&
  (import.meta as any).env &&
  ((import.meta as any).env.PROD === true ||
    (import.meta as any).env.MODE === "production");

let installed = false;

export function installSecurityGuard() {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (!isProd) return; // não aplicar em dev/preview
  installed = true;

  try {
    hardenConsole();
    blockShortcuts();
    blockContextMenu();
    blockTextSelectionCopy();
    blockDrag();
    setupDevtoolsDetection();
    hardenGlobals();
  } catch {
    /* fail-open: nunca quebrar a UI por causa de guard */
  }
}

/* ---------- 1) Silenciar console ---------- */
function hardenConsole() {
  const noop = () => undefined;
  const methods = [
    "log", "info", "warn", "error", "debug", "trace",
    "table", "dir", "group", "groupCollapsed", "groupEnd",
    "time", "timeEnd", "timeLog", "count", "countReset",
    "assert", "profile", "profileEnd",
  ] as const;

  try {
    for (const m of methods) {
      try { (console as any)[m] = noop; } catch { /* ignore */ }
    }
    // Freezar para dificultar re-atribuição via console
    try { Object.freeze(console); } catch { /* ignore */ }
  } catch { /* ignore */ }
}

/* ---------- 2) Bloquear atalhos de inspeção ---------- */
function blockShortcuts() {
  const handler = (e: KeyboardEvent) => {
    const k = (e.key || "").toLowerCase();
    // F12
    if (k === "f12") { e.preventDefault(); e.stopPropagation(); return; }
    // Ctrl/Cmd + U → view-source
    if ((e.ctrlKey || e.metaKey) && k === "u") { e.preventDefault(); return; }
    // Ctrl/Cmd + S → salvar página
    if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); return; }
    // Ctrl/Cmd + P → imprimir (pode expor DOM)
    if ((e.ctrlKey || e.metaKey) && k === "p") { e.preventDefault(); return; }
    // Ctrl/Cmd + Shift + I / J / C / K → DevTools variantes
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c", "k"].includes(k)) {
      e.preventDefault(); e.stopPropagation(); return;
    }
  };
  window.addEventListener("keydown", handler, { capture: true });
}

/* ---------- 3) Bloquear menu de contexto ---------- */
function blockContextMenu() {
  window.addEventListener(
    "contextmenu",
    (e) => {
      // permitir em inputs/textareas para UX (copiar/colar) — remova se quiser 100%
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
    },
    { capture: true },
  );
}

/* ---------- 4) Restringir seleção/cópia fora de inputs ---------- */
function blockTextSelectionCopy() {
  const style = document.createElement("style");
  style.setAttribute("data-guard", "1");
  style.textContent = `
    html, body { -webkit-user-select: none; -ms-user-select: none; user-select: none; }
    input, textarea, [contenteditable="true"], [data-allow-select] { -webkit-user-select: text !important; user-select: text !important; }
  `;
  document.head.appendChild(style);

  const blockIfNotInput = (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest?.("[data-allow-select]"))) return;
    e.preventDefault();
  };
  ["copy", "cut"].forEach((ev) =>
    window.addEventListener(ev, blockIfNotInput, { capture: true }),
  );
}

/* ---------- 5) Impedir arrastar imagens/links ---------- */
function blockDrag() {
  window.addEventListener("dragstart", (e) => e.preventDefault(), { capture: true });
}

/* ---------- 6) Detecção de DevTools ---------- */
function setupDevtoolsDetection() {
  let warned = false;
  const warn = () => {
    if (warned) return;
    warned = true;
    try {
      const overlay = document.createElement("div");
      overlay.setAttribute("data-guard-overlay", "1");
      overlay.style.cssText = [
        "position:fixed", "inset:0", "z-index:2147483647",
        "background:#000", "color:#fff", "display:flex",
        "align-items:center", "justify-content:center",
        "font-family:system-ui,sans-serif", "font-size:14px",
        "padding:24px", "text-align:center",
      ].join(";");
      overlay.textContent = "Acesso bloqueado — ferramentas de desenvolvedor detectadas. Feche o DevTools para continuar.";
      document.body.appendChild(overlay);

      const remove = () => {
        if (!isDevtoolsOpen()) {
          overlay.remove();
          warned = false;
        } else {
          setTimeout(remove, 500);
        }
      };
      setTimeout(remove, 500);
    } catch { /* ignore */ }
  };

  // Heurística 1: diferença entre outer/inner (DevTools acoplado)
  const check = () => {
    if (isDevtoolsOpen()) warn();
  };
  setInterval(check, 800);

  // Heurística 2: getter em objeto passado a toString dispara quando devtools formata
  try {
    const bait: any = {};
    Object.defineProperty(bait, "id", {
      get() { warn(); return ""; },
    });
    setInterval(() => { try { bait + ""; } catch { /* ignore */ } }, 1500);
  } catch { /* ignore */ }

  // Heurística 3: timing com `debugger` — pausa apenas quando DevTools está aberto
  try {
    const probe = new Function("debugger;");
    setInterval(() => {
      const t0 = performance.now();
      try { probe(); } catch { /* ignore */ }
      const dt = performance.now() - t0;
      if (dt > 120) warn();
    }, 1200);
  } catch { /* ignore */ }

  // Heurística 4: getter em RegExp.toString — Firefox/Chrome disparam ao inspecionar
  try {
    const re = /devtools/;
    let hits = 0;
    (re as any).toString = function () { hits++; if (hits > 0) warn(); return ""; };
    setInterval(() => { try { console.profile?.(re as any); console.profileEnd?.(); } catch { /* ignore */ } }, 2000);
  } catch { /* ignore */ }

function isDevtoolsOpen(): boolean {
  const threshold = 160;
  const w = window.outerWidth - window.innerWidth;
  const h = window.outerHeight - window.innerHeight;
  return w > threshold || h > threshold;
}

/* ---------- 7) Endurecer globais ---------- */
function hardenGlobals() {
  try {
    // Impede que scripts do console reescrevam alguns globais críticos
    const freezeKeys = ["fetch", "XMLHttpRequest"];
    for (const k of freezeKeys) {
      try {
        const val = (window as any)[k];
        if (val) {
          Object.defineProperty(window, k, {
            value: val,
            writable: false,
            configurable: false,
          });
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
