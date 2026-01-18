#!/bin/bash
# Скрипт запуска приложения

cd "$(dirname "$0")"

# Проверяем виртуальное окружение
if [ -d "venv" ]; then
    source venv/bin/activate
    python3 app.py
    deactivate
else
    # Пробуем запустить напрямую
    python3 app.py
fi
