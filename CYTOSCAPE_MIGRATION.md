# Миграция на Cytoscape.js (если понадобится)

Если vis.js продолжает иметь проблемы с перекрытием узлов, можно рассмотреть миграцию на **Cytoscape.js** с расширением **ELK** (Eclipse Layout Kernel), которое обеспечивает лучшее предотвращение перекрытий для иерархических диаграмм архитектуры.

## Преимущества Cytoscape.js + ELK:

1. **Улучшенное предотвращение перекрытий** - ELK использует продвинутые алгоритмы
2. **Лучшая структурированность** - специализированные layout для архитектурных диаграмм
3. **Масштабируемость** - лучше работает с большими графами
4. **Гибкость** - множество layout алгоритмов через расширения

## Установка:

```bash
npm install cytoscape cytoscape-elk
```

Или через CDN в HTML:

```html
<script src="https://unpkg.com/cytoscape@3/dist/cytoscape.min.js"></script>
<script src="https://unpkg.com/cytoscape-elk@2/dist/cytoscape-elk.js"></script>
```

## Основные изменения в коде:

1. Заменить `vis.DataSet` на `cytoscape()`
2. Использовать `elk` layout с параметрами:
   ```js
   layout: {
     name: 'elk',
     elk: {
       algorithm: 'layered',
       'elk.spacing.nodeNode': '100',
       'elk.spacing.edgeNode': '50',
       'elk.layered.spacing.nodeNodeBetweenLayers': '200'
     }
   }
   ```

## Статус:

Миграция не требуется, если текущие настройки vis.js решают проблему перекрытий.
