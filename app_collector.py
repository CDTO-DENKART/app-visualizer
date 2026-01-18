#!/usr/bin/env python3
"""
Модуль для сбора информации о приложениях на хост-сервере и в виртуальных машинах
"""

import subprocess
import json
import re
import urllib.request
import urllib.error
from typing import Dict, List, Any

# Импорт конфигурации доменов
try:
    from domains_config import get_domains_for_app, get_all_domains
except ImportError:
    # Если модуль не найден, создаем заглушки
    def get_domains_for_app(app_name=None, container_name=None):
        return []
    def get_all_domains():
        return {'active': [], 'planned': []}

class AppCollector:
    def __init__(self):
        self.host_ip = self._get_host_ip()
        
    def _get_host_ip(self) -> str:
        """Получить основной IP адрес хоста"""
        try:
            result = subprocess.run(['hostname', '-I'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                ips = result.stdout.strip().split()
                # Ищем IP в приватной сети
                for ip in ips:
                    if ip.startswith('192.168.') or ip.startswith('10.'):
                        return ip
                return ips[0] if ips else '127.0.0.1'
        except Exception:
            pass
        return '127.0.0.1'
    
    def _run_command(self, cmd: str, timeout: int = 10) -> str:
        """Выполнить команду и вернуть результат"""
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=timeout
            )
            return result.stdout.strip() if result.returncode == 0 else ""
        except Exception:
            return ""
    
    def _check_url_availability(self, url: str, timeout: int = 3) -> bool:
        """Проверить доступность URL"""
        if not url:
            return False
        
        try:
            # Удаляем префикс ssh:// если есть
            if url.startswith('ssh://'):
                return False  # SSH не проверяем через HTTP
            
            # Делаем HEAD запрос для проверки доступности
            req = urllib.request.Request(url, method='HEAD')
            req.add_header('User-Agent', 'Mozilla/5.0')
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.status in [200, 301, 302, 303, 307, 308]
        except (urllib.error.URLError, urllib.error.HTTPError, Exception):
            return False
    
    def _generate_recommended_url(self, app: Dict[str, Any]) -> str:
        """Генерирует рекомендуемый URL на основе данных приложения"""
        host_ip = app.get('host_ip', self.host_ip)
        port = app.get('port')
        protocol = app.get('protocol', 'http')
        
        if port:
            if protocol == 'ssh':
                return f"ssh://{host_ip}:{port}"
            elif protocol == 'https':
                return f"https://{host_ip}:{port}"
            else:
                return f"http://{host_ip}:{port}"
        
        return None
    
    def collect_docker_apps(self) -> List[Dict[str, Any]]:
        """Собрать информацию о Docker контейнерах"""
        apps = []
        
        # Получаем список контейнеров
        docker_ps = self._run_command('docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}|{{.Status}}"')
        
        for line in docker_ps.split('\n'):
            if not line.strip():
                continue
                
            parts = line.split('|')
            if len(parts) < 4:
                continue
                
            name, image, ports, status = parts[0], parts[1], parts[2], parts[3]
            
            # Парсим порты
            port_mappings = []
            port_pattern = r'(\d+\.\d+\.\d+\.\d+)?:(\d+)->(\d+)/tcp'
            matches = re.findall(port_pattern, ports)
            for match in matches:
                host_ip_part, host_port, container_port = match
                host_ip = host_ip_part if host_ip_part else '0.0.0.0'
                port_mappings.append({
                    'host_port': host_port,
                    'container_port': container_port,
                    'protocol': 'tcp'
                })
            
            # Получаем внутренний IP
            internal_ip = self._run_command(f'docker inspect --format "{{{{range .NetworkSettings.Networks}}}}{{{{.IPAddress}}}}{{{{end}}}}" {name}')
            
            # Определяем тип приложения по имени/образу
            app_type = self._detect_app_type(name, image)
            
            # Формируем URL на основе портов
            url = None
            if port_mappings:
                first_port = port_mappings[0].get('host_port')
                if first_port:
                    url = f'http://{self.host_ip}:{first_port}'
            
            app_info = {
                'name': name,
                'type': 'docker',
                'container_type': 'Docker',
                'image': image,
                'status': 'running' if 'Up' in status else 'stopped',
                'internal_ip': internal_ip if internal_ip else None,
                'port_mappings': port_mappings,
                'host_ip': self.host_ip,
                'port': port_mappings[0].get('host_port') if port_mappings else None,
                'protocol': 'http',
                'url': url,
                'app_type': app_type,
                'description': self._get_app_description(name, image)
            }
            
            apps.append(app_info)
            
        return apps
    
    def _detect_app_type(self, name: str, image: str) -> str:
        """Определить тип приложения"""
        name_lower = name.lower()
        image_lower = image.lower()
        
        if 'grafana' in name_lower or 'grafana' in image_lower:
            return 'Мониторинг'
        elif 'prometheus' in name_lower or 'prometheus' in image_lower:
            return 'Мониторинг'
        elif 'portainer' in name_lower or 'portainer' in image_lower:
            return 'Управление'
        elif 'exporter' in name_lower:
            return 'Экспорт метрик'
        else:
            return 'Приложение'
    
    def _get_app_description(self, name: str, image: str) -> str:
        """Получить описание приложения"""
        descriptions = {
            'grafana': 'Мониторинг и визуализация метрик',
            'prometheus': 'Система мониторинга и сбора метрик',
            'portainer': 'Управление Docker контейнерами',
            'node-exporter': 'Экспорт метрик системы',
        }
        
        name_lower = name.lower()
        for key, desc in descriptions.items():
            if key in name_lower:
                return desc
        return 'Приложение в Docker контейнере'
    
    def collect_lxd_apps(self) -> List[Dict[str, Any]]:
        """Собрать информацию о LXD контейнерах и их приложениях"""
        apps = []
        
        # Получаем список контейнеров
        lxc_list = self._run_command('lxc list --format json')
        if not lxc_list:
            return apps
            
        try:
            containers_data = json.loads(lxc_list)
        except json.JSONDecodeError:
            return apps
        
        for container in containers_data:
            container_name = container.get('name', '')
            status_raw = container.get('status', '')
            status = status_raw.lower().strip() if status_raw else 'stopped'
            
            # Получаем сетевую информацию для всех контейнеров
            container_info = self._run_command(f'lxc info {container_name}')
            # Ищем IPv4 адрес (приоритет IPv4 над IPv6)
            ipv4_match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', container_info)
            ipv4 = ipv4_match.group(1) if ipv4_match else None
            # Если IPv4 нет, пытаемся получить из lxc list
            if not ipv4:
                ipv4_raw = container.get('ipv4', '')
                if ipv4_raw and isinstance(ipv4_raw, str):
                    # lxc list может вернуть несколько IP через пробел или запятую
                    ipv4_candidates = re.findall(r'\d+\.\d+\.\d+\.\d+', ipv4_raw)
                    ipv4 = ipv4_candidates[0] if ipv4_candidates else None
            
            # Ищем IPv6 адрес как fallback
            ipv6_match = re.search(r'fd42:[0-9a-f:]+', container_info)
            ipv6 = ipv6_match.group(0) if ipv6_match else None
            
            # Используем IPv4 если есть, иначе IPv6
            container_ip = ipv4 if ipv4 else ipv6
            
            # Определяем статус - используем status_code или status
            status_code = container.get('status_code', 0)
            is_running = (status == 'running' or status_code == 103)
            
            if is_running:
                # Получаем информацию о приложениях внутри контейнера
                container_apps = self._collect_container_apps(container_name)
                
                # Если есть приложения - добавляем их
                if container_apps:
                    apps.extend(container_apps)
                else:
                    # Контейнер запущен, но приложений не обнаружено - показываем сам контейнер
                    apps.append({
                        'name': container_name,
                        'type': 'lxd',
                        'container_type': 'LXD контейнер',
                        'container_name': container_name,
                        'status': 'running',
                        'host_ip': self.host_ip,
                        'internal_ip': container_ip,
                        'description': f'Запущенный LXD контейнер: {container_name} (приложения не обнаружены)'
                    })
            else:
                # Добавляем остановленный контейнер
                apps.append({
                    'name': container_name,
                    'type': 'lxd',
                    'container_type': 'LXD контейнер',
                    'container_name': container_name,
                    'status': 'stopped',
                    'host_ip': self.host_ip,
                    'description': f'Остановленный LXD контейнер: {container_name}'
                })
        
        return apps
    
    def _collect_container_apps(self, container_name: str) -> List[Dict[str, Any]]:
        """Собрать информацию о приложениях внутри контейнера"""
        apps = []
        
        # Получаем открытые порты в контейнере
        ports_info = self._run_command(f'lxc exec {container_name} -- ss -tlnp 2>/dev/null')
        
        # Получаем сетевую информацию
        container_info = self._run_command(f'lxc info {container_name}')
        # Ищем IPv4 адрес (приоритет IPv4 над IPv6)
        ipv4_match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', container_info)
        ipv4 = ipv4_match.group(1) if ipv4_match else None
        
        # Ищем IPv6 адрес как fallback
        ipv6_match = re.search(r'fd42:[0-9a-f:]+', container_info)
        ipv6 = ipv6_match.group(0) if ipv6_match else None
        
        # Используем IPv4 если есть, иначе IPv6
        container_ip = ipv4 if ipv4 else ipv6
        
        # Парсим порты
        ports = {}
        for line in ports_info.split('\n'):
            if 'LISTEN' in line and ':' in line:
                port_match = re.search(r':(\d+)', line)
                if port_match:
                    port = port_match.group(1)
                    if 'nginx' in line.lower():
                        ports[port] = 'nginx'
                    elif 'python' in line.lower():
                        ports[port] = 'python'
                    elif 'node' in line.lower():
                        ports[port] = 'node'
        
        # Проверяем проброшенные порты через LXD proxy
        proxy_devices_raw = self._run_command(f'lxc config device list {container_name}')
        proxy_devices = proxy_devices_raw.split('\n') if proxy_devices_raw else []
        
        # Проверяем все proxy устройства
        for device in proxy_devices:
            device = device.strip()
            if not device:
                continue
                
            # Получаем информацию об устройстве
            device_type = self._run_command(f'lxc config device get {container_name} {device} type')
            if device_type and 'proxy' in device_type.lower():
                listen_info = self._run_command(f'lxc config device get {container_name} {device} listen')
                connect_info = self._run_command(f'lxc config device get {container_name} {device} connect')
                
                # Парсим порт из listen (формат: tcp:0.0.0.0:443 или tcp:*:443)
                port_match = re.search(r':(\d+)$', listen_info)
                if port_match:
                    port = port_match.group(1)
                    protocol = 'https' if device == 'https' or port == '443' else 'http'
                    
                    internal_port_val = (re.search(r':(\d+)$', connect_info).group(1) if connect_info and ':' in connect_info and re.search(r':(\d+)$', connect_info) else port)
                    apps.append({
                        'name': f'{container_name} - {device.upper()} Proxy',
                        'type': 'lxd',
                        'container_type': 'LXD контейнер',
                        'container_name': container_name,
                        'status': 'running',
                        'host_ip': self.host_ip,
                        'port': port,
                        'protocol': protocol,
                        'url': f'{protocol}://{self.host_ip}:{port}',
                        'internal_port': internal_port_val,
                        'internal_ip': container_ip,
                        'app_type': 'Веб-сервер',
                        'description': f'Проброшенный {protocol.upper()} порт {port} в контейнере {container_name}',
                        'proxy_listen': listen_info,
                        'proxy_connect': connect_info
                    })
        
        # Nginx на порту 80 (проброшен через http)
        if 'http' in proxy_devices_raw:
            listen_info = self._run_command(f'lxc config device get {container_name} http listen')
            if '80' in listen_info:
                apps.append({
                    'name': f'{container_name} - Nginx',
                    'type': 'lxd',
                    'container_type': 'LXD контейнер',
                    'container_name': container_name,
                    'status': 'running',
                    'host_ip': self.host_ip,
                    'port': '80',
                    'protocol': 'http',
                    'url': f'http://{self.host_ip}:80',
                    'internal_port': '80',
                    'internal_ip': container_ip,
                    'app_type': 'Веб-сервер',
                    'description': f'Nginx веб-сервер в контейнере {container_name}'
                })
        
        # Python приложение на порту 8090 (внутреннее)
        if '8090' in ports_info:
            apps.append({
                'name': f'{container_name} - DENKART Docs',
                'type': 'lxd',
                'container_type': 'LXD контейнер',
                'container_name': container_name,
                'status': 'running',
                'host_ip': self.host_ip,
                'port': '8090',
                'protocol': 'http',
                'url': f'http://{container_ip}:8090' if container_ip else None,
                'internal_port': '8090',
                'internal_ip': container_ip,
                'internal_only': True,
                'app_type': 'Документация',
                'description': 'DENKART - База знаний (доступен только внутри контейнера)'
            })
        
        return apps
    
    def collect_host_services(self) -> List[Dict[str, Any]]:
        """Собрать информацию о системных сервисах хоста"""
        services = []
        
        # LXD API
        lxd_api_check = self._run_command('ss -tlnp | grep ":8443"')
        if lxd_api_check:
            services.append({
                'name': 'LXD API',
                'type': 'host',
                'container_type': 'Системный сервис',
                'status': 'running',
                'host_ip': self.host_ip,
                'port': '8443',
                'protocol': 'https',
                'url': f'https://{self.host_ip}:8443',
                'app_type': 'API',
                'description': 'LXD API для управления контейнерами'
            })
        
        # SSH
        ssh_check = self._run_command('ss -tlnp | grep ":22"')
        if ssh_check:
            services.append({
                'name': 'SSH Server',
                'type': 'host',
                'container_type': 'Системный сервис',
                'status': 'running',
                'host_ip': self.host_ip,
                'port': '22',
                'protocol': 'ssh',
                'url': f'ssh://{self.host_ip}:22',
                'app_type': 'Система',
                'description': 'SSH сервер для удаленного доступа'
            })
        
        return services
    
    def _add_url_info(self, apps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Добавить информацию о URL и доступности для всех приложений"""
        for app in apps:
            # Добавляем информацию о доменах
            app_name = app.get('name', '').lower()
            container_name = app.get('container_name', '').lower()
            
            # Ищем домены для приложения
            if container_name:
                domains = get_domains_for_app(None, container_name)
            else:
                search_name = app_name.split(' - ')[0] if app_name else ''
                domains = get_domains_for_app(search_name, None)
            
            if domains:
                app['domains'] = domains
            
            # Если URL нет, генерируем рекомендуемый
            if not app.get('url'):
                recommended_url = self._generate_recommended_url(app)
                if recommended_url:
                    app['url'] = recommended_url
                    app['url_recommended'] = True
                else:
                    app['url_recommended'] = False
            
            # Проверяем доступность URL с детальной информацией
            url = app.get('url')
            if url:
                if url.startswith('ssh://'):
                    # SSH не проверяем через HTTP
                    app['url_available'] = None
                    app['url_check'] = {'available': None, 'error': 'SSH протокол'}
                elif app.get('status') == 'running':
                    # Проверяем доступность только для запущенных приложений
                    check_result = self._check_url_availability(url)
                    app['url_available'] = check_result['available']
                    app['url_check'] = check_result
                else:
                    app['url_available'] = False
                    app['url_check'] = {'available': False, 'error': 'Приложение остановлено'}
            else:
                app['url_available'] = None
                app['url_check'] = {'available': None, 'error': 'URL не настроен'}
            
            # Добавляем информацию о маршрутизации после добавления всех данных
            routing_info = self._get_routing_info(app)
            if any(routing_info.values()):
                app['routing'] = routing_info
        
        return apps
    
    def collect_all(self) -> Dict[str, Any]:
        """Собрать всю информацию о приложениях"""
        result = {
            'host_ip': self.host_ip,
            'applications': [],
            'statistics': {
                'total': 0,
                'running': 0,
                'stopped': 0,
                'docker': 0,
                'lxd': 0,
                'host': 0
            }
        }
        
        # Собираем все типы приложений
        docker_apps = self.collect_docker_apps()
        lxd_apps = self.collect_lxd_apps()
        host_services = self.collect_host_services()
        
        all_apps = docker_apps + lxd_apps + host_services
        
        # Добавляем информацию о URL и доступности
        all_apps = self._add_url_info(all_apps)
        
        # Обновляем статистику
        result['statistics']['total'] = len(all_apps)
        result['statistics']['docker'] = len(docker_apps)
        result['statistics']['lxd'] = len([a for a in lxd_apps if a.get('status') == 'running'])
        result['statistics']['host'] = len(host_services)
        result['statistics']['running'] = len([a for a in all_apps if a.get('status') == 'running'])
        result['statistics']['stopped'] = len([a for a in all_apps if a.get('status') == 'stopped'])
        
        result['applications'] = all_apps
        
        return result

if __name__ == '__main__':
    collector = AppCollector()
    data = collector.collect_all()
    print(json.dumps(data, indent=2, ensure_ascii=False))
