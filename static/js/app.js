let network = null;
let nodes = null;
let edges = null;
let allAppsData = [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, что vis-network загружен
    if (typeof vis === 'undefined' || !vis.Network || !vis.DataSet) {
        console.error('vis-network не загружен!');
        const statEl = document.getElementById('stat-total');
        if (statEl) {
            statEl.innerHTML = '<span style="color: #dc3545;">Ошибка: библиотека vis-network не загружена</span>';
        }
        const container = document.getElementById('network-container');
        if (container) {
            container.innerHTML = '<div style="padding: 40px; text-align: center; color: #dc3545;"><h3>Ошибка загрузки библиотеки</h3><p>Библиотека vis-network не загружена. Проверьте подключение к интернету.</p></div>';
        }
        return;
    }
    
    // Проверяем, что контейнер существует
    const container = document.getElementById('network-container');
    if (!container) {
        console.error('Контейнер network-container не найден в DOM');
        return;
    }
    
    try {
        initNetwork();
        loadData();
        loadDomains();
        setInterval(loadData, 60000); // Обновление каждую минуту
        setInterval(loadDomains, 60000); // Обновление доменов каждую минуту
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        const statEl = document.getElementById('stat-total');
        if (statEl) {
            statEl.innerHTML = `<span style="color: #dc3545;">Ошибка инициализации: ${error.message}</span>`;
        }
        if (container) {
            container.innerHTML = `<div style="padding: 40px; text-align: center; color: #dc3545;"><h3>Ошибка инициализации</h3><p>${error.message}</p><pre>${error.stack}</pre></div>`;
        }
    }
});

function initNetwork() {
    const container = document.getElementById('network-container');
    
    if (!container) {
        console.error('initNetwork: контейнер network-container не найден');
        return;
    }
    
    if (typeof vis === 'undefined' || !vis.Network || !vis.DataSet) {
        console.error('initNetwork: vis-network не доступен');
        return;
    }
    
    try {
        nodes = new vis.DataSet();
        edges = new vis.DataSet();
    } catch (error) {
        console.error('Ошибка создания DataSet:', error);
        throw error;
    }
    
    const data = {
        nodes: nodes,
        edges: edges
    };
    
    const options = {
        nodes: {
            shape: 'box',
            font: {
                size: 12,
                face: 'Arial'
            },
            borderWidth: 2,
            shadow: true,
            margin: 15,
            widthConstraint: {
                maximum: 180
            },
            heightConstraint: {
                minimum: 80,
                maximum: 200
            },
            fixed: {
                x: false,
                y: false
            },
            chosen: {
                node: function(values) {
                    values.borderWidth = 4;
                    values.shadow = true;
                }
            }
        },
            edges: {
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 0.5
                }
            },
            color: {
                color: '#848484',
                highlight: '#667eea'
            },
            width: 2,
            smooth: {
                type: 'straight',
                roundness: 0
            },
            chosen: false,
            font: {
                align: 'top',
                size: 12,
                color: '#666',
                vadjust: -5
            },
            labelHighlightBold: false
        },
        layout: {
            hierarchical: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 400,
                nodeSpacing: 500,
                treeSpacing: 600,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
                avoidOverlap: 1.0
            }
        },
        physics: {
            enabled: true,
            hierarchicalRepulsion: {
                nodeDistance: 300,
                springLength: 400,
                springConstant: 0.005,
                damping: 0.09,
                avoidOverlap: 1.0
            },
            stabilization: {
                enabled: true,
                iterations: 2000,
                updateInterval: 25,
                fit: true,
                onlyDynamicEdges: false
            },
            solver: 'hierarchicalRepulsion',
            maxVelocity: 50,
            minVelocity: 0.75,
            timestep: 0.5
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            selectConnectedEdges: true
        }
    };
    
    try {
        network = new vis.Network(container, data, options);
        
        if (!network) {
            throw new Error('Не удалось создать vis.Network');
        }
    } catch (error) {
        console.error('Ошибка создания vis.Network:', error);
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: #dc3545;"><h3>Ошибка создания визуализации</h3><p>${error.message}</p></div>`;
        throw error;
    }
    
    // Автоматическое масштабирование после стабилизации для предотвращения перекрытий
    network.on('stabilizationEnd', function() {
        network.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            },
            nodes: undefined, // все узлы
            minZoomLevel: undefined,
            maxZoomLevel: undefined
        });
    });
    
    network.on('click', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            showAppDetails(nodeId);
        } else {
            closeDetails();
        }
    });
    
    // Обработка ошибок визуализации
    network.on('stabilizationFailed', function() {
        console.warn('Стабилизация сети не завершена');
    });
}

function loadData() {
    const statEl = document.getElementById('stat-total');
    statEl.textContent = 'Загрузка...';
    
    fetch('/api/apps')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Ожидался JSON, получен: ${contentType}. Ответ: ${text.substring(0, 200)}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data) {
                throw new Error('Пустой ответ от сервера');
            }
            
            allAppsData = data.applications || [];
            updateStats(data.statistics);
            
            if (!nodes || !edges || !network) {
                console.error('Network не инициализирован');
                statEl.textContent = 'Ошибка: Network не инициализирован';
                return;
            }
            
            updateNetwork();
            updateLastUpdate();
        })
        .catch(error => {
            console.error('Ошибка загрузки данных:', error);
            statEl.innerHTML = `<span style="color: #dc3545;">Ошибка загрузки: ${error.message}</span>`;
            
            // Показываем сообщение об ошибке в области визуализации
            const container = document.getElementById('network-container');
            if (container) {
                container.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #dc3545;">
                        <h3>Ошибка загрузки данных</h3>
                        <p>${error.message}</p>
                        <button onclick="refreshData()" style="margin-top: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Обновить
                        </button>
                    </div>
                `;
            }
        });
}

function updateStats(stats) {
    const statEl = document.getElementById('stat-total');
    if (stats) {
        statEl.innerHTML = `
            Всего: ${stats.total} | 
            Запущено: <span class="status-running">${stats.running}</span> | 
            Docker: ${stats.docker} | 
            LXD: ${stats.lxd} | 
            Хост: ${stats.host}
        `;
    }
}

function updateLastUpdate() {
    const now = new Date();
    document.getElementById('last-update').textContent = 
        `Обновлено: ${now.toLocaleTimeString('ru-RU')}`;
}

function updateFilter() {
    updateNetwork();
}

function updateNetwork() {
    const showDocker = document.getElementById('filter-docker').checked;
    const showLxd = document.getElementById('filter-lxd').checked;
    const showHost = document.getElementById('filter-host').checked;
    const onlyRunning = document.getElementById('filter-running').checked;
    
    const filteredApps = allAppsData.filter(app => {
        if (onlyRunning && app.status !== 'running') {
            return false;
        }
        if (app.type === 'docker' && !showDocker) return false;
        if (app.type === 'lxd' && !showLxd) return false;
        if (app.type === 'host' && !showHost) return false;
        return true;
    });
    
    renderNetwork(filteredApps);
}

function renderNetwork(apps) {
    // Проверяем, что network инициализирован
    if (!nodes || !edges || !network) {
        console.error('renderNetwork: Network не инициализирован');
        return;
    }
    
    // Проверяем, что apps - это массив
    if (!Array.isArray(apps)) {
        console.error('renderNetwork: apps не является массивом', apps);
        return;
    }
    
    // Получаем host_ip из данных
    let hostIp = '192.168.1.112';
    if (apps.length > 0 && apps[0].host_ip) {
        hostIp = apps[0].host_ip;
    } else if (allAppsData.length > 0 && allAppsData[0].host_ip) {
        hostIp = allAppsData[0].host_ip;
    }
    
    // Очищаем данные
    nodes.clear();
    edges.clear();
    
    // Добавляем узел хоста
    nodes.add({
        id: 'host',
        label: 'Хост-сервер\n' + hostIp,
        group: 'host',
        level: 0,
        font: { size: 16, bold: true },
        color: {
            background: '#667eea',
            border: '#5568d3'
        },
        shape: 'box',
        margin: 15
    });
    
    // Группируем приложения по типам контейнеров
    const dockerApps = apps.filter(a => a.type === 'docker');
    const lxdApps = apps.filter(a => a.type === 'lxd');
    const hostApps = apps.filter(a => a.type === 'host');
    
    let nodeId = 1;
    
    // Docker контейнеры
    if (dockerApps.length > 0) {
        dockerApps.forEach(app => {
            let nodeLabel = `${app.name}\n${app.app_type || 'Приложение'}`;
            
            // Добавляем домен, доступность и статус работоспособности
            if (app.domains && app.domains.length > 0) {
                const activeDomain = app.domains.find(d => d.status === 'active');
                if (activeDomain) {
                    // Проверяем доступность домена по URL
                    let domainStatus = '';
                    if (app.url_available === true) {
                        domainStatus = ' ✅';
                    } else if (app.url_available === false) {
                        domainStatus = ' ❌';
                    }
                    nodeLabel += `\n🌐 ${activeDomain.domain}${domainStatus}`;
                } else {
                    const plannedDomain = app.domains.find(d => d.status === 'planned');
                    if (plannedDomain) {
                        nodeLabel += `\n⏳ ${plannedDomain.domain}`;
                    }
                }
            }
            
            // Добавляем IP адрес
            if (app.internal_ip) {
                nodeLabel += `\n📡 IP: ${app.internal_ip}`;
            }
            
            // Добавляем информацию о маршрутизации
            if (app.routing) {
                if (app.routing.firewall_nat) {
                    nodeLabel += `\n🔀 FW: DNAT → ${app.routing.firewall_nat.destination}`;
                } else if (app.routing.proxy_device && app.port && app.internal_port) {
                    nodeLabel += `\n🔀 Proxy: ${app.port}→${app.internal_port}`;
                }
            } else if (app.port_mappings && app.port_mappings.length > 0) {
                const first_mapping = app.port_mappings[0];
                if (first_mapping.host_port && first_mapping.container_port) {
                    nodeLabel += `\n🔀 Port: ${first_mapping.host_port}→${first_mapping.container_port}`;
                }
            }
            
            // Добавляем признак работоспособности (статус приложения уже виден по цвету, но добавляем текстовый индикатор)
            const statusIcon = app.status === 'running' ? '✅' : '⏸';
            nodeLabel += `\n${statusIcon} ${app.status === 'running' ? 'Работает' : 'Остановлен'}`;
            
            // Определяем цвет узла с учетом статуса и доступности
            let nodeColor;
            if (app.status !== 'running') {
                nodeColor = { background: '#dc3545', border: '#c82333' }; // Остановлен - красный
            } else if (app.url_check && app.url_check.available === false) {
                nodeColor = { background: '#ff9800', border: '#f57c00' }; // Проблема доступности - оранжевый
            } else if (app.url_check && app.url_check.available === true) {
                nodeColor = { background: '#28a745', border: '#1e7e34' }; // Работает - зеленый
            } else {
                nodeColor = { background: '#28a745', border: '#1e7e34' }; // По умолчанию - зеленый
            }
            
            nodes.add({
                id: nodeId,
                label: nodeLabel,
                group: 'docker',
                level: 1,
                color: nodeColor,
                title: getTooltip(app),
                data: app
            });
            
            const edgeLabel = app.port_mappings?.map(p => `:${p.host_port}`).join(', ') || '';
            edges.add({
                from: 'host',
                to: nodeId,
                label: edgeLabel,
                font: { align: 'top' }
            });
            
            nodeId++;
        });
    }
    
    // LXD контейнеры
    if (lxdApps.length > 0) {
        const lxdGrouped = {};
        lxdApps.forEach(app => {
            const containerName = app.container_name || app.name.split(' - ')[0];
            if (!lxdGrouped[containerName]) {
                lxdGrouped[containerName] = [];
            }
            lxdGrouped[containerName].push(app);
        });
        
        Object.keys(lxdGrouped).forEach(containerName => {
            const containerApps = lxdGrouped[containerName];
            const containerId = nodeId++;
            
            // Собираем уникальные домены из всех приложений контейнера
            const containerDomains = [];
            containerApps.forEach(app => {
                if (app.domains) {
                    app.domains.forEach(d => {
                        if (!containerDomains.find(existing => existing.domain === d.domain)) {
                            containerDomains.push(d);
                        }
                    });
                }
            });
            
            // Определяем статус контейнера на основе его приложений
            const hasRunningApps = containerApps.some(a => a.status === 'running');
            const containerStatus = hasRunningApps ? 'running' : 'stopped';
            
            // Формируем подпись контейнера с доменами и статусом
            let containerLabel = `LXD: ${containerName}\nКонтейнер`;
            if (containerDomains.length > 0) {
                const activeDomain = containerDomains.find(d => d.status === 'active');
                if (activeDomain) {
                    // Для контейнера проверяем доступность из первого приложения с доменом
                    const appWithDomain = containerApps.find(a => a.domains && a.domains.some(d => d.domain === activeDomain.domain));
                    let domainStatus = '';
                    if (appWithDomain && appWithDomain.url_available === true) {
                        domainStatus = ' ✅';
                    } else if (appWithDomain && appWithDomain.url_available === false) {
                        domainStatus = ' ❌';
                    }
                    containerLabel += `\n🌐 ${activeDomain.domain}${domainStatus}`;
                } else if (containerDomains[0]) {
                    containerLabel += `\n⏳ ${containerDomains[0].domain}`;
                }
            }
            // Добавляем IP адрес контейнера (берем из первого приложения или используем общий)
            const containerIp = containerApps.find(a => a.internal_ip)?.internal_ip || 
                               containerApps.find(a => a.container_ip)?.container_ip;
            if (containerIp) {
                containerLabel += `\n📡 IP: ${containerIp}`;
            }
            
            const statusIcon = containerStatus === 'running' ? '✅' : '⏸';
            containerLabel += `\n${statusIcon} ${containerStatus === 'running' ? 'Работает' : 'Остановлен'}`;
            
            // Узел контейнера
            nodes.add({
                id: containerId,
                label: containerLabel,
                group: 'lxd',
                level: 1,
                color: {
                    background: '#ffc107',
                    border: '#e0a800'
                },
                title: `LXD контейнер: ${containerName}`,
                data: { type: 'container', name: containerName, apps: containerApps, domains: containerDomains }
            });
            
            edges.add({
                from: 'host',
                to: containerId,
                label: 'LXD',
                font: { align: 'top' }
            });
            
            // Приложения внутри контейнера
            containerApps.forEach(app => {
                const appId = nodeId++;
                // Определяем цвет узла LXD приложения с учетом статуса и доступности
                let nodeColor;
                if (app.status !== 'running') {
                    nodeColor = { background: '#dc3545', border: '#c82333' }; // Остановлен
                } else if (app.url_check && app.url_check.available === false) {
                    nodeColor = { background: '#ff9800', border: '#f57c00' }; // Проблема доступности
                } else {
                    nodeColor = { background: '#17a2b8', border: '#138496' }; // Работает
                }
                
                // Формируем подпись с доменом, доступностью и статусом
                let appLabel = `${app.name.split(' - ')[1] || app.name}\n${app.app_type || 'Приложение'}`;
                if (app.domains && app.domains.length > 0) {
                    const activeDomain = app.domains.find(d => d.status === 'active');
                    if (activeDomain) {
                        let domainStatus = '';
                        if (app.url_available === true) {
                            domainStatus = ' ✅';
                        } else if (app.url_available === false) {
                            domainStatus = ' ❌';
                        }
                        appLabel += `\n🌐 ${activeDomain.domain}${domainStatus}`;
                    } else {
                        const plannedDomain = app.domains.find(d => d.status === 'planned');
                        if (plannedDomain) {
                            appLabel += `\n⏳ ${plannedDomain.domain}`;
                        }
                    }
                }
                // Добавляем IP адрес
                if (app.internal_ip) {
                    appLabel += `\n📡 IP: ${app.internal_ip}`;
                }
                
                // Добавляем информацию о маршрутизации (proxy устройства LXD)
                if (app.proxy_listen && app.proxy_connect) {
                    const listen_match = app.proxy_listen.match(/:(\d+)$/);
                    const connect_match = app.proxy_connect.match(/:(\d+)$/);
                    if (listen_match && connect_match) {
                        appLabel += `\n🔀 Proxy: ${listen_match[1]}→${connect_match[1]}`;
                    }
                } else if (app.port && app.internal_port && app.port !== app.internal_port) {
                    appLabel += `\n🔀 Port: ${app.port}→${app.internal_port}`;
                }
                
                const statusIcon = app.status === 'running' ? '✅' : '⏸';
                appLabel += `\n${statusIcon} ${app.status === 'running' ? 'Работает' : 'Остановлен'}`;
                
                nodes.add({
                    id: appId,
                    label: appLabel,
                    group: 'lxd-app',
                    level: 2,
                    color: nodeColor,
                    title: getTooltip(app),
                    data: app
                });
                
                edges.add({
                    from: containerId,
                    to: appId,
                    label: app.port ? `:${app.port}` : '',
                    font: { align: 'top' }
                });
            });
        });
    }
    
    // Хост-сервисы
    hostApps.forEach(app => {
        let nodeLabel = `${app.name}\n${app.app_type || 'Сервис'}`;
        
        // Добавляем домен, доступность и статус
        if (app.domains && app.domains.length > 0) {
            const activeDomain = app.domains.find(d => d.status === 'active');
            if (activeDomain) {
                let domainStatus = '';
                if (app.url_available === true) {
                    domainStatus = ' ✅';
                } else if (app.url_available === false) {
                    domainStatus = ' ❌';
                }
                nodeLabel += `\n🌐 ${activeDomain.domain}${domainStatus}`;
            }
        }
        // Добавляем IP адрес (для хост-сервисов используем host_ip или внутренний IP)
        if (app.internal_ip) {
            nodeLabel += `\n📡 IP: ${app.internal_ip}`;
        } else if (app.host_ip) {
            nodeLabel += `\n📡 IP: ${app.host_ip}`;
        }
        
        const statusIcon = app.status === 'running' ? '✅' : '⏸';
        nodeLabel += `\n${statusIcon} ${app.status === 'running' ? 'Работает' : 'Остановлен'}`;
        
        nodes.add({
            id: nodeId++,
            label: nodeLabel,
            group: 'host-service',
            level: 1,
            color: {
                background: '#6c757d',
                border: '#5a6268'
            },
            title: getTooltip(app),
            data: app
        });
        
        edges.add({
            from: 'host',
            to: nodeId - 1,
            label: app.port ? `:${app.port}` : '',
            font: { align: 'top' }
        });
    });
}

function getTooltip(app) {
    let tooltip = `<strong>${app.name}</strong><br>`;
    tooltip += `Тип: ${app.container_type || app.type}<br>`;
    tooltip += `Статус: ${app.status === 'running' ? '✅ Запущен' : '⏸ Остановлен'}<br>`;
    
    // Добавляем домены в tooltip
    if (app.domains && app.domains.length > 0) {
        const activeDomains = app.domains.filter(d => d.status === 'active');
        const plannedDomains = app.domains.filter(d => d.status === 'planned');
        
        if (activeDomains.length > 0) {
            tooltip += `<br><strong>🌐 Домены:</strong><br>`;
            activeDomains.forEach(d => {
                tooltip += `  ${d.domain}<br>`;
            });
        }
        
        if (plannedDomains.length > 0) {
            tooltip += `<br><strong>⏳ Запланировано:</strong><br>`;
            plannedDomains.forEach(d => {
                tooltip += `  ${d.domain}<br>`;
            });
        }
    }
    
    if (app.url) {
        tooltip += `<br>URL: ${app.url}<br>`;
    }
    
    if (app.port) {
        tooltip += `Порт: ${app.port}<br>`;
    }
    
    if (app.internal_ip) {
        tooltip += `Внутренний IP: ${app.internal_ip}<br>`;
    }
    
    if (app.description) {
        tooltip += `<br>${app.description}`;
    }
    
    return tooltip;
}

function showAppDetails(nodeId) {
    const node = nodes.get(nodeId);
    if (!node || !node.data) return;
    
    let app = node.data;
    const detailsEl = document.getElementById('app-details');
    const contentEl = document.getElementById('app-details-content');
    
    // Обработка узла контейнера (type: 'container')
    if (app.type === 'container' && app.apps && app.apps.length > 0) {
        // Определяем статус контейнера по статусам приложений
        const runningApps = app.apps.filter(a => a.status === 'running');
        const status = runningApps.length > 0 ? 'running' : 'stopped';
        
        // Собираем домены из всех приложений контейнера
        const containerDomains = app.domains || [];
        
        // Создаем объект для отображения контейнера
        app = {
            name: app.name,
            type: 'lxd',
            container_type: 'LXD контейнер',
            container_name: app.name,
            status: status,
            domains: containerDomains,
            description: `LXD контейнер: ${app.name}. Внутри ${app.apps.length} приложение(й)`
        };
    }
    
    let html = '';
    
    html += `<div class="detail-item"><strong>Название</strong><span>${app.name || 'N/A'}</span></div>`;
    html += `<div class="detail-item"><strong>Тип</strong><span>${app.container_type || app.type || 'N/A'}</span></div>`;
    html += `<div class="detail-item"><strong>Статус</strong><span class="${app.status === 'running' ? 'status-running' : 'status-stopped'}">${app.status === 'running' ? '✅ Запущен' : '⏸ Остановлен'}</span></div>`;
    
    if (app.url) {
        const urlAvailable = app.url_available;
        const isRecommended = app.url_recommended;
        const urlCheck = app.url_check || {};
        let urlStatus = '';
        let urlClass = 'url-link';
        let diagnosticsInfo = '';
        
        if (urlAvailable === true) {
            urlStatus = ' <span style="color: #28a745; font-weight: bold;">✅ Доступен</span>';
            if (urlCheck.status_code) {
                urlStatus += ` <span style="color: #666; font-size: 0.85em;">(HTTP ${urlCheck.status_code})</span>`;
            }
            if (urlCheck.response_time !== null && urlCheck.response_time !== undefined) {
                diagnosticsInfo += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">⏱ Время отклика: ${urlCheck.response_time} мс</div>`;
            }
        } else if (urlAvailable === false) {
            urlStatus = ' <span style="color: #dc3545; font-weight: bold;">❌ Недоступен</span>';
            urlClass = 'url-link-disabled';
            if (urlCheck.error) {
                diagnosticsInfo += `<div style="font-size: 0.85em; color: #dc3545; margin-top: 4px; font-family: monospace;">⚠️ Ошибка: ${urlCheck.error}</div>`;
            }
            if (urlCheck.status_code) {
                diagnosticsInfo += `<div style="font-size: 0.85em; color: #dc3545; margin-top: 4px;">HTTP статус: ${urlCheck.status_code}</div>`;
            }
        } else {
            urlStatus = ' <span style="color: #6c757d;">⚠️ Не проверен</span>';
            if (urlCheck.error) {
                diagnosticsInfo += `<div style="font-size: 0.85em; color: #6c757d; margin-top: 4px;">ℹ️ ${urlCheck.error}</div>`;
            }
        }
        
        if (isRecommended) {
            urlStatus += ' <span style="color: #ffc107; font-size: 0.9em;">(рекомендуемый)</span>';
            urlClass = 'url-link-recommended';
        }
        
        const urlTitle = isRecommended ? 'Рекомендуемый URL (не активный)' : (urlAvailable === false ? 'URL недоступен' : 'URL доступен');
        html += `<div class="detail-item"><strong>URL</strong><span title="${urlTitle}"><a href="${app.url}" target="_blank" class="${urlClass}" ${urlAvailable === false ? 'onclick="return false;" style="cursor: not-allowed; opacity: 0.6;"' : ''}>${app.url}</a>${urlStatus}${diagnosticsInfo}</span></div>`;
    } else {
        // Генерируем рекомендуемый URL если его нет
        const recommendedUrl = app.host_ip && app.port ? 
            `${app.protocol || 'http'}://${app.host_ip}:${app.port}` : null;
        
        if (recommendedUrl) {
            html += `<div class="detail-item"><strong>URL</strong><span><span class="url-link-recommended" style="opacity: 0.6; cursor: not-allowed;" title="Рекомендуемый URL (не активный)">${recommendedUrl}</span> <span style="color: #ffc107; font-size: 0.9em;">(рекомендуемый, не активный)</span></span></div>`;
        }
    }
    
    if (app.port) {
        html += `<div class="detail-item"><strong>Порт</strong><span>${app.port}</span></div>`;
    }
    
    if (app.protocol) {
        html += `<div class="detail-item"><strong>Протокол</strong><span>${app.protocol.toUpperCase()}</span></div>`;
    }
    
    if (app.internal_ip) {
        html += `<div class="detail-item"><strong>Внутренний IP</strong><span>${app.internal_ip}</span></div>`;
    }
    
    if (app.host_ip) {
        html += `<div class="detail-item"><strong>IP хоста</strong><span>${app.host_ip}</span></div>`;
    }
    
    if (app.image) {
        html += `<div class="detail-item"><strong>Docker образ</strong><span>${app.image}</span></div>`;
    }
    
    if (app.port_mappings && app.port_mappings.length > 0) {
        const mappings = app.port_mappings.map(p => `${p.host_port}→${p.container_port}`).join(', ');
        html += `<div class="detail-item"><strong>Проброшенные порты</strong><span>${mappings}</span></div>`;
    }
    
    if (app.app_type) {
        html += `<div class="detail-item"><strong>Категория</strong><span>${app.app_type}</span></div>`;
    }
    
    if (app.description) {
        html += `<div class="detail-item"><strong>Описание</strong><span>${app.description}</span></div>`;
    }
    
    if (app.internal_only) {
        html += `<div class="detail-item"><strong>⚠️ Внутренний доступ</strong><span>Доступен только внутри контейнера</span></div>`;
    }
    
    // Добавляем информацию о маршрутизации и firewall
    if (app.routing) {
        html += `<div class="detail-item"><strong>🔀 Маршрутизация</strong><span style="font-family: monospace; font-size: 0.9em;">`;
        if (app.routing.firewall_nat) {
            html += `Firewall NAT: ${app.routing.firewall_nat.type} → ${app.routing.firewall_nat.destination}`;
        } else if (app.routing.proxy_device) {
            html += `LXD Proxy: порт ${app.routing.proxy_device.external_port} → ${app.routing.proxy_device.internal_port}`;
        }
        html += `</span></div>`;
    }
    
    // Информация о proxy устройствах LXD с диагностикой
    if (app.proxy_listen && app.proxy_connect) {
        html += `<div class="detail-item"><strong>🔀 LXD Proxy</strong><span style="font-family: monospace; font-size: 0.9em;"><div>Listen: ${app.proxy_listen}</div><div>Connect: ${app.proxy_connect}</div>`;
        
        // Проверка корректности proxy
        const listenMatch = app.proxy_listen.match(/tcp:(.*):(\d+)/);
        const connectMatch = app.proxy_connect.match(/tcp:(.*):(\d+)/);
        if (listenMatch && connectMatch) {
            html += `<div style="color: #28a745; margin-top: 4px;">✓ Proxy маршрут: ${listenMatch[2]} → ${connectMatch[2]}</div>`;
        }
        html += `</span></div>`;
    }
    
    // Информация о проброшенных портах Docker
    if (app.port_mappings && app.port_mappings.length > 0 && app.port_mappings[0].host_port !== app.port_mappings[0].container_port) {
        const mappings = app.port_mappings.map(p => `${p.host_port}→${p.container_port}`).join(', ');
        html += `<div class="detail-item"><strong>🔀 Port Mapping</strong><span style="font-family: monospace; font-size: 0.9em;">${mappings}</span></div>`;
    }
    
    // Добавляем информацию о доменах
    if (app.domains && app.domains.length > 0) {
        const activeDomains = app.domains.filter(d => d.status === 'active');
        const plannedDomains = app.domains.filter(d => d.status === 'planned');
        
        if (activeDomains.length > 0) {
            let domainsHtml = activeDomains.map(d => {
                const domainUrl = `https://${d.domain}`;
                return `<a href="${domainUrl}" target="_blank" class="url-link">${d.domain}</a>`;
            }).join(', ');
            html += `<div class="detail-item"><strong>🌐 Домены (активные)</strong><span>${domainsHtml}</span></div>`;
        }
        
        if (plannedDomains.length > 0) {
            let domainsHtml = plannedDomains.map(d => {
                return `<span style="color: #ffc107; font-style: italic;">${d.domain}</span>`;
            }).join(', ');
            html += `<div class="detail-item"><strong>⏳ Домены (запланированные)</strong><span>${domainsHtml}</span></div>`;
        }
    }
    
    // Добавляем раздел Тестирование
    const testCommands = getTestCommands(app);
    if (testCommands && testCommands.length > 0) {
        html += `<div class="detail-item" style="border-top: 2px solid #ddd; margin-top: 12px; padding-top: 12px;"><strong>🔍 Тестирование</strong><div style="margin-top: 8px;">`;
        testCommands.forEach((cmd, idx) => {
            if (cmd.note) {
                // Если это примечание, отображаем как текст
                html += `<div style="margin-bottom: 12px; padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 3px; font-size: 0.9em; color: #856404;">`;
                html += `<strong>ℹ️ Примечание:</strong> ${cmd.note}`;
                html += `</div>`;
            } else {
                // Компактное отображение теста - только название и кнопка
                const commandId = `test-cmd-${idx}-${Date.now()}`;
                const testId = `test-${idx}-${Date.now()}`;
                const safeLabel = (cmd.label || 'Тест').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
                const safeCommand = cmd.command.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
                
                html += `<div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #dee2e6;">`;
                html += `<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">`;
                html += `<div style="flex: 1;">`;
                html += `<div style="font-weight: 500; color: #495057; margin-bottom: 4px;">${cmd.label || 'Тест'}</div>`;
                html += `<div style="font-size: 0.8em; color: #6c757d; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${cmd.command}">${cmd.command.length > 50 ? cmd.command.substring(0, 50) + '...' : cmd.command}</div>`;
                html += `</div>`;
                html += `<button onclick="runTest('${safeCommand}', '${safeLabel}', '${testId}')" id="${testId}" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9em; white-space: nowrap; flex-shrink: 0;" title="Запустить тест">▶ Запустить</button>`;
                html += `</div>`;
                html += `</div>`;
            }
        });
        html += `</div></div>`;
    }
    
    contentEl.innerHTML = html;
    detailsEl.style.display = 'block';
}

function getTestCommands(app) {
    const commands = [];
    const appName = (app.name || '').toLowerCase();
    const appType = (app.app_type || '').toLowerCase();
    const containerName = (app.container_name || '').toLowerCase();
    
    // BigBlueButton
    if (appName.includes('bbb') || appName.includes('bigbluebutton') || 
        (app.domains && app.domains.some(d => d.domain && d.domain.includes('school.cdto')))) {
        commands.push({
            label: 'E2E тестирование',
            command: 'cd /home/cdto/DENKART/scripts/bbb-testing && python3 bbb_e2e_test.py'
        });
        commands.push({
            label: 'Мониторинг',
            command: 'cd /home/cdto/DENKART/scripts/bbb-testing && python3 bbb_monitoring_test.py'
        });
        commands.push({
            label: 'Анализ DOM',
            command: 'cd /home/cdto/DENKART/scripts/bbb-testing && python3 bbb_dom_analyzer.py'
        });
    }
    
    // Документация (docs-denkart или docs.cdto)
    if (appName.includes('docs') || appType.includes('документация') || 
        (app.domains && app.domains.some(d => d.domain && d.domain.includes('docs.cdto')))) {
        commands.push({
            label: 'Основной E2E тест',
            command: 'cd /home/cdto/DENKART/scripts/docs-testing && python3 docs_e2e_test.py'
        });
        commands.push({
            label: 'Анализ DOM',
            command: 'cd /home/cdto/DENKART/scripts/docs-testing && python3 docs_dom_analyzer.py'
        });
        commands.push({
            label: 'Тест авторизации',
            command: 'cd /home/cdto/DENKART/scripts/docs-testing && python3 docs_auth_test.py'
        });
        commands.push({
            label: 'Все тесты',
            command: 'cd /home/cdto/DENKART/scripts/docs-testing && ./run_all_tests.sh'
        });
    }
    
    // Cockpit (denkart.cdto)
    if ((app.domains && app.domains.some(d => d.domain && d.domain.includes('denkart.cdto'))) ||
        appName.includes('cockpit')) {
        commands.push({
            label: 'Тест доступности',
            command: 'cd /home/cdto/DENKART/scripts/docs-testing && python3 docs_e2e_test.py'
        });
        commands.push({
            label: 'Примечание',
            note: 'Укажите URL: https://denkart.cdto.life/ при запуске'
        });
    }
    
    // LXD контейнеры (общее тестирование)
    if (app.type === 'lxd' || app.container_type) {
        // Если это контейнер с документацией или BBB, команды уже добавлены выше
        // Для других контейнеров можно добавить общие команды
    }
    
    return commands.length > 0 ? commands : null;
}

function closeDetails() {
    document.getElementById('app-details').style.display = 'none';
}

function runTest(command, label, buttonId) {
    // Отключаем кнопку на время запроса
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Запуск...';
    button.style.background = '#6c757d';
    
    // Отправляем запрос на запуск теста
    fetch('/api/test/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            command: command,
            label: label
        })
    })
    .then(response => {
        // Проверяем Content-Type перед парсингом JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return response.text().then(text => {
                throw new Error(`Ожидался JSON, получен: ${contentType || 'неизвестный тип'}. Ответ: ${text.substring(0, 200)}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            button.textContent = '✅ Запущен';
            button.style.background = '#28a745';
            
            // Через 3 секунды возвращаем исходное состояние
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
                button.style.background = '#007bff';
            }, 3000);
            
            alert(`Тест "${label}" успешно запущен!\n\nPID процесса: ${data.pid || 'N/A'}\n\nТест выполняется в фоновом режиме. Проверьте результаты в директории тестов.`);
        } else {
            button.disabled = false;
            button.textContent = originalText;
            button.style.background = '#dc3545';
            alert(`Ошибка запуска теста: ${data.error || 'Неизвестная ошибка'}`);
            setTimeout(() => {
                button.style.background = '#007bff';
            }, 2000);
        }
    })
    .catch(error => {
        button.disabled = false;
        button.textContent = originalText;
        button.style.background = '#dc3545';
        alert(`Ошибка: ${error.message}`);
        setTimeout(() => {
            button.style.background = '#007bff';
        }, 2000);
    });
}

function refreshData() {
    loadData();
    loadDomains();
}

function loadDomains() {
    fetch('/api/domains')
        .then(response => response.json())
        .then(data => {
            renderDomains(data);
        })
        .catch(error => {
            console.error('Ошибка загрузки доменов:', error);
        });
}

function renderDomains(domainsConfig) {
    const activeDomains = domainsConfig.active || [];
    const plannedDomains = domainsConfig.planned || [];
    
    const activeEl = document.getElementById('domains-active');
    const plannedEl = document.getElementById('domains-planned');
    
    // Очищаем контейнеры
    if (activeEl) activeEl.innerHTML = '';
    if (plannedEl) plannedEl.innerHTML = '';
    
    // Отображаем активные домены
    activeDomains.forEach(domain => {
        const domainItem = document.createElement('div');
        domainItem.className = 'domain-item';
        domainItem.innerHTML = `
            <div class="domain-name">${domain.domain}</div>
            <div class="domain-desc">${domain.description || ''}</div>
        `;
        if (activeEl) activeEl.appendChild(domainItem);
    });
    
    // Отображаем запланированные домены
    plannedDomains.forEach(domain => {
        const domainItem = document.createElement('div');
        domainItem.className = 'domain-item domain-item-planned';
        domainItem.innerHTML = `
            <div class="domain-name">${domain.domain}</div>
            <div class="domain-desc">${domain.description || ''}</div>
        `;
        if (plannedEl) plannedEl.appendChild(domainItem);
    });
}
