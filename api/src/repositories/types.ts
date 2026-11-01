/**
 * Repository Domain Models, DTOs, and Interfaces
 */

// ── Shared Helper ────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertTenant(tenantId: string): void {
  if (!tenantId || typeof tenantId !== "string" || !UUID_REGEX.test(tenantId)) {
    throw new Error("tenantId required: must be a valid UUID");
  }
}

// ── Models ───────────────────────────────────────────────────────────────────

export type Tenant = {
  id: string;
  name: string;
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
};

export type UserRole = "admin" | "recruiter" | "reviewer";
export type UserStatus = "active" | "disabled";

export type User = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Session = {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type LoginAttempt = {
  id: string;
  email: string;
  ipAddress: string;
  attemptedAt: Date;
  success: boolean;
};

export type AssessmentStatus = "draft" | "approved" | "open" | "closed";

export type SectionConfig = {
  type: "mcq" | "descriptive" | "cognitive";
  domain?: string;
  difficulty?: "easy" | "medium" | "hard";
  count: number;
};

export type Assessment = {
  id: string;
  tenantId: string;
  title: string;
  jobDescription?: string | null;
  jdFileName?: string | null;
  durationMinutes: number;
  passingScore: number;
  status: AssessmentStatus;
  sections: SectionConfig[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AssessmentListItem = {
  id: string;
  title: string;
  status: AssessmentStatus;
  participantCount: number;
  submittedCount: number;
  createdAt: Date;
};

export type QuestionType = "mcq" | "descriptive" | "cognitive";
export type QuestionSource = "ai" | "custom";

export type Question = {
  id: string;
  tenantId: string;
  assessmentId: string;
  sectionIndex: number;
  type: QuestionType;
  body: string;
  options?: string[] | null;
  correctAnswer?: string | null;
  rubric?: string | null;
  maxScore: number;
  source: QuestionSource;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ParticipantInviteStatus = "none" | "queued" | "sent" | "failed";

export type Participant = {
  id: string;
  tenantId: string;
  assessmentId: string;
  name: string;
  email: string;
  inviteStatus: ParticipantInviteStatus;
  tokenHash?: string | null;
  tokenExpiresAt?: Date | null;
  invitedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ParticipantListItem = {
  id: string;
  name: string;
  email: string;
  inviteStatus: ParticipantInviteStatus;
  attemptStatus: AttemptStatus | "not_started";
  percent?: number | null;
};

export type AttemptStatus = "in_progress" | "submitted" | "scored" | "needs_review";

export type Attempt = {
  id: string;
  tenantId: string;
  participantId: string;
  assessmentId: string;
  attemptTokenHash: string;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt?: Date | null;
  status: AttemptStatus;
  score?: number | null;
  maxScore?: number | null;
  percent?: number | null;
  passed?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AttemptListItem = {
  attemptId: string;
  name: string;
  email: string;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  passed: boolean | null;
  timeTakenSec: number | null;
  status: AttemptStatus;
};

export type Response = {
  id: string;
  tenantId: string;
  attemptId: string;
  questionId: string;
  answerText?: string | null;
  savedAt: Date;
};

export type ScoreSource = "auto" | "ai" | "manual";

export type Score = {
  id: string;
  tenantId: string;
  attemptId: string;
  questionId: string;
  score: number;
  maxScore: number;
  source: ScoreSource;
  justification?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JobType = "generate" | "mark" | "email";
export type JobStatus = "queued" | "running" | "done" | "failed";

export type Job = {
  id: string;
  tenantId: string;
  type: JobType;
  status: JobStatus;
  refId: string;
  payload: unknown;
  result?: unknown | null;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLogEntry = {
  id: string;
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: unknown | null;
  createdAt: Date;
};

// ── Repository Interfaces ────────────────────────────────────────────────────

export interface TenantsRepository {
  create(data: { id?: string; name: string }): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
}

export interface UsersRepository {
  create(
    tenantId: string,
    data: {
      id?: string;
      name: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      status?: UserStatus;
    }
  ): Promise<User>;
  findById(tenantId: string, id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(tenantId: string): Promise<User[]>;
  update(
    tenantId: string,
    id: string,
    data: Partial<Pick<User, "name" | "role" | "status">>
  ): Promise<User | null>;
}

export interface SessionsRepository {
  create(
    tenantId: string,
    data: { id?: string; userId: string; tokenHash: string; expiresAt: Date }
  ): Promise<Session>;
  findByTokenHash(
    tokenHash: string
  ): Promise<{ session: Session; user: User; tenant: Tenant } | null>;
  deleteByTokenHash(tokenHash: string): Promise<boolean>;
  deleteByUserId(tenantId: string, userId: string): Promise<number>;
}

export interface LoginAttemptsRepository {
  record(data: { id?: string; email: string; ipAddress: string; success: boolean }): Promise<void>;
  countRecentFailures(email: string, since: Date): Promise<number>;
}

export interface AssessmentsRepository {
  create(
    tenantId: string,
    data: {
      id?: string;
      title: string;
      jobDescription?: string;
      durationMinutes?: number;
      passingScore?: number;
      sections: SectionConfig[];
      createdBy: string;
    }
  ): Promise<Assessment>;
  findById(tenantId: string, id: string): Promise<Assessment | null>;
  list(tenantId: string, filter?: { status?: AssessmentStatus }): Promise<AssessmentListItem[]>;
  update(
    tenantId: string,
    id: string,
    data: Partial<
      Pick<
        Assessment,
        "title" | "jobDescription" | "jdFileName" | "durationMinutes" | "passingScore" | "status" | "sections"
      >
    >
  ): Promise<Assessment | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

export interface QuestionsRepository {
  create(
    tenantId: string,
    data: {
      id?: string;
      assessmentId: string;
      sectionIndex?: number;
      type: QuestionType;
      body: string;
      options?: string[];
      correctAnswer?: string;
      rubric?: string;
      maxScore?: number;
      source?: QuestionSource;
      position?: number;
    }
  ): Promise<Question>;
  createMany(
    tenantId: string,
    items: Array<{
      id?: string;
      assessmentId: string;
      sectionIndex?: number;
      type: QuestionType;
      body: string;
      options?: string[];
      correctAnswer?: string;
      rubric?: string;
      maxScore?: number;
      source?: QuestionSource;
      position?: number;
    }>
  ): Promise<Question[]>;
  findById(tenantId: string, id: string): Promise<Question | null>;
  listByAssessment(tenantId: string, assessmentId: string): Promise<Question[]>;
  update(
    tenantId: string,
    id: string,
    data: Partial<
      Pick<
        Question,
        "body" | "options" | "correctAnswer" | "rubric" | "maxScore" | "position"
      >
    >
  ): Promise<Question | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
  deleteByAssessmentAndSource(
    tenantId: string,
    assessmentId: string,
    sectionIndex: number,
    source: QuestionSource
  ): Promise<number>;
}

export interface ParticipantsRepository {
  createMany(
    tenantId: string,
    assessmentId: string,
    items: Array<{ name: string; email: string }>
  ): Promise<{ added: Participant[]; duplicates: string[]; invalid: string[] }>;
  listByAssessment(tenantId: string, assessmentId: string): Promise<ParticipantListItem[]>;
  findById(tenantId: string, id: string): Promise<Participant | null>;
  findByTokenHash(
    tokenHash: string
  ): Promise<{ participant: Participant; assessment: Assessment; tenant: Tenant } | null>;
  updateToken(
    tenantId: string,
    id: string,
    tokenHash: string | null,
    expiresAt: Date | null
  ): Promise<void>;
  updateInviteStatus(
    tenantId: string,
    id: string,
    status: ParticipantInviteStatus,
    invitedAt?: Date
  ): Promise<void>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

export interface AttemptsRepository {
  create(
    tenantId: string,
    data: {
      id?: string;
      participantId: string;
      assessmentId: string;
      attemptTokenHash: string;
      deadlineAt: Date;
    }
  ): Promise<Attempt>;
  findById(tenantId: string, id: string): Promise<Attempt | null>;
  findByParticipantId(tenantId: string, participantId: string): Promise<Attempt | null>;
  findByAttemptTokenHash(
    tokenHash: string
  ): Promise<{ attempt: Attempt; participant: Participant; assessment: Assessment; tenant: Tenant } | null>;
  updateStatus(
    tenantId: string,
    id: string,
    status: AttemptStatus,
    submittedAt?: Date
  ): Promise<Attempt | null>;
  updateScores(
    tenantId: string,
    id: string,
    data: {
      score: number;
      maxScore: number;
      percent: number;
      passed: boolean;
      status?: AttemptStatus;
    }
  ): Promise<Attempt | null>;
  listByAssessment(
    tenantId: string,
    assessmentId: string,
    sort?: "score" | "name"
  ): Promise<AttemptListItem[]>;
}

export interface ResponsesRepository {
  upsert(
    tenantId: string,
    data: { attemptId: string; questionId: string; answerText: string }
  ): Promise<{ savedAt: Date }>;
  listByAttempt(tenantId: string, attemptId: string): Promise<Response[]>;
}

export interface ScoresRepository {
  upsert(
    tenantId: string,
    data: {
      attemptId: string;
      questionId: string;
      score: number;
      maxScore: number;
      source: ScoreSource;
      justification?: string;
    }
  ): Promise<Score>;
  listByAttempt(tenantId: string, attemptId: string): Promise<Score[]>;
}

export interface JobsRepository {
  enqueue(
    tenantId: string,
    data: {
      type: JobType;
      refId: string;
      payload: unknown;
      maxAttempts?: number;
    }
  ): Promise<Job>;
  findById(tenantId: string, id: string): Promise<Job | null>;
  claimNext(workerId: string): Promise<Job | null>;
  complete(id: string, result?: unknown): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  countDailyGenerations(tenantId: string, dateUtc: Date): Promise<number>;
}

export interface AuditRepository {
  log(
    tenantId: string,
    data: {
      actorId?: string;
      action: string;
      entityType: string;
      entityId: string;
      details?: unknown;
    }
  ): Promise<void>;
  listByEntity(tenantId: string, entityType: string, entityId: string): Promise<AuditLogEntry[]>;
}

export interface SystemRepository {
  claimNextJob(workerId: string): Promise<Job | null>;
  findExpiredAttempts(now: Date): Promise<Attempt[]>;
  findSessionByTokenHash(
    tokenHash: string
  ): Promise<{ session: Session; user: User; tenant: Tenant } | null>;
  findParticipantByTokenHash(
    tokenHash: string
  ): Promise<{ participant: Participant; assessment: Assessment; tenant: Tenant } | null>;
  findAttemptByTokenHash(
    tokenHash: string
  ): Promise<{ attempt: Attempt; participant: Participant; assessment: Assessment; tenant: Tenant } | null>;
}

export interface Repositories {
  tenants: TenantsRepository;
  users: UsersRepository;
  sessions: SessionsRepository;
  loginAttempts: LoginAttemptsRepository;
  assessments: AssessmentsRepository;
  questions: QuestionsRepository;
  participants: ParticipantsRepository;
  attempts: AttemptsRepository;
  responses: ResponsesRepository;
  scores: ScoresRepository;
  jobs: JobsRepository;
  audit: AuditRepository;
  system: SystemRepository;
  withTransaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
}
