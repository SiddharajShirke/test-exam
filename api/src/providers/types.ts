/**
 * Provider interfaces and their fake implementations.
 * Real Azure implementations are in:
 *   src/providers/ai/azure.ts
 *   src/providers/email/azure.ts
 *   src/providers/files/azure.ts  (uses the same @azure/storage-blob client)
 */

// ─── AI Provider ─────────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  type: "mcq" | "cognitive" | "descriptive";
  question: string;
  options?: string[]; // mcq and cognitive
  correct?: string; // A|B|C|D for mcq and cognitive
  explanation?: string;
  rubric?: string; // descriptive
  maxScore?: number; // descriptive
  wordLimit?: number; // descriptive
}

export interface GenerateQuestionsInput {
  jobDescription: string;
  type: "mcq" | "cognitive" | "descriptive";
  domain: string;
  difficulty: "easy" | "medium" | "hard";
  count: number;
}

export interface MarkAnswerInput {
  question: string;
  rubric: string;
  maxScore: number;
  answer: string;
}

export interface MarkAnswerResult {
  score: number;
  justification: string;
}

export interface AiProvider {
  generateQuestions(input: GenerateQuestionsInput): Promise<GeneratedQuestion[]>;
  markAnswer(input: MarkAnswerInput): Promise<MarkAnswerResult>;
}

// ─── Email Provider ───────────────────────────────────────────────────────────

export interface SendInviteInput {
  to: string;
  name: string;
  title: string;
  durationMinutes: number;
  link: string;
  expiresAt: Date;
}

export interface SendInviteResult {
  messageId: string;
}

export interface EmailProvider {
  sendInvite(input: SendInviteInput): Promise<SendInviteResult>;
}

// ─── Files Provider ───────────────────────────────────────────────────────────

export interface SaveJdInput {
  tenantId: string;
  assessmentId: string;
  fileName: string;
  content: Buffer;
  contentType: string;
}

export interface FilesProvider {
  saveJd(input: SaveJdInput): Promise<{ path: string }>;
  getJd(path: string): Promise<Buffer>;
  deleteJd(path: string): Promise<void>;
}

