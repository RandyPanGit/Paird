# paird

[繁體中文說明](README.zh-TW.md)

`paird` is a real-time pair programming tool for teams working with an AI coding agent. It is built around a simple idea: AI-assisted development should not be limited to one developer pairing alone with an agent. Human collaborators should stay in the same workflow as active navigators.

### Purpose

Most AI coding workflows are still built for a single operator. `paird` extends that into a shared collaboration space where developers can work not only with an AI agent, but also with each other in the same session.

The project is designed for a three-way workflow:

- `Driver`: operates the shared terminal session and directly controls the agent
- `Navigator`: observes, guides, reviews, and proposes next steps
- `AI Agent`: executes commands, edits code, and responds in context

This keeps human discussion, judgment, and review in the same flow as AI execution instead of pushing collaboration into separate tools or conversations.

### Core Features

- Shared terminal session backed by a single AI agent process
- `Driver` / `Navigator` collaboration model
- Real-time chat for coordination during coding sessions
- File tree browser with in-session file viewing
- Live session state synchronized across connected users
- Adjustable UI font size with persistent preference

### Collaboration Model

`paird` is built for pair programming with both humans and AI:

- `Driver` controls the terminal and sends direct input to the agent
- `Navigator` contributes through chat and review feedback
- The `AI Agent` acts as the execution partner inside the shared session

This structure preserves the discussion and review strengths of classic pair programming while adding the speed and execution support of AI assistance.

### How It Works

1. A user joins the session and becomes the `Driver`
2. The `Driver` starts an AI agent in a target project directory
3. Other users join as `Navigators`
4. The `Driver` uses the shared terminal while navigators guide through chat
5. The app keeps everyone aligned with real-time terminal output

### Quick Start

```bash
npm install
npm run dev
```

Open your browser at `http://localhost:5173` (local) or `http://<your-ip>:5173` (LAN).

Useful commands:

```bash
npm run dev         # run client + server
npm run dev:client  # run the Vite frontend only
npm run dev:server  # run the Express server only
npm test            # run the Vitest suite
npm run build       # build client and server
npm start           # run the production server (port 3000)
```

### Tech Stack

- React + Vite for the client
- Express + Socket.IO for the server
- `node-pty` for the shared terminal process
- TypeScript across client, server, and shared types

### Project Structure

```text
src/client   # React UI
src/server   # Express, sockets, PTY, git integration
src/shared   # shared TypeScript types
public/      # production frontend build output
dist/server/ # compiled server output
```
