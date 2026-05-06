# Panel Resize & Collapse Design

**Date:** 2026-05-04  
**Feature:** 每個 panel 可收合與拖曳調整大小

## 需求摘要

Paird 的三欄布局（左側邊欄、中間 Terminal、右側 Chat）需支援：
1. 每個側邊欄 panel 可完全收合（隱藏），邊緣留展開按鈕
2. 每個 panel 之間有拖曳把手，可調整各欄寬度
3. 收合狀態與寬度**不需要**跨 session 記憶（每次重置為預設值）

## 技術方案

採用 **`react-resizable-panels`** 套件（headless resize 元件庫）：
- 內建 `panel.collapse()` / `panel.expand()` API 支援完全收合
- Headless 設計，樣式完全自製
- 處理拖曳邊界、pointer event、鍵盤無障礙操作

## 視覺設計

**拖曳把手（ResizeHandle）：**
- 常駐顯示 3 個垂直排列小圓點
- hover 時圓點變亮
- cursor 切換為 `col-resize`

**收合按鈕：**
- 左側 Panel：右上角顯示「‹」，收合後變「›」
- 右側 Panel：左上角顯示「›」，收合後變「‹」
- 收合後 panel 完全隱藏，只剩展開按鈕留在邊緣

**Panel 寬度限制：**
- 左側：最小 15%，預設 20%
- 中間 Terminal：最小 30%
- 右側：最小 15%，預設 25%

## 架構

### 修改的檔案

| 檔案 | 變更內容 |
|------|---------|
| `src/client/components/MainScreen.tsx` | 替換三欄 flex 布局為 `PanelGroup` + `Panel` + `PanelResizeHandle` |
| `src/client/components/ResizeHandle.tsx` | 新增，自製圓點把手元件 |
| `src/client/index.css` | 加入 `react-resizable-panels` 所需樣式（主要是 `[data-panel-group]` 相關） |
| `package.json` | 新增依賴 `react-resizable-panels` |

### 不需要修改的檔案

- `src/client/store.ts` — 不需要儲存 panel 狀態
- `src/client/socket.ts` — 無變更
- 所有 server 端程式碼 — 無變更
- 各個 panel 元件（ChatPanel、TaskPanel、GitPanel 等）— 不需改動

## 元件結構

```tsx
// MainScreen.tsx 核心結構
<PanelGroup direction="horizontal" className="h-full">
  <Panel
    ref={leftPanelRef}
    defaultSize={20}
    minSize={15}
    collapsible
    onCollapse={() => setLeftCollapsed(true)}
    onExpand={() => setLeftCollapsed(false)}
  >
    <LeftSidebar collapsed={leftCollapsed} onExpand={() => leftPanelRef.current?.expand()} />
  </Panel>

  <ResizeHandle />

  <Panel minSize={30}>
    <WorkspaceTabs />
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
    <RightSidebar collapsed={rightCollapsed} onExpand={() => rightPanelRef.current?.expand()} />
  </Panel>
</PanelGroup>
```

## 狀態管理

- `leftCollapsed: boolean` — React local state，驅動展開按鈕顯示
- `rightCollapsed: boolean` — 同上
- Panel 寬度由 `react-resizable-panels` 內部管理，不進 Zustand store
- 不使用 localStorage，重整頁面後恢復預設值

## 測試考量

- 現有的 component test（`MainScreen` 相關）需確認 `PanelGroup` 在 jsdom 環境下不會報錯（套件有提供 mock 支援）
- 手動測試：左右收合、展開、拖曳縮放、Terminal 最小寬度限制
