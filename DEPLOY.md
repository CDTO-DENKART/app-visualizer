# Инструкции по развертыванию и отправке в удаленный репозиторий

## Отправка в удаленный репозиторий

### 1. Добавление удаленного репозитория

#### Для GitHub:

```bash
cd /home/cdto/app-visualizer
git remote add origin https://github.com/username/app-visualizer.git
# или с SSH:
git remote add origin git@github.com:username/app-visualizer.git
```

#### Для GitLab:

```bash
git remote add origin https://gitlab.com/username/app-visualizer.git
# или с SSH:
git remote add origin git@gitlab.com:username/app-visualizer.git
```

#### Для Bitbucket:

```bash
git remote add origin https://bitbucket.org/username/app-visualizer.git
# или с SSH:
git remote add origin git@bitbucket.org:username/app-visualizer.git
```

### 2. Проверка удаленного репозитория

```bash
git remote -v
```

### 3. Отправка кода в удаленный репозиторий

```bash
# Первая отправка (связывание веток)
git push -u origin master

# Последующие отправки
git push

# Отправка тегов
git push --tags
```

### 4. Переименование ветки (если используете main вместо master)

```bash
git branch -M main
git push -u origin main
```

## Версионирование

### Создание тега версии

```bash
# Аннотированный тег (рекомендуется)
git tag -a v1.0.1 -m "Описание изменений в версии"

# Легкий тег
git tag v1.0.1
```

### Отправка тегов

```bash
# Отправить конкретный тег
git push origin v1.0.1

# Отправить все теги
git push --tags
```

### Просмотр тегов

```bash
# Список всех тегов
git tag -l

# Детали тега
git show v1.0.1
```

## Обновление из удаленного репозитория

```bash
# Получить изменения
git fetch origin

# Объединить изменения
git merge origin/master

# Или одной командой
git pull origin master
```

## Работа с ветками

### Создание новой ветки

```bash
git checkout -b feature/new-feature
```

### Переключение веток

```bash
git checkout master
git checkout feature/new-feature
```

### Слияние веток

```bash
git checkout master
git merge feature/new-feature
```

## Рекомендации

1. **Коммиты**: Делайте частые, логически связанные коммиты
2. **Сообщения коммитов**: Используйте понятные описания изменений
3. **Теги**: Создавайте теги для стабильных релизов
4. **Ветки**: Используйте отдельные ветки для новых функций
5. **`.gitignore`**: Всегда обновляйте при добавлении новых типов файлов

## Проверка статуса

```bash
# Статус изменений
git status

# История коммитов
git log --oneline --graph --all

# Список веток
git branch -a

# Список тегов
git tag -l
```
