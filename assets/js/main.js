// Шапка, меню, тарифы-перевёртыши, окно «Безопасность и данные»,
// плавающая кнопка на телефоне и горизонт маяка на первом экране.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ── Активный пункт меню ── */

const navLinks = $$("[data-nav]");
const sections = navLinks.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);

function markActive() {
  const line = window.innerHeight * 0.4;
  let current = "";
  for (const s of sections) {
    if (s.getBoundingClientRect().top < line) current = s.id;
  }
  // Ниже вопросов (созвон, подвал) ничего не подсвечиваем
  const contact = document.getElementById("contact");
  if (contact && contact.getBoundingClientRect().top < line) current = "";
  navLinks.forEach((a) => {
    if (a.dataset.nav === current) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  });
}

/* ── Плавающая кнопка на телефоне ── */

const mobileCta = $("[data-mobile-cta]");
const contactSection = document.getElementById("contact");

const demoWindow = $("[data-demo]");
let typing = false;

function updateMobileCta() {
  if (!mobileCta) return;
  const vh = window.innerHeight;
  const pastHero = window.scrollY > vh * 0.8;
  const contactTop = contactSection ? contactSection.getBoundingClientRect().top : Infinity;
  // Не закрываем поле ввода демо, когда окно демо внизу экрана
  const demo = demoWindow ? demoWindow.getBoundingClientRect() : null;
  const overDemo = demo ? demo.top < vh && demo.bottom > vh - 90 : false;
  const show = pastHero && contactTop > vh && !overDemo && !typing;
  if (show) mobileCta.hidden = false;
  mobileCta.classList.toggle("is-visible", show);
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    markActive();
    updateMobileCta();
  });
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll, { passive: true });
// Пока открыта клавиатура, кнопка не нужна
document.addEventListener("focusin", (e) => {
  typing = e.target.matches("input:not([type=radio]):not([type=checkbox]), textarea");
  updateMobileCta();
});
document.addEventListener("focusout", () => {
  typing = false;
  requestAnimationFrame(updateMobileCta);
});
onScroll();

/* ── Мобильное меню ── */

const menuBtn = $("[data-menu-btn]");
const menu = $("[data-menu]");

function setMenu(open) {
  if (!menuBtn || !menu) return;
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Закрыть меню" : "Меню");
  menu.hidden = !open;
}

if (menuBtn && menu) {
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !e.target.closest("[data-header]")) setMenu(false);
  });
}

/* ── Тарифы: карточка переворачивается ── */

function flip(plan, open) {
  const front = $("[data-plan-front]", plan);
  const back = $("[data-plan-back]", plan);
  const more = $("[data-plan-open]", plan);
  plan.classList.toggle("is-flipped", open);
  front.inert = open;
  back.inert = !open;
  more.setAttribute("aria-expanded", String(open));
  // Фокус — на то, что видно, иначе клавиатура окажется на скрытой стороне
  const target = open ? $("[data-plan-close]", back) : more;
  target.focus({ preventScroll: true });
}

$$("[data-plan]").forEach((plan) => {
  $("[data-plan-open]", plan)?.addEventListener("click", () => flip(plan, true));
  $("[data-plan-close]", plan)?.addEventListener("click", () => flip(plan, false));
  plan.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && plan.classList.contains("is-flipped")) flip(plan, false);
  });
});

// «Обсудить тариф» — выбрать тариф в форме записи
$$("[data-tariff]").forEach((link) => {
  link.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("kronto:tariff", { detail: link.dataset.tariff }));
  });
});

/* ── Окно «Безопасность и данные» ── */

$$("[data-dialog-open]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const dialog = document.getElementById(btn.dataset.dialogOpen);
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else {
      dialog.setAttribute("open", "");
    }
    $(".dialog__body", dialog)?.scrollTo(0, 0);
  });
});

$$("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
  });
  $$("[data-dialog-close]", dialog).forEach((btn) => btn.addEventListener("click", () => dialog.close()));
  // Щелчок по затемнению закрывает окно
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
});

/* ── Горизонт маяка — по линии букв «kronto» ── */

const hero = $("[data-hero]");
const baseline = $("[data-hero-baseline]");
const beacon = hero ? $("kronto-beacon", hero) : null;

function measureHorizon() {
  if (!hero || !baseline || !beacon) return;
  const h = hero.getBoundingClientRect();
  const b = baseline.getBoundingClientRect();
  if (!h.height) return;
  // На узком экране текст стоит под словом — горизонт оставляем маяку
  const wide = hero.clientWidth >= 1100 && hero.clientWidth / hero.clientHeight >= 1.25;
  const hz = wide ? Math.round(((h.bottom - b.bottom) / h.height) * 1000) / 1000 : "";
  if (String(hz) !== (beacon.getAttribute("hz") || "")) beacon.setAttribute("hz", hz);
}

if (hero) {
  measureHorizon();
  document.fonts?.ready.then(measureHorizon);
  new ResizeObserver(measureHorizon).observe(hero);
}
