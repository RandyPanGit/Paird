# Markdown 編輯器設計規格

**日期：** 2026-05-05  
**功能：** FileViewPanel — Markdown 分割編輯 / 預覽視圖

---

## 背景

`FileViewPanel` 目前對所有檔案一律用 `<pre>` 純文字顯示。當開啟的檔案是 `.md` 時，應切換為左右分割視圖：左側為可編輯的 Markdown 原始碼（含語法高亮），右側為即時渲染的預覽（含程式碼高亮）。非 `.md` 檔案維持現有 `<pre>` 顯示，不動。

---

## 套件

| 套件 | 用途 |
|------|------|
| `codemirror` | 編輯器核心 |
| `@codemirror/lang-markdown` | 左側 Markdown 語法高亮 |
| `@codemirror/view` | 提供 `lineNumbers()` extension |
| `@codemirror/theme-one-dark` | 深色主題 |
| `marked` | Markdown → HTML 解析 |
| `highlight.js` | 預覽側程式碼區塊語法高亮 |
| `dompurify` | sanitize marked 輸出，防 XSS |

---

## 架構

### 元件結構

```
FileViewPanel
├── (副檔名非 .md) → <pre> 顯示（現有邏輯，不動）
└── (副檔名為 .md) → MarkdownEditor（新元件）
                      ├── 左側：CodeMirror 編輯器
                      ├── 中間：可拖拉 divider
                      └── 右側：marked + highlight.js 預覽
```

### 新增檔案

- `src/client/components/MarkdownEditor.tsx` — 分割編輯器元件
- `src/client/components/MarkdownEditor.test.tsx` — 元件測試

### 修改檔案

- `src/client/components/FileViewPanel.tsx` — 加入副檔名判斷，路由到 MarkdownEditor
- `src/server/index.ts` — 新增 `file:save` socket 事件 handler
- `src/client/socket.ts` — 新增 `file:save` emit 與 `file:saved` / `file:save:error` 監聽

---

## MarkdownEditor 元件

### 狀態

| 狀態 | 型別 | 說明 |
|------|------|------|
| `content` | `string` | 目前編輯中的文字（本地，未儲存） |
| `dividerX` | `number` | 分割線位置（百分比，預設 50） |
| `isDragging` | `boolean` | 是否正在拖拉分割線 |
| `isDirty` | `boolean` | 是否有未儲存的變更 |

### 生命週期

1. 初始化：從 `openFile.content` 載入到 CodeMirror，啟用 `lineNumbers()` extension
2. CodeMirror `onChange`：更新 `content`，設 `isDirty = true`
3. `content` 變更：`useEffect` 呼叫 `marked.parse()` → `DOMPurify.sanitize()` → 寫入預覽 `innerHTML`，再對 `pre code` 元素執行 `hljs.highlightElement()`
4. 儲存：emit `file:save`，成功後設 `isDirty = false`

### 分割拖拉

- 中間 divider 寬度 4px，`cursor: col-resize`
- `mousedown` 開始拖拉：document 監聽 `mousemove`，計算新百分比（限制 20%–80%）
- `mouseup` 停止拖拉：移除 document listener
- 左右兩側 flex 寬度用 `dividerX` 百分比控制

---

## 儲存流程

### 觸發方式

- 工具列「Save」按鈕
- `Cmd+S` / `Ctrl+S` 快捷鍵

### Socket 事件

| 方向 | 事件 | Payload |
|------|------|---------|
| client → server | `file:save` | `{ path: string, content: string }` |
| server → client | `file:saved` | `{ path: string }` |
| server → client | `file:save:error` | `{ path: string, error: string }` |

### 伺服器端

- `index.ts` 新增 `file:save` handler
- 用 `fs.writeFile` 寫回磁碟
- 只允許寫入 session 的 project 目錄內（防路徑穿越）
- 成功回傳 `file:saved`，失敗回傳 `file:save:error`

### UI 提示

- 標題列未儲存時顯示 `●` 標記（`isDirty` 為 true 時）
- 儲存中顯示 loading 狀態，儲存成功後消失

---

## 主題

| Store theme | CodeMirror theme | 預覽 CSS |
|-------------|-----------------|---------|
| `dark` | `oneDark` | GitHub dark markdown + highlight.js github-dark |
| `light` | `defaultHighlightStyle` | GitHub light markdown + highlight.js github |

主題跟隨 `store.theme` 動態切換（CodeMirror 用 `Compartment` 動態重設 extension）。

---

## 測試策略

### MarkdownEditor.test.tsx

- mock `codemirror`（避免 jsdom 不支援 DOM measurement）
- 測試：初始載入 `openFile.content`
- 測試：content 變更後預覽更新
- 測試：按下 Save 按鈕 emit 正確的 `file:save` 事件
- 測試：`isDirty` 狀態與 `●` 標記顯示邏輯

### FileViewPanel.test.tsx（更新）

- 測試：`.md` 副檔名 → 渲染 `MarkdownEditor`
- 測試：`.ts` / `.tsx` 等其他副檔名 → 渲染 `<pre>`

### 伺服器端

- 測試：`file:save` handler 寫檔成功 → 回傳 `file:saved`
- 測試：路徑穿越嘗試 → 回傳 `file:save:error`
- 測試：寫檔失敗 → 回傳 `file:save:error`

---

## 不在本次範圍

- 切換模式（原始碼 / 預覽）
- 自動儲存
- 多人同步編輯（Operational Transform / CRDT）
- `.md` 以外的檔案類型語法高亮（留待後續）
