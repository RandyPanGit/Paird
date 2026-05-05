export interface User {
  socketId: string;
  name: string;
  joinedAt: Date;
  isDriver: boolean;
}

export type AgentStatus = 'idle' | 'running' | 'stopped';
export type ChatMessageType = 'user' | 'system';

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  content: string;
  timestamp: Date;
  type: ChatMessageType;
}

export interface AppErrorPayload {
  code:
    | 'AGENT_NOT_RUNNING'
    | 'NOT_DRIVER'
    | 'INVALID_COMMAND'
    | 'UNKNOWN_COMMAND'
    | 'TASK_DESCRIPTION_REQUIRED'
    | 'PASS_TARGET_NOT_FOUND'
    | 'PASS_TARGET_AMBIGUOUS'
    | 'PASS_TARGET_SELF'
    | 'GIT_REPO_REQUIRED'
    | 'COMMIT_MESSAGE_REQUIRED'
    | 'GIT_COMMAND_FAILED';
  message: string;
}

export interface FsNode {
  name: string
  path: string
  type: 'file' | 'dir'
}

export type GitHistoryKind = 'log';
export type WorkspaceTab = 'agent-output' | 'git-history' | string;

export interface GitHistoryItem {
  id: string;
  kind: GitHistoryKind;
  command: string;
  summary: string;
  content: string;
  createdAt: string;
}

export interface GitStatus {
  branch: string
  modified: string[]
  added: string[]
  deleted: string[]
  lastUpdated: Date
}

export interface SessionState {
  driverId: string | null;
  users: User[];
  projectPath: string | null;
  projectName: string | null;
  agentStatus: AgentStatus;
  chatHistory: ChatMessage[];
  gitStatus: GitStatus | null;
}

export interface ValidatePathResult {
  exists: boolean;
  isDirectory: boolean;
  isGitRepo: boolean;
  projectName: string;
}

export interface ConnectionInfo {
  mode: 'lan' | 'token';
  defaultAddress: string;
  requiresToken: false;
}

export interface TerminalResizePayload {
  cols: number;
  rows: number;
}
