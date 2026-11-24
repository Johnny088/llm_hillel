# Lesson 04 OpenRouter – підготовка власної робочої папки

> Спочатку створіть candidate командою `yarn student:init 04 openrouter`. Ця довідка допомагає звірити вже створену копію й не є окремою процедурою ручного копіювання.

## Мета, цінність та опис проєкту

### 🎯 Мета проєкту

Підготувати окрему my-dev папку з повної канонічної Lesson 04 starter копії, звірити її з джерелом і зафіксувати справний успадкований baseline до внесення коду.

### 💎 Практична цінність застосунку

Точна копія зберігає попередню працюючу основу та її тести. Студентська реалізація додає MCP, research route та web search лише у власну папку. Так можна окремо бачити, що успадковано, а що справді реалізовано для Lesson 04.

### ⚙️ Що робить застосунок

На початку my-dev/lesson-04-mcp-built-in-tools-openrouter/ містить ті самі файли, що canonical starter. Він успадковує Lesson 03 API, тести й два записаних eval runners для extraction та tool calling. Він не має Lesson 04 MCP sandbox чи MCP eval runner до роботи за roadmap. Зелений успадкований baseline не є доказом Lesson 04 completion.

## Підготувати destination без перезапису

Усі команди виконуються з кореня репозиторію, де лежить package.json. Спершу перевірте гілку та destination:

```powershell
git status --short --branch
if (Test-Path 'my-dev/lesson-04-mcp-built-in-tools-openrouter') {
  throw 'Destination існує. Збережіть і перегляньте роботу перед будь-яким копіюванням.'
}
```

Якщо папка існує, не видаляйте її і не копіюйте поверх. Збережіть роботу у власній гілці або окремій копії. Не змінюйте canonical starter, solution чи спільний dev/.

Коли destination відсутня, одноразово виконайте `yarn student:init 04 openrouter`. Команда копіює starter у `my-dev/lesson-04-mcp-built-in-tools-openrouter/` і відмовляється перезаписувати наявну папку. Не створюйте лише `src/` вручну: всі успадковані файли, metadata, tests, evals та sandbox є частиною baseline.

## Перевірити копію байт у байт

Canonical baseline command підтверджує source surface:

```powershell
yarn verify:lesson04:openrouter:scaffolding
```

Потім порівняйте кожний файл source і власної копії за relative path та SHA-256:

```powershell
$sourceRoot = (Resolve-Path 'lesson-04-mcp-built-in-tools-openrouter/starter').Path
$copyRoot = (Resolve-Path 'my-dev/lesson-04-mcp-built-in-tools-openrouter').Path
$sourceFiles = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File)
$copyFiles = @(Get-ChildItem -LiteralPath $copyRoot -Recurse -File)
$sourceRelative = @($sourceFiles | ForEach-Object { $_.FullName.Substring($sourceRoot.Length + 1) } | Sort-Object)
$copyRelative = @($copyFiles | ForEach-Object { $_.FullName.Substring($copyRoot.Length + 1) } | Sort-Object)
if (Compare-Object $sourceRelative $copyRelative) { throw 'File set differs from canonical starter.' }
foreach ($relative in $sourceRelative) {
  $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $sourceRoot $relative)).Hash
  $copyHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $copyRoot $relative)).Hash
  if ($sourceHash -ne $copyHash) { throw "Content differs: $relative" }
}
Write-Output 'PASS: my-dev matches canonical starter by path and SHA-256.'
```

Очікується однаковий файл-набір і однаковий hash для кожного файлу. Якщо перевірка знаходить різницю, не повторюйте копіювання поверх destination. Перевірте конкретний path і збережіть потрібні локальні зміни.

## Перевірити успадкований baseline у власній копії

```powershell
yarn vitest run --dir my-dev/lesson-04-mcp-built-in-tools-openrouter/tests
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run.ts
node scripts/run-tsx-entrypoint.mjs my-dev/lesson-04-mcp-built-in-tools-openrouter/evals/run-tool-calling.ts
```

Очікується успіх успадкованих unit tests, extraction replay 5/5 і tool-calling replay 5/5. Зафіксуйте фактичні pass/fail/todo/skip counts. Ці команди не запускають локальний MCP server і не роблять provider inference.

Якщо команда падає, розберіть baseline перш ніж відкривати roadmap. Не замінюйте помилку на старий recorded output та не запускайте live provider як спосіб підтвердити локальні fixtures.

Після звірки переходьте до [roadmap](./roadmap-code-guide.md). Кожна нова Lesson 04 зміна виконується лише у my-dev destination. Після першої зміни baseline hash-паритет більше не є completion gate; завершення перевіряє окремий student gate.
