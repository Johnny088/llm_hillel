# Lesson 05 OpenRouter – підготовка студентської копії

Студентська робота розташована в `my-dev/lesson-05-memory-openrouter/`; ізольований викладацький replay використовує окремий `dev/`.

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Створити ізольований candidate з підготовленого Lesson 05 starter, в якому вже є база Lesson 04.

### 💎 Практична цінність застосунку

Копіювання з Git manifest зберігає початковий стан для порівняння та не переносить випадкові локальні дані.

### ⚙️ Що робить застосунок

Новий candidate починає роботу над memory поведінкою; вручну імпортувати чи виправляти попередній solution не потрібно.

## Мета й межі

Student candidate починається з підготовленого канонічного lesson-05-memory-openrouter/starter/ поточного заняття. Його одноразово створює `yarn student:init 05 openrouter`; команда відмовляється перезаписувати destination. Студенту не потрібно вручну переносити чи ремонтувати попередній solution або запускати dev-міграцію.

Після ініціалізації student workflow проходить у `my-dev/lesson-05-memory-openrouter/` за публічними інструкціями. Автоматичний teacher replay нижче є окремим внутрішнім маршрутом і змінює спільний `dev/` лише в disposable fixture.

**Тема:** Conversation State, durable history, reset, sliding window і safe persistence.

## Створити копію

Команди виконуються з кореня клону репозиторію, де є `package.json`. Init запускається один раз. Якщо папка вже існує, робота продовжується в ній без перезапису.

```powershell
yarn student:init 05 openrouter
if ($LASTEXITCODE -ne 0) { throw 'Студентська копія не створена. Наявна робота не перезаписується.' }
```

CLI копіює підготовлений starter, не переносить секрети або runtime-дані та коригує зовнішні відносні Markdown-посилання для нового розташування.

## Звірити основу до першої зміни

Ця необов’язкова перевірка звіряє байти non-Markdown файлів. Markdown може відрізнятися після правильного перебазування посилань; це очікувана поведінка `student:init`.

```powershell
$repositoryRoot = (Get-Location).Path
$starterRoot = Join-Path $repositoryRoot 'lesson-05-memory-openrouter/starter'
$copyRoot = (Resolve-Path -LiteralPath 'my-dev/lesson-05-memory-openrouter').Path
$sourceFiles = @(Get-ChildItem -LiteralPath $starterRoot -Recurse -File | Where-Object Extension -ne '.md')
$copyFiles = @(Get-ChildItem -LiteralPath $copyRoot -Recurse -File | Where-Object Extension -ne '.md')
$sourceRelative = @($sourceFiles | ForEach-Object { $_.FullName.Substring($starterRoot.Length + 1) } | Sort-Object)
$copyRelative = @($copyFiles | ForEach-Object { $_.FullName.Substring($copyRoot.Length + 1) } | Sort-Object)
if (Compare-Object $sourceRelative $copyRelative) { throw 'Перелік non-Markdown файлів відрізняється від starter.' }
foreach ($relativePath in $sourceRelative) {
  $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $starterRoot $relativePath)).Hash
  $copyHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $copyRoot $relativePath)).Hash
  if ($sourceHash -ne $copyHash) { throw "Відрізняється файл: $relativePath" }
}
Write-Output "PASS: $($sourceRelative.Count) non-Markdown файлів збігаються."
```

Проміжні тести запускає `yarn student:test 05 openrouter`, а завершеність поточної роботи – `yarn student:check 05 openrouter`. Зелений успадкований baseline ще не підтверджує реалізацію нової теми.

Після звірки продовжуйте за [student guide](./student-guide.md), [starter map](./starter-code-guide.md), [homework](./homework.md) та [roadmap](./roadmap-code-guide.md). Якщо окремий підготовлений навчальний ресурс потрібно додати, його шлях і причина описані в roadmap. Ручна адаптація попереднього source не потрібна.

## Автоматичний перехід викладача

Для вже підготовленого спільного dev/ команда corepack yarn dev:next перевіряє попередній етап і автоматично готує наступний canonical starter. Це необов’язкова teacher lane, а не вимога до студента. Перед переходом збережіть роботу; не запускайте команду повторно, якщо нове заняття вже почалося.
