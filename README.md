# WhiteMAX Desktop

Tauri 2: окно с web.max.ru + инъекция `src-tauri/inject.js` (блок телеметрии, масштаб, свой CSS).

## Запуск
    npm install
    npx tauri icon путь/к/картинке.png   # один раз, если нет папки src-tauri/icons
    npm run tauri dev
    npm run tauri build

## Поиск телеметрии
F12 (или ПКМ → Inspect) → Console. Ctrl+Shift+L включает лог всех запросов.
Всё лишнее добавь в массив BLOCK в src-tauri/inject.js.
