// Запись на созвон: имя, телефон, компания, число мест, тариф, удобные
// день и окно времени. Заявка уходит в API kronto (POST /api/v1/leads):
// там она сохраняется, а команде приходит письмо.
// Если API недоступен — предлагаем отправить то же письмом или в Telegram,
// чтобы заявка не потерялась.

import { API_BASE, CONTACTS, FALLBACK_FORM } from "./config.js";

const form = document.querySelector("[data-lead-form]");

if (form) {
  const done = document.querySelector("[data-lead-done]");
  const doneText = document.querySelector("[data-lead-done-text]");
  const alertBox = form.querySelector("[data-form-alert]");
  const daysBox = form.querySelector("[data-days]");
  const slotsBox = form.querySelector("[data-slots]");
  const tzHint = form.querySelector("[data-tz-hint]");
  const submit = form.querySelector("[data-submit]");
  const submitLabel = form.querySelector("[data-submit-label]");
  const choice = daysBox.closest("fieldset");

  const field = (name) => form.elements.namedItem(name);
  const TARIFFS = { base: "Базовый", extended: "Расширенный", enterprise: "Корпоративный" };
  const MSK_OFFSET = 3; // Москва — UTC+3 круглый год
  const MAX_DAYS = 15;

  let config = null; // ответ /leads/form или null, если API не ответил
  let sending = false;

  /* ── Даты по Москве ── */

  const iso = (d) => d.toISOString().slice(0, 10);
  const fromIso = (s) => new Date(`${s}T00:00:00Z`);

  function moscowToday() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return fromIso(parts);
  }

  const fmt = (opts) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", ...opts });
  const fmtWeekday = fmt({ weekday: "short" });
  const fmtDayMonth = fmt({ day: "numeric", month: "short" });
  const fmtLong = fmt({ weekday: "long", day: "numeric", month: "long" });

  function workdays(first, last) {
    const out = [];
    for (let d = new Date(first); d <= last && out.length < MAX_DAYS; d.setUTCDate(d.getUTCDate() + 1)) {
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(new Date(d));
    }
    return out;
  }

  /* ── Дни и окна ── */

  function renderDays(first, last) {
    const tomorrow = new Date(moscowToday());
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const chosen = form.querySelector("input[name=preferred_date]:checked")?.value;
    daysBox.replaceChildren(...workdays(first, last).map((d) => {
      const value = iso(d);
      const label = document.createElement("label");
      label.className = "day";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "preferred_date";
      input.value = value;
      input.checked = value === chosen;
      const box = document.createElement("span");
      box.className = "day__box";
      const wd = document.createElement("span");
      wd.className = "day__wd";
      wd.textContent = value === iso(tomorrow) ? "завтра" : fmtWeekday.format(d).replace(".", "");
      const dm = document.createElement("span");
      dm.className = "day__d";
      dm.textContent = fmtDayMonth.format(d).replace(".", "");
      box.append(wd, dm);
      label.append(input, box);
      label.title = fmtLong.format(d);
      return label;
    }));
    updateDaysFade();
  }

  // Подпись местного времени, если посетитель не в Москве
  const localShift = -new Date().getTimezoneOffset() / 60 - MSK_OFFSET;

  function toLocal(hh, mm) {
    const total = (((Number(hh) * 60 + Number(mm) + localShift * 60) % 1440) + 1440) % 1440;
    const m = Math.round(total % 60);
    return m ? `${Math.floor(total / 60)}:${String(m).padStart(2, "0")}` : String(Math.floor(total / 60));
  }

  function shiftSlot(slot) {
    const m = /^(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})$/.exec(slot);
    return m ? `у вас ${toLocal(m[1], m[2])}–${toLocal(m[3], m[4])}` : "";
  }

  function renderSlots(slots) {
    const chosen = form.querySelector("input[name=preferred_slot]:checked")?.value;
    slotsBox.replaceChildren(...slots.map((slot) => {
      const label = document.createElement("label");
      label.className = "slot";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "preferred_slot";
      input.value = slot;
      input.checked = slot === chosen;
      const box = document.createElement("span");
      box.className = "slot__box";
      box.textContent = slot.replace(/:00/g, "");
      if (localShift) {
        const local = document.createElement("span");
        local.className = "slot__local";
        local.textContent = shiftSlot(slot);
        box.append(local);
      }
      label.append(input, box);
      return label;
    }));
    if (localShift) {
      const sign = localShift > 0 ? "+" : "−";
      tzHint.textContent = `Время московское (у вас ${sign}${Math.abs(localShift)} ч), только будни. Мы перезвоним и подтвердим созвон.`;
    }
  }

  function updateDaysFade() {
    daysBox.classList.toggle("is-end", daysBox.scrollLeft + daysBox.clientWidth >= daysBox.scrollWidth - 4);
  }
  daysBox.addEventListener("scroll", updateDaysFade, { passive: true });

  function applyConfig(cfg) {
    const today = moscowToday();
    let first;
    let last;
    let slots;
    if (cfg) {
      first = fromIso(cfg.first_date);
      last = fromIso(cfg.last_date);
      slots = cfg.slots;
    } else {
      first = new Date(today);
      first.setUTCDate(first.getUTCDate() + 1);
      last = new Date(today);
      last.setUTCDate(last.getUTCDate() + FALLBACK_FORM.daysAhead);
      slots = FALLBACK_FORM.slots;
    }
    renderDays(first, last);
    renderSlots(slots);
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/leads/form`, { signal: AbortSignal.timeout(8000), credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      config = await res.json();
    } catch {
      config = null;
    }
    applyConfig(config);
    return config;
  }

  applyConfig(null);
  loadConfig();

  /* ── Проверка полей ── */

  function normalizePhone(raw) {
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith("9")) digits = `7${digits}`;
    return digits;
  }

  function prettyPhone(raw) {
    const d = normalizePhone(raw);
    if (d.length === 11 && d.startsWith("7")) {
      return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
    }
    return raw.trim();
  }

  const CHECKS = {
    contact_name: (v) => (v.trim().length >= 2 ? "" : "Напишите, как к вам обращаться"),
    phone: (v) => {
      const d = normalizePhone(v);
      if (!v.trim()) return "Оставьте телефон — по нему мы перезвоним";
      return d.length >= 10 && d.length <= 15 ? "" : "Проверьте номер, например +7 999 123-45-67";
    },
    company_name: (v) => (v.trim().length >= 2 ? "" : "Укажите название компании"),
    seats: (v) => {
      const n = Number(v.replace(/\s/g, ""));
      if (!v.trim()) return "Сколько примерно человек — можно округлить";
      return Number.isInteger(n) && n >= 1 && n <= 100000 ? "" : "Число от 1 до 100 000";
    },
  };

  function showError(input, message) {
    const err = document.getElementById(`${input.id}-err`);
    if (err) {
      err.textContent = message;
      err.hidden = !message;
    }
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function checkField(input) {
    const msg = CHECKS[input.name] ? CHECKS[input.name](input.value) : "";
    showError(input, msg);
    return msg;
  }

  function checkChoice() {
    const day = form.querySelector("input[name=preferred_date]:checked");
    const slot = form.querySelector("input[name=preferred_slot]:checked");
    const err = document.getElementById("lead-day-err");
    let msg = "";
    if (!day && !slot) msg = "Выберите день и время, когда удобно поговорить";
    else if (!day) msg = "Выберите день";
    else if (!slot) msg = "Выберите время";
    err.textContent = msg;
    err.hidden = !msg;
    if (msg) choice.setAttribute("aria-invalid", "true");
    else choice.removeAttribute("aria-invalid");
    return msg;
  }

  function checkConsent() {
    const box = field("consent");
    const msg = box.checked ? "" : "Без согласия мы не можем принять заявку";
    showError(box, msg);
    return msg;
  }

  Object.keys(CHECKS).forEach((name) => {
    const input = field(name);
    input.addEventListener("blur", () => {
      if (name === "phone" && input.value.trim()) input.value = prettyPhone(input.value);
      if (input.value.trim()) checkField(input);
    });
    input.addEventListener("input", () => {
      if (name === "seats") {
        const clean = input.value.replace(/[^\d\s]/g, "");
        if (clean !== input.value) input.value = clean;
      }
      if (input.getAttribute("aria-invalid")) checkField(input);
    });
  });

  form.addEventListener("change", (e) => {
    if (e.target.name === "preferred_date" || e.target.name === "preferred_slot") {
      if (choice.hasAttribute("aria-invalid")) checkChoice();
    }
    if (e.target.name === "consent" && field("consent").hasAttribute("aria-invalid")) checkConsent();
  });

  // «Обсудить тариф» на карточке тарифа
  document.addEventListener("kronto:tariff", (e) => {
    const radio = form.querySelector(`input[name=tariff][value="${e.detail}"]`);
    if (radio) radio.checked = true;
  });

  /* ── Отправка ── */

  function data() {
    const day = form.querySelector("input[name=preferred_date]:checked")?.value || "";
    const slot = form.querySelector("input[name=preferred_slot]:checked")?.value || "";
    return {
      contact_name: field("contact_name").value.trim(),
      phone: prettyPhone(field("phone").value),
      company_name: field("company_name").value.trim(),
      seats: Number(field("seats").value.replace(/\s/g, "")),
      tariff: form.querySelector("input[name=tariff]:checked")?.value || "base",
      preferred_date: day,
      preferred_slot: slot,
    };
  }

  const whenText = (d) => `${fmtLong.format(fromIso(d.preferred_date))}, ${d.preferred_slot.replace("–", " – ")} по Москве`;

  function mailtoHref(d) {
    const body = [
      "Здравствуйте! Хочу записаться на созвон по kronto.",
      "",
      `Имя: ${d.contact_name}`,
      `Телефон: ${d.phone}`,
      `Компания: ${d.company_name}`,
      `Сотрудников за компьютером: ${d.seats}`,
      `Тариф: ${TARIFFS[d.tariff]}`,
      `Удобно: ${whenText(d)}`,
    ].join("\n");
    return `mailto:${CONTACTS.email}?subject=${encodeURIComponent("Запись на созвон — kronto")}&body=${encodeURIComponent(body)}`;
  }

  function showAlert(message, { fallback = false, retry = false } = {}) {
    alertBox.replaceChildren();
    const p = document.createElement("span");
    p.textContent = message;
    alertBox.append(p);
    if (fallback || retry) {
      const row = document.createElement("span");
      row.className = "form-alert__actions";
      if (fallback) {
        const mail = document.createElement("a");
        mail.className = "btn btn--light";
        mail.href = mailtoHref(data());
        mail.textContent = "Отправить письмом";
        const tg = document.createElement("a");
        tg.className = "btn btn--ghost-light";
        tg.href = `https://t.me/${CONTACTS.telegram}`;
        tg.rel = "noopener";
        tg.target = "_blank";
        tg.textContent = "Написать в Telegram";
        row.append(mail, tg);
      }
      if (retry) {
        const again = document.createElement("button");
        again.type = "submit";
        again.className = "btn btn--ghost-light";
        again.textContent = "Попробовать ещё раз";
        row.append(again);
      }
      alertBox.append(row);
    }
    alertBox.hidden = false;
    alertBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function setBusy(on) {
    sending = on;
    submit.setAttribute("aria-busy", String(on));
    submitLabel.textContent = on ? "Отправляем…" : "Записаться на созвон";
  }

  function detailText(body) {
    const d = body?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length) return "Проверьте поля формы и попробуйте ещё раз.";
    return "";
  }

  async function send() {
    const d = data();
    if (!config) await loadConfig();
    if (!config) {
      showAlert("Не получилось связаться с сервером записи. Отправьте заявку письмом или в Telegram — данные из формы подставятся сами.", { fallback: true, retry: true });
      return;
    }
    if (!config.enabled) {
      showAlert("Онлайн-запись сейчас недоступна. Отправьте заявку письмом или в Telegram — данные из формы подставятся сами.", { fallback: true });
      return;
    }
    let res;
    try {
      res = await fetch(`${API_BASE}/api/v1/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          ...d,
          email: null,
          comment: null,
          policy_version: config.policy_version,
          consent: field("consent").checked,
          website: field("website").value,
        }),
      });
    } catch {
      showAlert("Заявка не отправилась: нет связи с сервером. Попробуйте ещё раз или отправьте её письмом.", { fallback: true, retry: true });
      return;
    }

    if (res.ok) {
      doneText.textContent = `Перезвоним на ${d.phone}, чтобы подтвердить созвон: ${whenText(d)}. Если планы изменятся — напишите на ${CONTACTS.email}.`;
      form.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
      done.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    const body = await res.json().catch(() => null);
    const detail = detailText(body);
    if (res.status === 422 && /политик/i.test(detail)) {
      await loadConfig();
      showAlert("Мы обновили политику обработки данных. Проверьте форму и отправьте заявку ещё раз.");
    } else if (res.status === 422) {
      showAlert(detail || "Проверьте поля формы и попробуйте ещё раз.");
      if (/дат|будн|время/i.test(detail)) loadConfig();
    } else if (res.status === 429) {
      showAlert("С вашего адреса уже ушло несколько заявок. Мы их получили — или напишите нам напрямую.", { fallback: true });
    } else if (res.status === 404) {
      showAlert("Онлайн-запись сейчас недоступна. Отправьте заявку письмом или в Telegram — данные из формы подставятся сами.", { fallback: true });
    } else {
      showAlert("Сервер записи не ответил. Попробуйте ещё раз или отправьте заявку письмом.", { fallback: true, retry: true });
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    alertBox.hidden = true;

    const order = ["contact_name", "phone", "company_name", "seats"];
    let firstBad = null;
    order.forEach((name) => {
      const input = field(name);
      if (name === "phone" && input.value.trim()) input.value = prettyPhone(input.value);
      if (checkField(input) && !firstBad) firstBad = input;
    });
    if (checkChoice() && !firstBad) firstBad = daysBox.querySelector("input") || daysBox;
    if (checkConsent() && !firstBad) firstBad = field("consent");
    if (firstBad) {
      firstBad.focus();
      return;
    }

    setBusy(true);
    try {
      await send();
    } finally {
      setBusy(false);
    }
  });
}
