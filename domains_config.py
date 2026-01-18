#!/usr/bin/env python3
"""
Конфигурация доменов сервера
"""

DOMAINS_CONFIG = {
    # Активные домены
    'active': [
        {
            'domain': 'denkart.cdto.life',
            'container_name': 'docs-denkart',
            'description': 'Интерфейс управления хостингом (Cockpit)'
        },
        {
            'domain': 'docs.cdto.life',
            'container_name': 'docs-denkart',
            'description': 'Документация проекта DENKART'
        },
        {
            'domain': 'school.cdto.life',
            'container_name': 'BBB-CONT22-1',
            'description': 'BigBlueButton (система веб-конференций)'
        }
    ],
    # Запланированные домены
    'planned': [
        {
            'domain': 'denkart.cdto.group',
            'container_name': 'docs-denkart',
            'description': 'Cockpit (замена denkart.cdto.life)'
        },
        {
            'domain': 'docs.cdto.group',
            'container_name': 'docs-denkart',
            'description': 'Документация (замена docs.cdto.life)'
        },
        {
            'domain': 'stat.cdto.group',
            'app_name': 'grafana',
            'description': 'Мониторинг (Grafana/Prometheus)'
        },
        {
            'domain': 'dev.cdto.group',
            'description': '1C-dev контейнер'
        },
        {
            'domain': 'erp.cdto.group',
            'description': '1C-erp контейнер'
        },
        {
            'domain': 'cms.cdto.group',
            'description': 'CMS система'
        },
        {
            'domain': 'crm.cdto.group',
            'description': 'CRM система'
        },
        {
            'domain': 'dev.cdto.life',
            'container_name': 'BBB-CONT22-1',
            'description': 'Dev версия BigBlueButton'
        }
    ]
}

def get_domains_for_app(app_name: str = None, container_name: str = None) -> list:
    """Получить список доменов для приложения"""
    domains = []
    app_name_lower = (app_name or '').lower()
    container_name_lower = (container_name or '').lower()
    
    for domain_type in ['active', 'planned']:
        for domain_info in DOMAINS_CONFIG[domain_type]:
            domain_container = domain_info.get('container_name', '').lower()
            domain_app = domain_info.get('app_name', '').lower()
            
            # Проверяем по контейнеру (приоритет)
            if container_name_lower and domain_container and domain_container in container_name_lower:
                domains.append({**domain_info, 'status': domain_type == 'active' and 'active' or 'planned'})
            # Проверяем по имени приложения
            elif app_name_lower and domain_app and domain_app in app_name_lower:
                domains.append({**domain_info, 'status': domain_type == 'active' and 'active' or 'planned'})
    
    return domains

def get_all_domains() -> dict:
    """Получить все домены"""
    return DOMAINS_CONFIG
