// Форма «Обсудить пилот» — заглушка. Данные никуда не отправляются.
//
// ВНИМАНИЕ: если подключите реальную отправку, до публикации нужны
// политика обработки персональных данных и чекбокс согласия (152-ФЗ). См. README.md.

const form = document.querySelector("[data-pilot-form]");
const done = document.querySelector("[data-form-done]");

const MESSAGES = {
  name: "Напишите, как к вам обращаться",
  company: "Укажите название компании",
  role: "Укажите вашу должность",
  contactEmpty: "Оставьте e-mail или Telegram, чтобы мы могли ответить",
  contactBad: "Похоже на опечатку. Пример: name@company.ru или @username",
  size: "Выберите число сотрудников",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEGRAM = /^(@|https?:\/\/t\.me\/|t\.me\/)?[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

function check(field) {
  const v = field.value.trim();
  switch (field.name) {
    case "name":
    case "company":
    case "role":
      return v.length >= 2 ? "" : MESSAGES[field.name];
    case "contact":
      if (!v) return MESSAGES.contactEmpty;
      return EMAIL.test(v) || TELEGRAM.test(v) ? "" : MESSAGES.contactBad;
    case "size":
      return v ? "" : MESSAGES.size;
    default:
      return "";
  }
}

function show(field, message) {
  const err = document.getElementById(`${field.id}-err`);
  if (!err) return;
  err.textContent = message;
  err.hidden = !message;
  if (message) field.setAttribute("aria-invalid", "true");
  else field.removeAttribute("aria-invalid");
}

if (form) {
  const fields = [...form.querySelectorAll("input[required], select[required]")];
  const submit = form.querySelector("[data-submit]");
  submit.disabled = false;

  fields.forEach((f) => {
    f.addEventListener("blur", () => { if (f.value.trim()) show(f, check(f)); });
    f.addEventListener("input", () => { if (f.getAttribute("aria-invalid")) show(f, check(f)); });
    f.addEventListener("change", () => { if (f.tagName === "SELECT") show(f, check(f)); });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let firstBad = null;
    fields.forEach((f) => {
      const msg = check(f);
      show(f, msg);
      if (msg && !firstBad) firstBad = f;
    });
    if (firstBad) {
      firstBad.focus();
      return;
    }
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });
}
