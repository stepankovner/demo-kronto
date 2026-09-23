// Интерактивное демо и анимация окна в hero. Тексты — в demo-data.js.
import { documents, scenarios, fallback, timing } from "./demo-data.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileSheet = window.matchMedia("(max-width: 899px)");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ——— helpers ——— */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

/* Типографика для текстов из demo-data.js: неразрывный пробел перед тире и после коротких слов */
function typo(s) {
  return s
    .replace(/ — /g, "\u00a0— ")
    .replace(/(^|[\s(«])([а-яёА-ЯЁ]{1,2}) /g, "$1$2\u00a0")
    .replace(/(^|[\s(«])([а-яёА-ЯЁ]{1,2}) /g, "$1$2\u00a0");
}

function normalize(s) {
  return s.toLowerCase().replace(/ё/g, "е");
}

/* Разбирает строку с **жирным** и маркерами [n] в DOM-узлы.
   Каждое слово оборачивается в span.w, чтобы его можно было «напечатать». */
function renderInline(text, makeMarker) {
  text = typo(text);
  const frag = document.createDocumentFragment();
  const parts = text.split(/(\*\*[^*]+\*\*|\s?\[\d+\])/g).filter(Boolean);
  for (const part of parts) {
    const marker = part.match(/^\s?\[(\d+)\]$/);
    if (marker) {
      const m = makeMarker(Number(marker[1]));
      m.classList.add("w");
      frag.append(m);
    } else if (part.startsWith("**")) {
      const strong = el("strong");
      appendWords(strong, part.slice(2, -2));
      frag.append(strong);
    } else {
      appendWords(frag, part);
    }
  }
  return frag;
}

function appendWords(parent, text) {
  for (const token of text.split(/([ \t\n]+)/)) {
    if (!token) continue;
    if (/^[ \t\n]+$/.test(token)) parent.append(document.createTextNode(token));
    else parent.append(el("span", { class: "w", text: token }));
  }
}

async function streamWords(root, isCancelled, onStep) {
  const words = root.querySelectorAll(".w");
  if (reducedMotion.matches) {
    words.forEach((w) => w.classList.add("is-on"));
    onStep?.();
    return;
  }
  for (const w of words) {
    if (isCancelled()) return;
    w.classList.add("is-on");
    onStep?.();
    await wait(timing.perWord);
  }
}

/* ═════════ Анимация окна в hero ═════════ */

function initHero() {
  const win = document.querySelector("[data-hero-window]");
  if (!win || reducedMotion.matches) return;

  const q = win.querySelector('[data-step="q"]');
  const status = win.querySelector('[data-step="search"]');
  const answer = win.querySelector('[data-step="a"]');
  const stream = win.querySelector("[data-stream]");
  const card = win.querySelector('[data-step="src"]');

  // Оборачиваем слова ответа, не трогая вложенную разметку
  (function wrap(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        appendWords(frag, child.textContent);
        child.replaceWith(frag);
      } else if (child.classList.contains("src") || child.classList.contains("visually-hidden")) {
        child.classList.add("w");
      } else {
        wrap(child);
      }
    }
  })(stream);

  win.classList.add("hero-window");
  [q, card].forEach((n) => n.classList.add("is-concealed"));

  const play = async () => {
    await wait(250);
    q.classList.remove("is-concealed");
    q.classList.add("appear");
    await wait(650);
    status.hidden = false;
    await wait(timing.searching);
    status.hidden = true;
    await streamWords(stream, () => false);
    await wait(200);
    card.classList.remove("is-concealed");
    card.classList.add("appear");
  };

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      play();
    }
  }, { threshold: 0.35 });
  io.observe(answer);
}

/* ═════════ Демо ═════════ */

function initDemo() {
  const root = document.querySelector("[data-demo]");
  if (!root) return;

  const chat = root.querySelector("[data-chat]");
  const live = root.querySelector("[data-live]");
  const form = root.querySelector("[data-demo-form]");
  const input = form.querySelector("input");
  const sendBtn = form.querySelector("button");
  const chips = [...root.querySelectorAll("[data-scenario]")];
  const resetBtn = root.querySelector("[data-demo-reset]");
  const docsAside = root.querySelector("[data-docs]");
  const docsToggle = root.querySelector("[data-docs-toggle]");
  const docsList = root.querySelector("[data-docs-list]");
  const panel = root.querySelector("[data-source-panel]");
  const backdrop = root.querySelector("[data-sheet-backdrop]");
  const intro = chat.firstElementChild.cloneNode(true);

  /* Вопросы-подсказки берём из разметки композера и показываем внутри переписки:
     так они видны сразу, без прокрутки к полю ввода. */
  const suggestions = chips.map((c) => ({ key: c.dataset.scenario, text: c.textContent.trim() }));
  const used = new Set();
  root.classList.add("is-ready");

  let run = 0;          // номер текущего прогона; «Начать заново» его увеличивает
  let busy = false;
  let lastTrigger = null;

  /* список документов */
  docsList.replaceChildren(
    ...Object.entries(documents).map(([id, d]) =>
      el("li", { class: "doc", "data-doc": id },
        el("span", { class: `doc__icon doc__icon--${d.type}`, text: d.type, "aria-hidden": "true" }),
        el("span", {},
          el("span", { class: "doc__name", text: d.title }),
          el("span", { class: "doc__src mono", text: `${d.type === "web" ? "страница" : d.type} · ${d.source}` })
        )
      )
    )
  );

  docsToggle.addEventListener("click", () => {
    const open = docsToggle.getAttribute("aria-expanded") !== "true";
    docsToggle.setAttribute("aria-expanded", String(open));
    docsAside.classList.toggle("is-collapsed", !open);
  });

  const setBusy = (v) => {
    busy = v;
    chips.forEach((c) => (c.disabled = v));
    chat.querySelectorAll(".suggest button").forEach((btn) => (btn.disabled = v));
    sendBtn.disabled = v;
  };

  /* Блок с вопросами-подсказками */
  function suggestBlock(keys, label) {
    const box = el("div", { class: "suggest" }, el("p", { class: "mono muted", text: label }));
    const row = el("div", { class: "suggest__row" });
    keys.forEach((key) => {
      const s = suggestions.find((x) => x.key === key);
      const btn = el("button", { class: "chip", type: "button", text: s.text });
      btn.addEventListener("click", () => {
        if (busy) return;
        // подсказка сейчас исчезнет — не теряем фокус клавиатуры
        if (document.activeElement === btn) chat.focus({ preventScroll: true });
        chat.querySelectorAll(".suggest").forEach((n) => n.remove());
        answerScenario(key);
      });
      row.append(btn);
    });
    box.append(row);
    return box;
  }

  function showIntro() {
    chat.replaceChildren(intro.cloneNode(true), suggestBlock(suggestions.map((s) => s.key), "попробуйте спросить"));
  }

  function offerMore() {
    const rest = suggestions.map((s) => s.key).filter((k) => !used.has(k));
    if (!rest.length) return;
    const block = suggestBlock(rest.slice(0, 3), "спросите ещё");
    chat.append(block);
    revealBottom(block);
  }

  /* Вопрос закрепляем вверху окна, как в чатах: ответ разворачивается под ним
     и не выталкивает вопрос за пределы видимой области. */
  const pinToTop = (node) => { chat.scrollTop = node.offsetTop - chat.offsetTop - 8; };
  /* Докручиваем минимально: только чтобы показать то, что не поместилось */
  const revealBottom = (node) => {
    const bottom = node.offsetTop - chat.offsetTop + node.offsetHeight;
    if (bottom > chat.scrollTop + chat.clientHeight) chat.scrollTop = bottom - chat.clientHeight + 16;
  };
  const announce = (text) => {
    live.textContent = "";
    setTimeout(() => { live.textContent = text; }, 50);
  };

  /* ——— панель источника ——— */

  function openSource(source, n, trigger) {
    const doc = documents[source.doc];
    panel.querySelector("[data-sp-meta]").textContent =
      `источник ${n} · ${doc.type === "web" ? "страница портала" : doc.type} · ${doc.source}`;
    panel.querySelector("[data-sp-title]").textContent = doc.title;
    panel.querySelector("[data-sp-section]").textContent = `${source.section} · ${source.ref}`;

    const body = panel.querySelector("[data-sp-text]");
    body.replaceChildren(
      ...source.text.map((para) => {
        const p = el("p");
        typo(para).split(/(==[^=]+==)/g).filter(Boolean).forEach((chunk) => {
          if (chunk.startsWith("==")) p.append(el("mark", { text: chunk.slice(2, -2) }));
          else p.append(document.createTextNode(chunk));
        });
        return p;
      })
    );

    if (lastTrigger && lastTrigger !== trigger) lastTrigger.setAttribute("aria-expanded", "false");
    lastTrigger = trigger;
    trigger?.setAttribute("aria-expanded", "true");

    docsList.querySelectorAll(".doc").forEach((d) => d.classList.toggle("is-cited", d.dataset.doc === source.doc));

    panel.hidden = false;
    panel.scrollTop = 0;
    if (mobileSheet.matches) {
      backdrop.hidden = false;
      document.body.classList.add("is-locked");
    }
    // перезапуск анимации появления
    panel.style.animation = "none";
    void panel.offsetWidth;
    panel.style.animation = "";
    panel.focus({ preventScroll: true });
    panel.querySelector("mark")?.scrollIntoView({ block: "nearest" });
  }

  function closeSource({ restoreFocus = true } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("is-locked");
    docsList.querySelectorAll(".doc.is-cited").forEach((d) => d.classList.remove("is-cited"));
    if (lastTrigger) {
      lastTrigger.setAttribute("aria-expanded", "false");
      if (restoreFocus && lastTrigger.isConnected) lastTrigger.focus();
    }
    lastTrigger = null;
  }

  panel.querySelector("[data-sp-close]").addEventListener("click", () => closeSource());
  backdrop.addEventListener("click", () => closeSource());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.stopPropagation();
      closeSource();
    }
  });

  /* ——— сообщения ——— */

  function addUser(text) {
    resetBtn.disabled = false;
    const m = el("p", { class: "msg msg--user" }, el("span", { class: "visually-hidden", text: "Вы: " }), text);
    chat.append(m);
    announce(`Вы: ${text}`);
    pinToTop(m);
  }

  async function addStatus(myRun) {
    const s = el("p", { class: "msg mono muted msg--searching", text: "ищу в документах…" });
    chat.append(s);
    revealBottom(s);
    await wait(reducedMotion.matches ? 0 : timing.searching);
    s.remove();
    return myRun === run;
  }

  function buildAnswer(sc) {
    const box = el("div", { class: "msg msg--bot" });
    const marker = (n) => {
      const src = sc.sources[n - 1];
      const b = el("button", {
        class: "src",
        type: "button",
        "aria-label": `Источник ${n}: ${documents[src.doc].title}`,
        "aria-controls": "source-panel",
        "aria-expanded": "false",
        text: String(n),
      });
      b.addEventListener("click", () => openSource(src, n, b));
      return b;
    };

    for (const block of sc.answer) {
      if (block.p) box.append(el("p", {}, renderInline(block.p, marker)));
      if (block.ol || block.ul) {
        const list = el(block.ol ? "ol" : "ul");
        (block.ol || block.ul).forEach((item) => list.append(el("li", {}, renderInline(item, marker))));
        box.append(list);
      }
      if (block.file) {
        const f = block.file;
        const src = sc.sources[f.source - 1];
        const card = el("div", { class: "attachment w" },
          el("span", { class: `doc__icon doc__icon--${f.type}`, text: f.type, "aria-hidden": "true" }),
          el("span", {},
            el("span", { class: "attachment__name", text: f.name }),
            el("span", { class: "attachment__meta", text: f.note })
          )
        );
        const open = el("button", { class: "btn btn--ghost btn--sm", type: "button", "aria-controls": "source-panel", "aria-expanded": "false", text: "Открыть" });
        open.addEventListener("click", () => openSource(src, f.source, open));
        card.append(open);
        box.append(card);
      }
    }

    const row = el("div", { class: "answer-sources is-concealed" });
    sc.sources.forEach((src, i) => {
      const doc = documents[src.doc];
      const b = el("button", { class: "source-btn", type: "button", "aria-controls": "source-panel", "aria-expanded": "false" },
        el("span", { class: "src", "aria-hidden": "true", text: String(i + 1) }),
        el("span", {},
          el("span", { class: "visually-hidden", text: `Источник ${i + 1}: ` }),
          doc.title,
          el("span", { class: "mono", text: src.ref })
        )
      );
      b.addEventListener("click", () => openSource(src, i + 1, b));
      row.append(b);
    });
    box.append(row);
    return { box, row };
  }

  async function answerScenario(key, typedText) {
    const sc = scenarios[key];
    const myRun = ++run;
    setBusy(true);
    closeSource({ restoreFocus: false });
    addUser(typedText ?? sc.question);
    used.add(key);
    chat.querySelectorAll(".suggest").forEach((n) => n.remove());
    chips.find((c) => c.dataset.scenario === key)?.classList.add("is-used");

    if (!(await addStatus(myRun))) return;

    if (sc.refusal) {
      const r = sc.refusal;
      const box = el("div", { class: "msg msg--bot msg--refusal appear" },
        el("p", { class: "refusal__title", text: typo(r.title) }),
        el("p", { class: "muted", text: typo(r.text) }),
        el("span", { class: "badge", text: typo(r.badge) })
      );
      chat.append(box);
      announce(`Kronto: ${r.title} ${r.text} ${r.badge}`);
      revealBottom(box);
      setBusy(false);
      offerMore();
      return;
    }

    const { box, row } = buildAnswer(sc);
    box.classList.add("is-streaming");
    chat.append(box);
    await streamWords(box, () => myRun !== run);
    if (myRun !== run) return;
    box.classList.remove("is-streaming");
    row.classList.remove("is-concealed");
    if (!reducedMotion.matches) row.classList.add("appear");
    revealBottom(row);
    announce(`Kronto: ${box.textContent.replace(/\s+/g, " ").trim()}`);
    setBusy(false);
    offerMore();
  }

  async function answerFallback(text) {
    const myRun = ++run;
    setBusy(true);
    closeSource({ restoreFocus: false });
    addUser(text);
    if (!(await addStatus(myRun))) return;
    const box = el("div", { class: "msg msg--bot msg--fallback appear" },
      el("p", { text: typo(fallback.text) }),
      el("a", { class: "btn btn--dark btn--sm", href: fallback.href, text: fallback.button })
    );
    chat.append(box);
    announce(`Kronto: ${fallback.text}`);
    revealBottom(box);
    setBusy(false);
    offerMore();
  }

  function match(text) {
    const q = normalize(text);
    let best = null;
    let bestHits = 0;
    for (const [key, sc] of Object.entries(scenarios)) {
      const hits = sc.keywords.filter((k) => q.includes(k)).length;
      if (hits >= sc.minHits && hits > bestHits) {
        best = key;
        bestHits = hits;
      }
    }
    return best;
  }

  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      if (!busy) answerScenario(chip.dataset.scenario);
    })
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    const key = match(text);
    if (key) answerScenario(key, text);
    else answerFallback(text);
  });

  resetBtn.addEventListener("click", () => {
    run++;
    closeSource({ restoreFocus: false });
    used.clear();
    showIntro();
    chips.forEach((c) => c.classList.remove("is-used"));
    input.value = "";
    live.textContent = "Переписка очищена";
    setBusy(false);
    resetBtn.disabled = true;
    input.focus();
  });

  /* «Начать заново» нечего сбрасывать, пока не задан первый вопрос */
  resetBtn.disabled = true;
  showIntro();

  mobileSheet.addEventListener("change", () => closeSource({ restoreFocus: false }));
}

initHero();
initDemo();
