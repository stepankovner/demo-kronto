# Как выложить сайт на сервер

Инструкция для сервера на Ubuntu 22.04 или 24.04, если вы делаете это впервые. Понадобятся:

- сервер с доступом по SSH (пользователь с правами `sudo`);
- домен, у которого A-запись указывает на IP сервера. Нужны две записи: `домен.ru` и `www.домен.ru`. Проверить можно командой `dig +short домен.ru`: в ответе должен быть IP сервера.

Ниже вместо `домен.ru` подставляйте свой домен, вместо `user@IP` — своего пользователя и адрес сервера.

---

## 1. Подготовить файлы

На своём компьютере:

1. Заполните плейсхолдеры по списку в `README.md`, раздел «Что заполнить перед публикацией».
2. В `deploy/nginx.conf` замените все `[домен]` на ваш домен:
   ```bash
   sed -i '' 's/\[домен\]/домен.ru/g' deploy/nginx.conf      # macOS
   sed -i 's/\[домен\]/домен.ru/g' deploy/nginx.conf         # Linux
   ```
3. В `deploy/deploy.sh` заполните `SERVER_USER` и `SERVER_HOST`.

## 2. Установить nginx на сервер

```bash
ssh user@IP
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

Если включён файрвол `ufw`, откройте порты 80 и 443:

```bash
sudo ufw allow 'Nginx Full'
```

Проверка: откройте `http://IP` в браузере. Должна появиться страница «Welcome to nginx».

## 3. Создать папку сайта

```bash
sudo mkdir -p /var/www/kronto
sudo chown -R $USER:$USER /var/www/kronto
```

## 4. Скопировать файлы

С вашего компьютера, из папки `kronto-landing`:

```bash
./deploy/deploy.sh
```

Скрипт копирует сайт через `rsync`: папку `deploy` и `.md`-файлы на сервер он не отправляет. Повторный запуск обновляет сайт, а удалённые у вас файлы удаляет и на сервере.

## 5. Подключить конфигурацию nginx

Скопируйте два файла конфигурации на сервер:

```bash
scp deploy/nginx.conf user@IP:/tmp/kronto.conf
scp deploy/kronto-site.conf user@IP:/tmp/kronto-site.conf
```

На сервере:

```bash
sudo mv /tmp/kronto-site.conf /etc/nginx/snippets/kronto-site.conf
sudo mv /tmp/kronto.conf /etc/nginx/sites-available/kronto
sudo ln -s /etc/nginx/sites-available/kronto /etc/nginx/sites-enabled/kronto
sudo rm -f /etc/nginx/sites-enabled/default      # отключаем стандартную страницу
sudo nginx -t                                    # проверка конфигурации
sudo systemctl reload nginx
```

`nginx -t` должен ответить `syntax is ok` и `test is successful`. Если он пишет ошибку, в ней указаны файл и строка. Пока ошибка не исправлена, `reload` не делайте.

Проверка: `http://домен.ru` открывает сайт.

## 6. Выпустить сертификат Let's Encrypt (HTTPS)

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/kronto -d домен.ru -d www.домен.ru
```

Certbot попросит e-mail для уведомлений и согласие с условиями. При успехе он напишет, что сертификат сохранён в `/etc/letsencrypt/live/домен.ru/`.

Теперь включите HTTPS:

```bash
sudo nano /etc/nginx/sites-available/kronto
```

1. Закомментируйте блок **ЭТАП 1**: поставьте `#` в начале каждой строки блока `server { ... }`.
2. Раскомментируйте три блока **ЭТАП 2**: уберите `# ` в начале строк. Строку про HSTS пока оставьте закомментированной.
3. Сохраните (Ctrl+O, Enter, Ctrl+X) и проверьте:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Сертификат действует 90 дней, certbot продлевает его сам. Проверить автопродление:

```bash
sudo certbot renew --dry-run
```

После продления nginx нужно перезагрузить. Добавьте хук один раз:

```bash
echo 'systemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

## 7. Проверить по чек-листу

- [ ] `https://домен.ru` открывается, в адресной строке замок.
- [ ] `http://домен.ru` перенаправляет на `https://домен.ru`.
- [ ] `https://www.домен.ru` и `http://www.домен.ru` перенаправляют на `https://домен.ru`.
- [ ] `https://домен.ru/несуществующая-страница` показывает страницу 404 в стиле сайта.
- [ ] Заголовки на месте:
  ```bash
  curl -sI https://домен.ru | grep -iE "cache-control|content-security|x-content"
  ```
  Для `index.html` должно быть `Cache-Control: no-cache`, для `/assets/...` — `max-age=31536000, immutable`.
- [ ] В браузере (F12 → Console) нет ошибок, а во вкладке Network нет запросов на чужие домены.
- [ ] Превью в Telegram: отправьте ссылку себе в «Избранное». Должны появиться картинка, заголовок и описание. Если превью старое или пустое, напишите боту [@WebpageBot](https://t.me/WebpageBot) ссылку на сайт — он обновит кэш превью.

## Как обновлять сайт

1. Поправьте файлы у себя.
2. Если меняли CSS, JS или картинки, увеличьте `?v=` в `index.html` (см. `README.md`).
3. Запустите `./deploy/deploy.sh`.

Перезагружать nginx не нужно: он отдаёт новые файлы сразу.
