# Panel Resize & Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Paird 三欄布局（左側邊欄、中間 Terminal、右側 Chat）支援收合與拖曳調整大小。

**Architecture:** 用 `react-resizable-panels` 套件的 `PanelGroup`/`Panel`/`PanelResizeHandle` 替換 `MainScreen.tsx` 的 flex 三欄布局。左右兩側 Panel 各有收合按鈕，收合後完全隱藏、邊緣留展開按鈕。收合狀態存在 React local state，不 persist。

**Tech Stack:** React 18, react-resizable-panels, Tailwind CSS, Vitest + Testing Library

---

## File Map

| 動作 | 路徑 | 說明 |
|------|------|------|
| Modify | `package.json` | 新增 `react-resizable-panels` 依賴 |
| Create | `src/client/components/ResizeHandle.tsx` | 自製圓點把手元件 |
| Modify | `src/client/screens/MainScreen.tsx` | 替換三欄 flex 為 PanelGroup 布局 |
| Modify | `src/client/index.css` | 加入 panel group 所需 CSS |

---

### Task 1: 安裝 react-resizable-panels

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安裝套件**

```bash
npm install react-resizable-panels
```

Expected: 套件出現在 `package.json` dependencies，`node_modules/react-resizable-panels` 存在。

- [ ] **Step 2: 確認型別可用**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 無錯誤（或只有預先存在的錯誤，不含 `react-resizable-panels` 相關錯誤）。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-resizable-panels dependency"
```

---

### Task 2: 建立 ResizeHandle 元件

**Files:**
- Create: `src/client/components/ResizeHandle.tsx`

- [ ] **Step 1: 建立元件**

建立 `src/client/components/ResizeHandle.tsx`：

```tsx
import { PanelResizeHandle } from 'react-resizable-panels'

export default function ResizeHandle() {
  return (
    <PanelResizeHandle className="group flex w-2 items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors cursor-col-resize">
      <div className="flex flex-col gap-1">
        <div className="h-1 w-1 rounded-full bg-gray-600 group-hover:bg-gray-400 transition-colors" />
        <div className="h-1 w-1 rounded-full bg-gray-600 group-hover:bg-gray-400 transition-colors" />
        <div className="h-1 w-1 rounded-full bg-gray-600 group-hover:bg-gray-400 transition-colors" />
      </div>
    </PanelResizeHandle>
  )
}
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit 2>&1 | grep ResizeHandle
```

Expected: 無輸出。

- [ ] **Step 3: Commit**

```bash
git add src/client/components/ResizeHandle.tsx
git commit -m "feat: add ResizeHandle component with dot grip"
```

---

### Task 3: 重構 MainScreen 為 PanelGroup 布局

**Files:**
- Modify: `src/client/screens/MainScreen.tsx`
- Modify: `src/client/index.css`

- [ ] **Step 1: 加入 CSS（react-resizable-panels 需要 panel group 有明確高度）**

在 `src/client/index.css` 末尾加入：

```css
/* react-resizable-panels: panel group 需要明確高度才能正確計算比例 */
[data-panel-group] {
  height: 100%;
}
```

- [ ] **Step 2: 重寫 MainScreen.tsx**

完整替換 `src/client/screens/MainScreen.tsx` 內容：

```tsx
import { useRef, useState } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import Header from '../components/Header'
import AgentControlBar from '../components/AgentControlBar'
import WorkspaceTabs from '../components/WorkspaceTabs'
import ChatPanel from '../components/ChatPanel'
import TaskPanel from '../components/TaskPanel'
import GitPanel from '../components/GitPanel'
import ResizeHandle from '../components/ResizeHandle'
import type { ImperativePanelHandle } from 'react-resizable-panels'

export default function MainScreen() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      <Header />
      <AgentControlBar />
      <div className="flex flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          {/* 左側收合展開按鈕（收合後顯示） */}
          {leftCollapsed && (
            <button
              onClick={() => leftPanelRef.current?.expand()}
              className="flex w-5 items-center justify-center bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="展開左側面板"
            >
              ›
            </button>
          )}

          <Panel
            ref={leftPanelRef}
            defaultSize={20}
            minSize={15}
            collapsible
            onCollapse={() => setLeftCollapsed(true)}
            onExpand={() => setLeftCollapsed(false)}
          >
            <aside className="flex h-full flex-col gap-4 p-4 overflow-hidden">
              {/* 收合按鈕（展開時顯示） */}
              <div className="flex justify-end">
                <button
                  onClick={() => leftPanelRef.current?.collapse()}
                  className="text-xs text-gray-500 hover:text-white px-1"
                  aria-label="收合左側面板"
                >
                  ‹
                </button>
              </div>
              <TaskPanel />
              <GitPanel />
            </aside>
          </Panel>

          <ResizeHandle />

          <Panel minSize={30}>
            <main className="flex h-full flex-col">
              <WorkspaceTabs />
            </main>
          </Panel>

          <ResizeHandle />

          <Panel
            ref={rightPanelRef}
            defaultSize={25}
            minSize={15}
            collapsible
            onCollapse={() => setRightCollapsed(true)}
            onExpand={() => setRightCollapsed(false)}
          >
            <aside className="flex h-full flex-col p-4 overflow-hidden">
              {/* 收合按鈕（展開時顯示） */}
              <div className="flex justify-start">
                <button
                  onClick={() => rightPanelRef.current?.collapse()}
                  className="text-xs text-gray-500 hover:text-white px-1"
                  aria-label="收合右側面板"
                >
                  ›
                </button>
              </div>
              <ChatPanel />
            </aside>
          </Panel>

          {/* 右側收合展開按鈕（收合後顯示） */}
          {rightCollapsed && (
            <button
              onClick={() => rightPanelRef.current?.expand()}
              className="flex w-5 items-center justify-center bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="展開右側面板"
            >
              ‹
            </button>
          )}
        </PanelGroup>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 無新增錯誤。

- [ ] **Step 4: 跑現有測試確認不破壞**

```bash
npx vitest run src/client/screens/MainScreen.test.tsx
```

Expected: 可能出現與 `react-resizable-panels` 在 jsdom 環境相關的錯誤，進入 Task 4 修復。若全部通過直接 commit。

- [ ] **Step 5: Commit（若測試通過）**

```bash
git add src/client/screens/MainScreen.tsx src/client/index.css
git commit -m "feat: replace flex layout with resizable panel group"
```

---

### Task 4: 修復測試環境中的 react-resizable-panels 相容性

> 只有在 Task 3 Step 4 測試失敗時才執行此 Task。

**Files:**
- Modify: `src/client/screens/MainScreen.test.tsx`

`react-resizable-panels` 在 jsdom 中需要 mock `ResizeObserver`，且 `PanelGroup` 需要容器有實際尺寸。

- [ ] **Step 1: 在測試檔案頂部加入 ResizeObserver mock**

在 `src/client/screens/MainScreen.test.tsx` 的 import 區塊之後、`vi.mock` 之前加入：

```tsx
// react-resizable-panels 在 jsdom 環境需要 ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
```

- [ ] **Step 2: 跑測試確認通過**

```bash
npx vitest run src/client/screens/MainScreen.test.tsx
```

Expected: 所有測試通過（PASS）。若仍失敗，檢查錯誤訊息——若是 `getBoundingClientRect` 回傳 0 導致 panel 無法渲染，在同一個 mock 區塊加入：

```tsx
Element.prototype.getBoundingClientRect = () => ({
  width: 1200,
  height: 800,
  top: 0,
  left: 0,
  bottom: 800,
  right: 1200,
  x: 0,
  y: 0,
  toJSON: () => {},
})
```

- [ ] **Step 3: Commit**

```bash
git add src/client/screens/MainScreen.test.tsx
git commit -m "test: fix jsdom compatibility for react-resizable-panels"
```

---

### Task 5: 手動驗收測試

- [ ] **Step 1: 啟動開發伺服器**

```bash
npm run dev
```

打開 http://localhost:5173，以 driver 身分進入 MainScreen。

- [ ] **Step 2: 驗證拖曳把手**

拖曳左側分隔線（圓點把手），確認：
- 左側 panel 寬度跟著改變
- 中間 Terminal 寬度相應調整
- 左側不能小於約 15% 寬度
- 圓點 hover 時變亮

- [ ] **Step 3: 驗證右側把手**

拖曳右側分隔線，確認：
- 右側 ChatPanel 寬度改變
- 中間 Terminal 最小 30% 限制有效

- [ ] **Step 4: 驗證左側收合**

點擊左側 panel 頂部的「‹」按鈕，確認：
- 左側 panel 完全隱藏
- 邊緣出現「›」展開按鈕
- 中間 Terminal 佔滿空出的空間
- 點「›」後左側 panel 恢復

- [ ] **Step 5: 驗證右側收合**

點擊右側 panel 頂部的「›」按鈕，確認：
- 右側 ChatPanel 完全隱藏
- 邊緣出現「‹」展開按鈕
- 點「‹」後右側 panel 恢復

- [ ] **Step 6: 確認重整後重置**

調整 panel 大小後重整頁面（F5），確認回到預設比例（左 20%、右 25%）。

- [ ] **Step 7: 跑全部測試**

```bash
npm test
```

Expected: 全部通過。

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: panel resize and collapse complete"
```
