#!/usr/bin/env python3
"""
Веб-сервер для отображения архитектуры сервера
"""

from flask import Flask, render_template, jsonify
from app_collector import AppCollector
import threading
import time
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = 'app-visualizer-secret-key'

# Кэш для данных
cache_lock = threading.Lock()
cached_data = None
cache_timestamp = 0
CACHE_TTL = 10  # Время жизни кэша в секундах (уменьшено для более актуальных данных)

def get_app_data():
    """Получить данные о приложениях (с кэшированием)"""
    global cached_data, cache_timestamp
    
    current_time = time.time()
    
    with cache_lock:
        # Проверяем кэш
        if cached_data and (current_time - cache_timestamp) < CACHE_TTL:
            return cached_data
        
        # Обновляем кэш
        try:
            collector = AppCollector()
            cached_data = collector.collect_all()
            cache_timestamp = current_time
        except Exception as e:
            print(f"Ошибка при сборе данных: {e}")
            if cached_data is None:
                cached_data = {'error': str(e), 'applications': [], 'host_ip': '127.0.0.1'}
    
    return cached_data

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')

@app.route('/api/apps')
def get_apps():
    """API endpoint для получения данных о приложениях"""
    data = get_app_data()
    return jsonify(data)

@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

@app.route('/api/domains')
def get_domains():
    """API endpoint для получения списка доменов"""
    try:
        from domains_config import get_all_domains
        return jsonify(get_all_domains())
    except ImportError:
        return jsonify({'active': [], 'planned': []})

if __name__ == '__main__':
    # Проверяем наличие Flask
    try:
        import flask
    except ImportError:
        print("ОШИБКА: Flask не установлен!")
        print("Установите Flask одним из способов:")
        print("1. python3 -m pip install --user --break-system-packages Flask")
        print("2. Или используйте виртуальное окружение: python3 -m venv venv && source venv/bin/activate && pip install Flask")
        exit(1)
    
    # Предзагрузка данных
    get_app_data()
    
    host_ip = get_app_data().get('host_ip', 'localhost')
    print(f"Запуск сервера на http://0.0.0.0:5050")
    print(f"Откройте в браузере: http://{host_ip}:5050")
    
    app.run(host='0.0.0.0', port=5050, debug=False)
