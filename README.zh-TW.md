# paird

`paird` 是一個讓團隊與 AI coding agent 即時協作的 pair programming 工具。它的核心概念很簡單：AI 輔助開發不該只是單一開發者和 agent 的一對一互動，真人協作者也應該留在同一個工作流程中，以 `Navigator` 的角色參與。

### 專案目的

多數 AI coding workflow 仍然偏向單人操作。`paird` 希望把這件事延伸成共享協作空間，讓開發者不只是和 AI agent pair，也能和其他開發者一起在同一個 session 中工作。

這個專案想支援的是三方協作模式：

- `Driver`：操作共享 terminal，直接控制 agent
- `Navigator`：觀察、引導、審查，並提出下一步建議
- `AI Agent`：執行指令、修改程式碼，並在當前脈絡中回應

這樣的設計讓人類的討論、判斷與 review 可以和 AI 執行過程保持在同一條工作流裡，而不是分散在外部工具或對話之外。

### 核心功能

- 由單一 AI agent process 支撐的共享 terminal session
- `Driver` / `Navigator` 協作模式
- 用於協作溝通的即時聊天
- 在 session 內瀏覽與開啟專案檔案
- 跨使用者即時同步 session 狀態
- 可調整介面字體大小，設定自動記憶

### 協作模式

`paird` 的設計目標，是讓人類與 AI 一起進行 pair programming：

- `Driver` 控制 terminal，直接把輸入送給 agent
- `Navigator` 透過 chat 與 review feedback 參與協作
- `AI Agent` 作為共享 session 內的執行夥伴

這樣的結構保留了傳統 pair programming 的討論與審查優勢，同時加入 AI 協助帶來的速度與執行力。

### 運作方式

1. 某位使用者加入 session，成為 `Driver`
2. `Driver` 在指定專案目錄中啟動 AI agent
3. 其他使用者以 `Navigator` 身分加入
4. `Driver` 操作共享 terminal，`Navigator` 透過 chat 提供引導
5. 系統即時同步 terminal 輸出，讓所有人保持同一脈絡

### 快速開始

```bash
npm install
npm run dev
```

開啟瀏覽器連線至 `http://localhost:5173`（本機）或 `http://<你的IP>:5173`（區網）。

常用指令：

```bash
npm run dev         # 同時啟動 client 與 server
npm run dev:client  # 只啟動 Vite frontend
npm run dev:server  # 只啟動 Express server
npm test            # 執行 Vitest 測試
npm run build       # 建置 client 與 server
npm start           # 啟動正式環境 server（port 3000）
```

### 技術架構

- React + Vite：前端介面
- Express + Socket.IO：後端與即時同步
- `node-pty`：共享 terminal process
- TypeScript：client、server 與 shared types 共用

### 專案結構

```text
src/client   # React UI
src/server   # Express、sockets、PTY、git 整合
src/shared   # 共用 TypeScript types
public/      # 前端正式建置輸出
dist/server/ # 編譯後的 server 輸出
```
