export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export enum Mood {
  NEUTRAL = 'NEUTRAL',
  CALM = 'CALM',
  INTENSE = 'INTENSE',
  JOYFUL = 'JOYFUL',
  MELANCHOLIC = 'MELANCHOLIC',
  MYSTERIOUS = 'MYSTERIOUS'
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  mood?: Mood;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: number;
}