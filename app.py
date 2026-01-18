#!/usr/bin/env python3
"""
Веб-сервер для отображения архитектуры сервера
"""

from flask import Flask, render_template, jsonify, request
from app_collector import AppCollector
import threading
import time
import json
import subprocess
import os
from pathlib import Path

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

@app.route('/api/test/run', methods=['POST'])
def run_test():
    """API endpoint для запуска тестов"""
    try:
        # Проверяем, что данные JSON получены
        if not request.is_json:
            return jsonify({'error': 'Ожидается JSON данные'}), 400
        
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Неверный формат JSON данных'}), 400
        
        test_command = data.get('command')
        test_label = data.get('label', 'Тест')
        
        if not test_command:
            return jsonify({'error': 'Команда не указана'}), 400
        
        # Разбираем команду для выполнения
        # Команды типа: cd /path && python3 script.py
        if '&&' in test_command:
            parts = [p.strip() for p in test_command.split('&&')]
            cwd = None
            exec_parts = []
            
            for part in parts:
                if part.startswith('cd '):
                    # Извлекаем директорию из cd
                    cwd = part[3:].strip().strip("'\"")
                else:
                    # Это команда для выполнения
                    exec_parts = part.split()
            
            if not exec_parts:
                return jsonify({'error': 'Не найдена команда для выполнения'}), 400
            
            # Если команда относительная и указан cwd, проверяем путь
            if cwd and exec_parts[0] and not Path(exec_parts[0]).is_absolute():
                # Проверяем, что путь существует в указанной директории
                full_path = Path(cwd) / exec_parts[0]
                if full_path.exists():
                    exec_parts[0] = str(full_path)
            
            cmd = exec_parts
            
        else:
            # Простая команда без cd
            cmd = test_command.split()
            cwd = None
        
        # Проверяем существование рабочей директории
        if cwd and not Path(cwd).exists():
            return jsonify({'error': f'Директория не найдена: {cwd}'}), 400
        
        # Проверяем существование скрипта
        if cmd and len(cmd) > 0:
            script_path = Path(cmd[0])
            if not script_path.is_absolute() and cwd:
                script_path = Path(cwd) / script_path
            
            if not script_path.exists():
                return jsonify({'error': f'Скрипт не найден: {script_path}'}), 400
        
        # Запускаем тест в фоновом режиме
        try:
            process = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                start_new_session=True  # Запускаем в новой сессии
            )
            
            # Возвращаем PID процесса
            return jsonify({
                'success': True,
                'message': f'Тест "{test_label}" запущен',
                'pid': process.pid,
                'command': test_command
            })
        except FileNotFoundError as e:
            return jsonify({'error': f'Команда или файл не найдены: {cmd[0] if cmd else "неизвестно"}'}), 400
        except Exception as e:
            return jsonify({'error': f'Ошибка запуска: {str(e)}'}), 500
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Ошибка в run_test: {error_details}")  # Логируем для отладки
        return jsonify({'error': f'Ошибка: {str(e)}'}), 500

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
