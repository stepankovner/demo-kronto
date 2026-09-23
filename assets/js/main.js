// Шапка, мобильное меню, вкладки «Для кого», подсветка пункта меню.

/* ——— шапка: линия снизу после прокрутки ——— */
const header = document.querySelector(".site-header");
const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ——— мобильное меню ——— */
const burger = document.querySelector(".burger");
const nav = document.getElementById("site-nav");

function setMenu(open, { focusBurger = false } = {}) {
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  nav.classList.toggle("is-open", open);
  header.classList.toggle("is-menu-open", open);
  document.body.classList.toggle("is-locked", open);
  if (open) nav.querySelector("a")?.focus();
  else if (focusBurger) burger.focus();
}

burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
nav.addEventListener("click", (e) => {
  if (e.target.closest("a") && nav.classList.contains("is-open")) setMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("is-open")) setMenu(false, { focusBurger: true });
});
// Tab по кругу внутри открытого меню
nav.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || !nav.classList.contains("is-open")) return;
  const items = [...nav.querySelectorAll("a"), burger].filter((n) => n.offsetParent !== null);
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); burger.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); burger.focus(); }
});
burger.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.shiftKey && nav.classList.contains("is-open")) {
    e.preventDefault();
    nav.querySelector("a")?.focus();
  }
});
window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => {
  if (e.matches) setMenu(false);
});

/* ——— активный пункт меню ——— */
const links = new Map(
  [...nav.querySelectorAll('.nav__list a[href^="#"]')].map((a) => [a.getAttribute("href").slice(1), a])
);
const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const link = links.get(entry.target.id);
      if (!link) continue;
      if (entry.isIntersecting) {
        links.forEach((a) => { a.classList.remove("is-active"); a.removeAttribute("aria-current"); });
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
      }
    }
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
links.forEach((_, id) => {
  const section = document.getElementById(id);
  if (section) spy.observe(section);
});

/* ——— вкладки «Для кого» ——— */
document.querySelectorAll("[data-tabs]").forEach((root) => {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));

  function select(i, focus = true) {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) {
      tabs[i].focus();
      tabs[i].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (e) => {
      const last = tabs.length - 1;
      const map = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last };
      if (e.key in map) {
        e.preventDefault();
        select(map[e.key]);
      }
    });
  });

  root.classList.add("is-ready");
  select(0, false);
});
