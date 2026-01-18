# Инструкция по созданию репозитория на GitHub и отправке кода

## Текущая ситуация

Remote настроен, но репозиторий на GitHub еще не создан:
```
origin: git@github.com:CDTO-DENKART/app-visualizer.git
```

## Шаг 1: Создание репозитория на GitHub

### Вариант A: Через веб-интерфейс GitHub

1. Перейдите на страницу создания репозитория:
   - https://github.com/organizations/CDTO-DENKART/repositories/new
   - Или: https://github.com/new (создаст в вашем аккаунте)

2. Заполните форму:
   - **Repository name**: `app-visualizer`
   - **Description**: `Визуализация архитектуры сервера с контролем тестирования`
   - **Visibility**: Private или Public (на ваше усмотрение)
   - **НЕ** устанавливайте галочки:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   (Все эти файлы уже есть в локальном репозитории)

3. Нажмите **"Create repository"**

### Вариант B: Через GitHub CLI (если установлен)

```bash
gh repo create CDTO-DENKART/app-visualizer \
  --private \
  --description "Визуализация архитектуры сервера с контролем тестирования" \
  --source=. \
  --remote=origin \
  --push
```

## Шаг 2: Отправка кода

После создания репозитория выполните:

```bash
cd /home/cdto/app-visualizer

# Отправка кода
git push -u origin master

# Отправка тегов
git push --tags
```

## Шаг 3: Проверка

Проверьте на GitHub:
- https://github.com/CDTO-DENKART/app-visualizer

Должны быть видны:
- ✅ Все файлы проекта
- ✅ README.md
- ✅ Тег v1.0.0 в разделе Releases/Tags

## Если используете другое имя организации или репозитория

Измените remote:

```bash
git remote set-url origin git@github.com:ВАША_ОРГАНИЗАЦИЯ/ВАШ_РЕПОЗИТОРИЙ.git
```

Или удалите и добавьте заново:

```bash
git remote remove origin
git remote add origin git@github.com:ВАША_ОРГАНИЗАЦИЯ/ВАШ_РЕПОЗИТОРИЙ.git
```

## Решение проблем

### Ошибка "Repository not found"

**Причина**: Репозиторий не создан на GitHub

**Решение**: Создайте репозиторий на GitHub (см. Шаг 1)

### Ошибка "Permission denied"

**Причина**: Проблемы с SSH ключами или правами доступа

**Решение**:
```bash
# Проверьте SSH ключ
ssh -T git@github.com

# Если не работает, проверьте настройку SSH ключей в GitHub
```

### Ошибка "refusing to merge unrelated histories"

**Причина**: В удаленном репозитории есть начальный коммит (README)

**Решение**:
```bash
git pull origin master --allow-unrelated-histories
git push -u origin master
```

## Дополнительная информация

- Текущая ветка: `master`
- Тег версии: `v1.0.0`
- Количество файлов: 15
- Количество коммитов: 3

Все готово для отправки после создания репозитория на GitHub!
