// Демо-чат: вопросы к вымышленной компании, ответы со ссылками на
// источники. Номер в ответе или карточка под ним открывает фрагмент
// документа с подсвеченным местом.

import { DOCS, SCENARIOS, UNKNOWN } from "./demo-data.js";
import { typo } from "./typo.js";

const root = document.querySelector("[data-demo]");

if (root) {
  const thread = root.querySelector("[data-demo-thread]");
  const form = root.querySelector("[data-demo-form]");
  const input = form.querySelector("input");
  const resetBtn = root.querySelector("[data-demo-reset]");
  const docItems = [...root.querySelectorAll("[data-doc]")];
  const docsPanel = root.querySelector("[data-demo-docs]");

  const THINK_MS = 650;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** Состояние: список вопросов; у каждого — открытый источник или -1 */
  let items = [];
  let busy = false;
  let timer = 0;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = typo(text);
    return node;
  };

  // «текст [1] текст» → узлы: текст и кнопки-номера источников
  function withCites(text, item, idx) {
    const frag = document.createDocumentFragment();
    text.split(/\s?(\[\d\])/).filter(Boolean).forEach((part) => {
      const m = /^\[(\d)\]$/.exec(part);
      if (!m) {
        frag.append(typo(part));
        return;
      }
      const n = Number(m[1]);
      const btn = el("button", "cite", String(n));
      btn.type = "button";
      btn.setAttribute("aria-label", `Источник ${n}: ${DOCS[item.sc.sources[n - 1].doc].title}`);
      btn.addEventListener("click", () => openSource(idx, n - 1, true));
      frag.append(btn);
    });
    return frag;
  }

  // «обычный ==подсвеченный== текст» → узлы с <mark>
  function withMarks(text) {
    const frag = document.createDocumentFragment();
    text.split(/(==[^=]+==)/).filter(Boolean).forEach((part) => {
      if (part.startsWith("==") && part.endsWith("==")) frag.append(el("mark", "", part.slice(2, -2)));
      else frag.append(typo(part));
    });
    return frag;
  }

  function renderAnswer(item, idx) {
    const box = el("div", "msg__answer");
    const sc = item.sc;

    if (sc.refusal) {
      const r = el("div", "refusal");
      r.append(el("p", "refusal__title", sc.refusal.title), el("p", "refusal__text", sc.refusal.text));
      if (sc.refusal.gap) r.append(el("span", "refusal__badge", "такие вопросы попадают в отчёт о пробелах в документах"));
      if (sc.refusal.cta) {
        const a = el("a", "btn btn--dark btn--sm refusal__cta", "Записаться на созвон");
        a.href = "#contact";
        r.append(a);
      }
      box.append(r);
      return box;
    }

    sc.answer.forEach((b) => {
      if (b.p) {
        const p = el("p", "msg__p");
        p.append(withCites(b.p, item, idx));
        box.append(p);
      } else if (b.ol) {
        const ol = el("ol", "msg__ol");
        b.ol.forEach((t, i) => {
          const li = el("li");
          const span = el("span");
          span.append(withCites(t, item, idx));
          li.append(el("span", "msg__ol-n", String(i + 1)), span);
          ol.append(li);
        });
        box.append(ol);
      } else if (b.file) {
        const file = el("div", "msg__file");
        const info = el("span");
        info.append(el("span", "msg__file-name", b.file.name), el("span", "msg__file-note", b.file.note));
        file.append(el("span", "doc__type doc__type--docx", "docx"), info);
        box.append(file);
      }
    });

    // Карточки источников
    const chips = el("div", "chips");
    sc.sources.forEach((s, i) => {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.setAttribute("aria-expanded", String(item.open === i));
      chip.setAttribute("aria-controls", `demo-frag-${idx}`);
      const body = el("span", "chip__body");
      body.append(el("span", "chip__title", DOCS[s.doc].title), el("span", "chip__ref", s.ref));
      chip.append(el("span", "chip__n", String(i + 1)), body);
      chip.addEventListener("click", () => openSource(idx, item.open === i ? -1 : i, false));
      chips.append(chip);
    });
    box.append(chips);

    const fragSlot = el("div");
    fragSlot.id = `demo-frag-${idx}`;
    if (item.open >= 0) {
      const s = sc.sources[item.open];
      const card = el("div", "frag");
      const head = el("div", "frag__head");
      head.append(el("span", "frag__title", DOCS[s.doc].title), el("span", "frag__section", `${s.section} · ${s.ref}`));
      card.append(head);
      s.text.forEach((line) => {
        const p = el("p", "frag__line");
        p.append(withMarks(line));
        card.append(p);
      });
      fragSlot.append(card);
    }
    box.append(fragSlot);
    return box;
  }

  function renderMessage(item, idx, isNew) {
    const msg = el("div", isNew ? "msg is-new" : "msg");
    msg.dataset.idx = idx;
    msg.append(el("p", "msg__q", item.q));
    if (item.loading) {
      const dots = el("span", "typing");
      dots.setAttribute("aria-label", "kronto ищет ответ в документах");
      dots.append(el("span"), el("span"), el("span"));
      msg.append(dots);
    } else {
      msg.append(renderAnswer(item, idx));
    }
    return msg;
  }

  function renderSuggest() {
    const asked = new Set(items.map((i) => i.sc.id));
    let list = SCENARIOS.filter((s) => !asked.has(s.id));
    if (!list.length) list = SCENARIOS.filter((s) => s.id !== items[items.length - 1]?.sc.id);
    const wrap = el("div", "suggest");
    wrap.dataset.suggest = "";
    wrap.append(el("span", "suggest__label", "спросите ещё"));
    const row = el("div", "suggest__list");
    list.slice(0, 3).forEach((s) => {
      const b = el("button", "suggest__btn", s.question);
      b.type = "button";
      b.addEventListener("click", () => ask(s, s.question));
      row.append(b);
    });
    wrap.append(row);
    return wrap;
  }

  function highlightDocs() {
    const last = items[items.length - 1];
    const cited = new Set(last && !last.loading && last.sc.sources ? last.sc.sources.map((s) => s.doc) : []);
    docItems.forEach((d) => d.classList.toggle("is-cited", cited.has(d.dataset.doc)));
  }

  function render({ scroll = "none", newIdx = -1 } = {}) {
    thread.replaceChildren(...items.map((it, i) => renderMessage(it, i, i === newIdx)));
    if (!busy) thread.append(renderSuggest());
    highlightDocs();
    const behavior = reduced.matches ? "auto" : "smooth";
    if (scroll === "bottom") {
      thread.scrollTo({ top: thread.scrollHeight, behavior });
    } else if (scroll === "answer") {
      // Новый ответ — к его началу, а не в самый низ: длинный ответ читается сверху
      const msg = thread.querySelector(`.msg[data-idx="${items.length - 1}"]`);
      if (msg) thread.scrollTo({ top: msg.offsetTop - 16, behavior });
    }
  }

  function openSource(idx, i, fromCite) {
    items[idx].open = i;
    render();
    if (i >= 0) {
      const frag = thread.querySelector(`#demo-frag-${idx} .frag`);
      if (frag) {
        const top = frag.offsetTop + frag.offsetHeight - thread.clientHeight + 24;
        if (top > thread.scrollTop || fromCite) {
          thread.scrollTo({ top: Math.max(top, thread.scrollTop), behavior: reduced.matches ? "auto" : "smooth" });
        }
      }
    }
  }

  function ask(sc, q) {
    if (busy) return;
    clearTimeout(timer);
    busy = true;
    items.push({ sc, q, open: -1, loading: true });
    render({ scroll: "bottom", newIdx: items.length - 1 });
    timer = setTimeout(() => {
      const it = items[items.length - 1];
      it.loading = false;
      it.open = sc.sources ? 0 : -1;
      busy = false;
      render({ scroll: "answer" });
    }, reduced.matches ? 150 : THINK_MS);
  }

  // Свой вопрос: узнаём сценарий по ключевым словам, иначе — честный отказ
  function match(q) {
    const norm = q.toLowerCase().replace(/ё/g, "е");
    let best = null;
    let score = 0;
    SCENARIOS.forEach((s) => {
      const hits = s.keywords.filter((k) => norm.includes(k.replace(/ё/g, "е"))).length;
      if (hits > score) {
        score = hits;
        best = s;
      }
    });
    return best;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    const sc = match(q) || { id: "custom", refusal: { ...UNKNOWN, cta: true } };
    ask(sc, q);
  });

  resetBtn.addEventListener("click", () => {
    clearTimeout(timer);
    busy = false;
    start();
    thread.scrollTo({ top: 0 });
  });

  function start() {
    const first = SCENARIOS[0];
    items = [{ sc: first, q: first.question, open: 0, loading: false }];
    render();
  }

  // На телефоне список документов свёрнут, на компьютере — всегда открыт
  const wide = window.matchMedia("(min-width: 761px)");
  const syncDocs = () => { docsPanel.open = wide.matches; };
  syncDocs();
  wide.addEventListener("change", syncDocs);
  docsPanel.addEventListener("toggle", () => {
    if (wide.matches && !docsPanel.open) docsPanel.open = true;
  });

  start();
}
