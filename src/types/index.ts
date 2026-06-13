export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  id: string;
  title: string;
  channel: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatState {
  sessions: Record<string, Session[]>;
  currentChannel: string;
  currentSessionId: string | null;
  isStreaming: boolean;
}
