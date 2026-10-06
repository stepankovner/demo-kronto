// Настройки, которые меняются при переезде.

// API, который принимает заявки на созвон (POST /api/v1/leads).
// Когда появится боевой сервер — поменять адрес здесь и в CSP
// (index.html, <meta http-equiv="Content-Security-Policy"> и
// deploy/kronto-site.conf).
export const API_BASE = "https://stage.krontoai.ru";

export const CONTACTS = {
  email: "info@krontoai.ru",
  telegram: "stukalich",
};

// Если API не ответил: те же правила, что на сервере (domain/leads.py)
export const FALLBACK_FORM = {
  slots: ["10:00–12:00", "12:00–14:00", "14:00–16:00", "16:00–18:00"],
  daysAhead: 30,
  timezone: "Europe/Moscow",
};
