# Lesson 03 (OpenRouter) – перевірки solution

## Offline recorded checks

Запустіть успадкований extraction replay та новий Lesson 03 tool-calling replay:

```powershell
yarn eval:lesson03:openrouter:solution
```

Команда читає локальні recorded observations і не звертається до мережі. Extraction runner перевіряє успадковану поведінку document extraction. Tool runner перевіряє п'ять записаних сценаріїв: вибір інструмента, нормалізацію аргументів, уточнення, контрольовану помилку та пряму відповідь без tool call. Replay підтверджує лише recorded pipeline, а не поточну поведінку моделі чи доступність catalog. Записуйте фактичну кількість cases і success rate з виводу.

## Необов'язковий live tool-calling run

```powershell
yarn eval:lesson03:openrouter:solution:live
```

Команда надсилає реальні provider requests для п'яти tool-calling сценаріїв, а потім звіряє налаштовані model IDs, зареєстровані ціни й оголошені capabilities з публічним catalog. Tool route передає одну налаштовану модель на запит. Перевірка може використати платні tokens і залежить від поточних відповідей провайдера та catalog; вона не потрібна для offline acceptance gate.

## Необов'язковий live extraction run

```powershell
yarn eval:lesson03:openrouter:solution:live:extraction
```

Команда надсилає успадковані extraction cases до налаштованих document models. Це окрема перевірка від live tool-calling run, вона також може використати баланс провайдера.

Offline replay, live inference і live catalog check є окремими доказами. Не подавайте один як підтвердження іншого.
