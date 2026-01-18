#!/bin/bash
# Скрипт для запуска приложения и открытия в браузере Chrome

cd "$(dirname "$0")"

HOST_IP=$(hostname -I | awk '{print $1}')
URL="http://${HOST_IP}:5050"

# Проверяем, запущен ли сервер
if ! ss -tlnp | grep -q ":5050"; then
    echo "Запуск сервера..."
    # Запускаем сервер в фоне
    if [ -d "venv" ]; then
        source venv/bin/activate
        nohup python3 app.py > /dev/null 2>&1 &
        deactivate
    else
        nohup python3 app.py > /dev/null 2>&1 &
    fi
    
    # Ждем запуска сервера (максимум 10 секунд)
    for i in {1..10}; do
        sleep 1
        if curl -s http://localhost:5050/api/health > /dev/null 2>&1; then
            break
        fi
    done
fi

# Определяем путь к Chrome
if [ -f "/usr/bin/google-chrome" ]; then
    CHROME_CMD="/usr/bin/google-chrome"
elif command -v google-chrome > /dev/null 2>&1; then
    CHROME_CMD="google-chrome"
elif command -v chromium-browser > /dev/null 2>&1; then
    CHROME_CMD="chromium-browser"
elif command -v chromium > /dev/null 2>&1; then
    CHROME_CMD="chromium"
else
    # Если Chrome не найден, используем xdg-open (откроет браузер по умолчанию)
    xdg-open "$URL" 2>/dev/null &
    exit 0
fi

# Открываем в Chrome
"$CHROME_CMD" "$URL" > /dev/null 2>&1 &
