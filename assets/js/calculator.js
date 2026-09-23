// Калькулятор экономии.

/* ——— Константы методики. Меняйте здесь. ———
   Источник ориентиров (~2 минуты на обращение, 50% продуктивного времени):
   Forrester, The Total Economic Impact of Glean, 2024 (заказано Glean). */
const WORKING_DAYS_PER_MONTH = 21;   // рабочих дней в месяце
const PRODUCTIVE_SHARE = 0.5;        // доля сэкономленного времени, которая уходит в полезную работу
const HOURS_PER_FTE = 168;           // часов в месяце на одну ставку
const MONTHS_PER_YEAR = 12;

/* Формула:
   часов_в_месяц      = сотрудники × обращения × минуты / 60 × WORKING_DAYS_PER_MONTH
   продуктивных_часов = часов_в_месяц × PRODUCTIVE_SHARE
   экономия_₽_в_месяц = продуктивных_часов × стоимость_часа
   По умолчанию: 200 × 7 × 2 / 60 × 21 = 980 ч → 490 ч → 343 000 ₽ */

export function calculate({ employees, requests, minutes, rate }) {
  const hours = (employees * requests * minutes / 60) * WORKING_DAYS_PER_MONTH;
  const productive = hours * PRODUCTIVE_SHARE;
  const money = productive * rate;
  return {
    hours,
    productive,
    fte: hours / HOURS_PER_FTE,
    money,
    year: money * MONTHS_PER_YEAR,
  };
}

const NBSP = " ";
const int = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
// Intl ставит узкий неразрывный пробел (U+202F) — заменяем на обычный неразрывный
const fmt = (f, n) => f.format(n).replace(/[ \s]/g, NBSP);
const rub = (n) => `${fmt(int, Math.round(n / 100) * 100)}${NBSP}₽`;

const root = document.querySelector("[data-calc]");

if (root) {
  const out = Object.fromEntries([...root.querySelectorAll("[data-out]")].map((n) => [n.dataset.out, n]));
  const numbers = [...root.querySelectorAll(".field-range__num")];
  const sliderFor = (num) => root.querySelector(`[data-for="${num.id}"]`);

  const clamp = (num, v) => {
    const min = Number(num.min);
    const max = Number(num.max);
    const step = Number(num.step);
    if (!Number.isFinite(v)) return Number(num.defaultValue);
    v = Math.min(max, Math.max(min, v));
    return Math.round(v / step) * step;
  };

  const paintSlider = (slider) => {
    const p = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty("--p", `${p}%`);
  };

  const read = () => {
    const v = {};
    numbers.forEach((n) => { v[n.name] = clamp(n, parseFloat(String(n.value).replace(",", "."))); });
    return v;
  };

  const render = () => {
    const r = calculate(read());
    out.money.textContent = rub(r.money);
    out.year.textContent = rub(r.year);
    out.hours.textContent = `${fmt(int, r.hours)}${NBSP}ч`;
    out.productive.textContent = `${fmt(int, r.productive)}${NBSP}ч`;
    out.fte.textContent = fmt(one, r.fte);
  };

  numbers.forEach((num) => {
    const slider = sliderFor(num);
    paintSlider(slider);

    slider.addEventListener("input", () => {
      num.value = slider.value;
      paintSlider(slider);
      render();
    });

    num.addEventListener("input", () => {
      const v = parseFloat(String(num.value).replace(",", "."));
      if (Number.isFinite(v)) {
        slider.value = clamp(num, v);
        paintSlider(slider);
      }
      render();
    });

    // при уходе с поля приводим значение к диапазону
    num.addEventListener("change", () => {
      const v = clamp(num, parseFloat(String(num.value).replace(",", ".")));
      num.value = v;
      slider.value = v;
      paintSlider(slider);
      render();
    });
  });

  root.querySelector("[data-calc-form]").addEventListener("submit", (e) => e.preventDefault());
  render();
}
