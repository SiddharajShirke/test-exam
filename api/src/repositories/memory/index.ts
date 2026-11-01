import { Clock, SystemClock } from "../../lib/clock";
import { newId } from "../../lib/id";
import {
  assertTenant,
  Assessment,
  AssessmentListItem,
  AssessmentStatus,
  AssessmentsRepository,
  Attempt,
  AttemptListItem,
  AttemptStatus,
  AttemptsRepository,
  AuditLogEntry,
  AuditRepository,
  Job,
  JobsRepository,
  LoginAttempt,
  LoginAttemptsRepository,
  Participant,
  ParticipantListItem,
  ParticipantsRepository,
  Question,
  QuestionsRepository,
  Repositories,
  Response,
  ResponsesRepository,
  Score,
  ScoresRepository,
  Session,
  SessionsRepository,
  SystemRepository,
  Tenant,
  TenantsRepository,
  User,
  UserRole,
  UsersRepository,
  UserStatus,
} from "../types";

export interface MemoryStore {
  tenants: Map<string, Tenant>;
  users: Map<string, User>;
  sessions: Map<string, Session>;
  loginAttempts: LoginAttempt[];
  assessments: Map<string, Assessment>;
  questions: Map<string, Question>;
  participants: Map<string, Participant>;
  attempts: Map<string, Attempt>;
  responses: Map<string, Response>;
  scores: Map<string, Score>;
  jobs: Map<string, Job>;
  audit: AuditLogEntry[];
}

export function createInitialStore(): MemoryStore {
  return {
    tenants: new Map(),
    users: new Map(),
    sessions: new Map(),
    loginAttempts: [],
    assessments: new Map(),
    questions: new Map(),
    participants: new Map(),
    attempts: new Map(),
    responses: new Map(),
    scores: new Map(),
    jobs: new Map(),
    audit: [],
  };
}

function cloneStore(store: MemoryStore): MemoryStore {
  return {
    tenants: new Map(Array.from(store.tenants.entries()).map(([k, v]) => [k, { ...v }])),
    users: new Map(Array.from(store.users.entries()).map(([k, v]) => [k, { ...v }])),
    sessions: new Map(Array.from(store.sessions.entries()).map(([k, v]) => [k, { ...v }])),
    loginAttempts: store.loginAttempts.map((a) => ({ ...a })),
    assessments: new Map(
      Array.from(store.assessments.entries()).map(([k, v]) => [
        k,
        { ...v, sections: v.sections.map((s) => ({ ...s })) },
      ])
    ),
    questions: new Map(
      Array.from(store.questions.entries()).map(([k, v]) => [
        k,
        { ...v, options: v.options ? [...v.options] : undefined },
      ])
    ),
    participants: new Map(Array.from(store.participants.entries()).map(([k, v]) => [k, { ...v }])),
    attempts: new Map(Array.from(store.attempts.entries()).map(([k, v]) => [k, { ...v }])),
    responses: new Map(Array.from(store.responses.entries()).map(([k, v]) => [k, { ...v }])),
    scores: new Map(Array.from(store.scores.entries()).map(([k, v]) => [k, { ...v }])),
    jobs: new Map(Array.from(store.jobs.entries()).map(([k, v]) => [k, { ...v }])),
    audit: store.audit.map((a) => ({ ...a })),
  };
}

export class MemoryRepositories implements Repositories {
  public store: MemoryStore;
  private clock: Clock;

  constructor(clock: Clock = new SystemClock(), store?: MemoryStore) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Memory repository backend cannot be used when NODE_ENV=production");
    }
    this.clock = clock;
    this.store = store ?? createInitialStore();
  }

  // ── 1. Tenants ─────────────────────────────────────────────────────────────
  tenants: TenantsRepository = {
    create: async (data) => {
      const id = data.id || newId();
      if (this.store.tenants.has(id)) {
        throw new Error(`Tenant already exists with id ${id}`);
      }
      const tenant: Tenant = {
        id,
        name: data.name,
        status: "active",
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.store.tenants.set(id, tenant);
      return { ...tenant };
    },
    findById: async (id) => {
      const t = this.store.tenants.get(id);
      return t ? { ...t } : null;
    },
    list: async () => {
      return Array.from(this.store.tenants.values()).map((t) => ({ ...t }));
    },
  };

  // ── 2. Users ───────────────────────────────────────────────────────────────
  users: UsersRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      if (!this.store.tenants.has(tenantId)) {
        throw new Error(`Foreign key constraint failed: tenant ${tenantId} not found`);
      }
      const emailLower = data.email.toLowerCase().trim();
      // Check globally unique email (Decision R1)
      for (const u of this.store.users.values()) {
        if (u.email.toLowerCase() === emailLower) {
          throw new Error(`EMAIL_EXISTS: User with email ${data.email} already exists`);
        }
      }
      const id = data.id || newId();
      const user: User = {
        id,
        tenantId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        status: data.status || "active",
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.store.users.set(id, user);
      return { ...user };
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const u = this.store.users.get(id);
      if (!u || u.tenantId !== tenantId) return null;
      return { ...u };
    },
    findByEmail: async (email) => {
      // Cross-tenant lookup by email for login endpoint
      const emailLower = email.toLowerCase().trim();
      for (const u of this.store.users.values()) {
        if (u.email.toLowerCase() === emailLower) {
          return { ...u };
        }
      }
      return null;
    },
    list: async (tenantId) => {
      assertTenant(tenantId);
      return Array.from(this.store.users.values())
        .filter((u) => u.tenantId === tenantId)
        .map((u) => ({ ...u }));
    },
    update: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const u = this.store.users.get(id);
      if (!u || u.tenantId !== tenantId) return null;
      const updated: User = {
        ...u,
        name: data.name ?? u.name,
        role: (data.role as UserRole) ?? u.role,
        status: (data.status as UserStatus) ?? u.status,
        updatedAt: this.clock.now(),
      };
      this.store.users.set(id, updated);
      return { ...updated };
    },
  };

  // ── 3. Sessions ────────────────────────────────────────────────────────────
  sessions: SessionsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const user = this.store.users.get(data.userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: user not found in tenant");
      }
      const id = data.id || newId();
      const session: Session = {
        id,
        tenantId,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        createdAt: this.clock.now(),
      };
      this.store.sessions.set(id, session);
      return { ...session };
    },
    findByTokenHash: async (tokenHash) => {
      // Cross-tenant lookup by token hash for session resolution
      for (const s of this.store.sessions.values()) {
        if (s.tokenHash === tokenHash) {
          const user = this.store.users.get(s.userId);
          const tenant = this.store.tenants.get(s.tenantId);
          if (user && tenant) {
            return {
              session: { ...s },
              user: { ...user },
              tenant: { ...tenant },
            };
          }
        }
      }
      return null;
    },
    deleteByTokenHash: async (tokenHash) => {
      for (const [id, s] of this.store.sessions.entries()) {
        if (s.tokenHash === tokenHash) {
          this.store.sessions.delete(id);
          return true;
        }
      }
      return false;
    },
    deleteByUserId: async (tenantId, userId) => {
      assertTenant(tenantId);
      let count = 0;
      for (const [id, s] of this.store.sessions.entries()) {
        if (s.tenantId === tenantId && s.userId === userId) {
          this.store.sessions.delete(id);
          count++;
        }
      }
      return count;
    },
  };

  // ── 4. Login Attempts ──────────────────────────────────────────────────────
  loginAttempts: LoginAttemptsRepository = {
    record: async (data) => {
      this.store.loginAttempts.push({
        id: data.id || newId(),
        email: data.email.toLowerCase().trim(),
        ipAddress: data.ipAddress,
        attemptedAt: this.clock.now(),
        success: data.success,
      });
    },
    countRecentFailures: async (email, since) => {
      const emailLower = email.toLowerCase().trim();
      return this.store.loginAttempts.filter(
        (a) =>
          a.email === emailLower &&
          !a.success &&
          a.attemptedAt.getTime() >= since.getTime()
      ).length;
    },
  };

  // ── 5. Assessments ─────────────────────────────────────────────────────────
  assessments: AssessmentsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const user = this.store.users.get(data.createdBy);
      if (!user || user.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: createdBy user does not belong to tenant");
      }
      const id = data.id || newId();
      const assessment: Assessment = {
        id,
        tenantId,
        title: data.title,
        jobDescription: data.jobDescription || null,
        jdFileName: null,
        durationMinutes: data.durationMinutes ?? 60,
        passingScore: data.passingScore ?? 60,
        status: "draft",
        sections: data.sections.map((s) => ({ ...s })),
        createdBy: data.createdBy,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.store.assessments.set(id, assessment);
      return { ...assessment };
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const a = this.store.assessments.get(id);
      if (!a || a.tenantId !== tenantId) return null;
      return { ...a, sections: a.sections.map((s) => ({ ...s })) };
    },
    list: async (tenantId, filter) => {
      assertTenant(tenantId);
      const results: AssessmentListItem[] = [];
      for (const a of this.store.assessments.values()) {
        if (a.tenantId !== tenantId) continue;
        if (filter?.status && a.status !== filter.status) continue;

        const participantCount = Array.from(this.store.participants.values()).filter(
          (p) => p.tenantId === tenantId && p.assessmentId === a.id
        ).length;

        const submittedCount = Array.from(this.store.attempts.values()).filter(
          (att) =>
            att.tenantId === tenantId &&
            att.assessmentId === a.id &&
            att.status !== "in_progress"
        ).length;

        results.push({
          id: a.id,
          title: a.title,
          status: a.status,
          participantCount,
          submittedCount,
          createdAt: a.createdAt,
        });
      }
      return results;
    },
    update: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const a = this.store.assessments.get(id);
      if (!a || a.tenantId !== tenantId) return null;

      const updated: Assessment = {
        ...a,
        title: data.title ?? a.title,
        jobDescription: data.jobDescription !== undefined ? data.jobDescription : a.jobDescription,
        jdFileName: data.jdFileName !== undefined ? data.jdFileName : a.jdFileName,
        durationMinutes: data.durationMinutes ?? a.durationMinutes,
        passingScore: data.passingScore ?? a.passingScore,
        status: (data.status as AssessmentStatus) ?? a.status,
        sections: data.sections ? data.sections.map((s) => ({ ...s })) : a.sections,
        updatedAt: this.clock.now(),
      };
      this.store.assessments.set(id, updated);
      return { ...updated };
    },
    delete: async (tenantId, id) => {
      assertTenant(tenantId);
      const a = this.store.assessments.get(id);
      if (!a || a.tenantId !== tenantId) return false;
      if (a.status !== "draft") {
        throw new Error("Only draft assessments can be deleted");
      }
      // Cascading delete
      for (const [qid, q] of this.store.questions.entries()) {
        if (q.assessmentId === id) this.store.questions.delete(qid);
      }
      for (const [pid, p] of this.store.participants.entries()) {
        if (p.assessmentId === id) this.store.participants.delete(pid);
      }
      this.store.assessments.delete(id);
      return true;
    },
  };

  // ── 6. Questions ───────────────────────────────────────────────────────────
  questions: QuestionsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const assessment = this.store.assessments.get(data.assessmentId);
      if (!assessment || assessment.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: assessment does not belong to tenant");
      }
      const id = data.id || newId();
      const question: Question = {
        id,
        tenantId,
        assessmentId: data.assessmentId,
        sectionIndex: data.sectionIndex ?? 0,
        type: data.type,
        body: data.body,
        options: data.options ? [...data.options] : undefined,
        correctAnswer: data.correctAnswer || null,
        rubric: data.rubric || null,
        maxScore: data.maxScore ?? 10,
        source: data.source || "ai",
        position: data.position ?? 0,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.store.questions.set(id, question);
      return { ...question };
    },
    createMany: async (tenantId, items) => {
      assertTenant(tenantId);
      const result: Question[] = [];
      for (const item of items) {
        result.push(await this.questions.create(tenantId, item));
      }
      return result;
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const q = this.store.questions.get(id);
      if (!q || q.tenantId !== tenantId) return null;
      return { ...q, options: q.options ? [...q.options] : undefined };
    },
    listByAssessment: async (tenantId, assessmentId) => {
      assertTenant(tenantId);
      return Array.from(this.store.questions.values())
        .filter((q) => q.tenantId === tenantId && q.assessmentId === assessmentId)
        .sort((a, b) => a.position - b.position)
        .map((q) => ({ ...q, options: q.options ? [...q.options] : undefined }));
    },
    update: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const q = this.store.questions.get(id);
      if (!q || q.tenantId !== tenantId) return null;
      const updated: Question = {
        ...q,
        body: data.body ?? q.body,
        options: data.options !== undefined ? (data.options ? [...data.options] : undefined) : q.options,
        correctAnswer: data.correctAnswer !== undefined ? data.correctAnswer : q.correctAnswer,
        rubric: data.rubric !== undefined ? data.rubric : q.rubric,
        maxScore: data.maxScore ?? q.maxScore,
        position: data.position ?? q.position,
        updatedAt: this.clock.now(),
      };
      this.store.questions.set(id, updated);
      return { ...updated };
    },
    delete: async (tenantId, id) => {
      assertTenant(tenantId);
      const q = this.store.questions.get(id);
      if (!q || q.tenantId !== tenantId) return false;
      this.store.questions.delete(id);
      return true;
    },
    deleteByAssessmentAndSource: async (tenantId, assessmentId, sectionIndex, source) => {
      assertTenant(tenantId);
      let count = 0;
      for (const [id, q] of this.store.questions.entries()) {
        if (
          q.tenantId === tenantId &&
          q.assessmentId === assessmentId &&
          q.sectionIndex === sectionIndex &&
          q.source === source
        ) {
          this.store.questions.delete(id);
          count++;
        }
      }
      return count;
    },
  };

  // ── 7. Participants ────────────────────────────────────────────────────────
  participants: ParticipantsRepository = {
    createMany: async (tenantId, assessmentId, items) => {
      assertTenant(tenantId);
      const assessment = this.store.assessments.get(assessmentId);
      if (!assessment || assessment.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: assessment not found in tenant");
      }

      const added: Participant[] = [];
      const duplicates: string[] = [];
      const invalid: string[] = [];

      for (const item of items) {
        const emailLower = item.email.toLowerCase().trim();
        if (!emailLower || !emailLower.includes("@")) {
          invalid.push(item.email);
          continue;
        }

        // Check uniqueness per (tenantId, assessmentId, email)
        const isDuplicate = Array.from(this.store.participants.values()).some(
          (p) =>
            p.tenantId === tenantId &&
            p.assessmentId === assessmentId &&
            p.email.toLowerCase() === emailLower
        );

        if (isDuplicate) {
          duplicates.push(item.email);
          continue;
        }

        const id = newId();
        const participant: Participant = {
          id,
          tenantId,
          assessmentId,
          name: item.name.trim(),
          email: item.email.trim(),
          inviteStatus: "none",
          tokenHash: null,
          tokenExpiresAt: null,
          invitedAt: null,
          createdAt: this.clock.now(),
          updatedAt: this.clock.now(),
        };
        this.store.participants.set(id, participant);
        added.push({ ...participant });
      }

      return { added, duplicates, invalid };
    },
    listByAssessment: async (tenantId, assessmentId) => {
      assertTenant(tenantId);
      const list: ParticipantListItem[] = [];
      for (const p of this.store.participants.values()) {
        if (p.tenantId !== tenantId || p.assessmentId !== assessmentId) continue;

        let attemptStatus: AttemptStatus | "not_started" = "not_started";
        let percent: number | null = null;

        for (const att of this.store.attempts.values()) {
          if (att.participantId === p.id) {
            attemptStatus = att.status;
            percent = att.percent ?? null;
            break;
          }
        }

        list.push({
          id: p.id,
          name: p.name,
          email: p.email,
          inviteStatus: p.inviteStatus,
          attemptStatus,
          percent,
        });
      }
      return list;
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const p = this.store.participants.get(id);
      if (!p || p.tenantId !== tenantId) return null;
      return { ...p };
    },
    findByTokenHash: async (tokenHash) => {
      if (!tokenHash) return null;
      for (const p of this.store.participants.values()) {
        if (p.tokenHash === tokenHash) {
          const assessment = this.store.assessments.get(p.assessmentId);
          const tenant = this.store.tenants.get(p.tenantId);
          if (assessment && tenant) {
            return {
              participant: { ...p },
              assessment: { ...assessment },
              tenant: { ...tenant },
            };
          }
        }
      }
      return null;
    },
    updateToken: async (tenantId, id, tokenHash, expiresAt) => {
      assertTenant(tenantId);
      const p = this.store.participants.get(id);
      if (!p || p.tenantId !== tenantId) return;

      // Enforce filtered unique tokenHash (if not null)
      if (tokenHash) {
        for (const other of this.store.participants.values()) {
          if (other.id !== id && other.tokenHash === tokenHash) {
            throw new Error(`Duplicate tokenHash constraint violation: ${tokenHash}`);
          }
        }
      }

      p.tokenHash = tokenHash;
      p.tokenExpiresAt = expiresAt;
      p.updatedAt = this.clock.now();
    },
    updateInviteStatus: async (tenantId, id, status, invitedAt) => {
      assertTenant(tenantId);
      const p = this.store.participants.get(id);
      if (!p || p.tenantId !== tenantId) return;
      p.inviteStatus = status;
      if (invitedAt) p.invitedAt = invitedAt;
      p.updatedAt = this.clock.now();
    },
    delete: async (tenantId, id) => {
      assertTenant(tenantId);
      const p = this.store.participants.get(id);
      if (!p || p.tenantId !== tenantId) return false;
      this.store.participants.delete(id);
      return true;
    },
  };

  // ── 8. Attempts ────────────────────────────────────────────────────────────
  attempts: AttemptsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const participant = this.store.participants.get(data.participantId);
      if (!participant || participant.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: participant does not belong to tenant");
      }
      // Unique attempt per participant
      for (const att of this.store.attempts.values()) {
        if (att.participantId === data.participantId) {
          throw new Error("Constraint violation: attempt already exists for participant");
        }
        if (att.attemptTokenHash === data.attemptTokenHash) {
          throw new Error("Constraint violation: attemptTokenHash already exists");
        }
      }
      const id = data.id || newId();
      const attempt: Attempt = {
        id,
        tenantId,
        participantId: data.participantId,
        assessmentId: data.assessmentId,
        attemptTokenHash: data.attemptTokenHash,
        startedAt: this.clock.now(),
        deadlineAt: data.deadlineAt,
        submittedAt: null,
        status: "in_progress",
        score: null,
        maxScore: null,
        percent: null,
        passed: null,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.store.attempts.set(id, attempt);
      return { ...attempt };
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const att = this.store.attempts.get(id);
      if (!att || att.tenantId !== tenantId) return null;
      return { ...att };
    },
    findByParticipantId: async (tenantId, participantId) => {
      assertTenant(tenantId);
      for (const att of this.store.attempts.values()) {
        if (att.tenantId === tenantId && att.participantId === participantId) {
          return { ...att };
        }
      }
      return null;
    },
    findByAttemptTokenHash: async (tokenHash) => {
      for (const att of this.store.attempts.values()) {
        if (att.attemptTokenHash === tokenHash) {
          const participant = this.store.participants.get(att.participantId);
          const assessment = this.store.assessments.get(att.assessmentId);
          const tenant = this.store.tenants.get(att.tenantId);
          if (participant && assessment && tenant) {
            return {
              attempt: { ...att },
              participant: { ...participant },
              assessment: { ...assessment },
              tenant: { ...tenant },
            };
          }
        }
      }
      return null;
    },
    updateStatus: async (tenantId, id, status, submittedAt) => {
      assertTenant(tenantId);
      const att = this.store.attempts.get(id);
      if (!att || att.tenantId !== tenantId) return null;
      att.status = status;
      if (submittedAt !== undefined) att.submittedAt = submittedAt;
      att.updatedAt = this.clock.now();
      return { ...att };
    },
    updateScores: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const att = this.store.attempts.get(id);
      if (!att || att.tenantId !== tenantId) return null;
      att.score = data.score;
      att.maxScore = data.maxScore;
      att.percent = data.percent;
      att.passed = data.passed;
      if (data.status) att.status = data.status;
      att.updatedAt = this.clock.now();
      return { ...att };
    },
    listByAssessment: async (tenantId, assessmentId, sort = "score") => {
      assertTenant(tenantId);
      const list: AttemptListItem[] = [];
      for (const att of this.store.attempts.values()) {
        if (att.tenantId !== tenantId || att.assessmentId !== assessmentId) continue;
        const p = this.store.participants.get(att.participantId);
        const timeTaken = att.submittedAt
          ? Math.round((att.submittedAt.getTime() - att.startedAt.getTime()) / 1000)
          : null;

        list.push({
          attemptId: att.id,
          name: p ? p.name : "Unknown",
          email: p ? p.email : "Unknown",
          score: att.score ?? null,
          maxScore: att.maxScore ?? null,
          percent: att.percent ?? null,
          passed: att.passed ?? null,
          timeTakenSec: timeTaken,
          status: att.status,
        });
      }

      if (sort === "score") {
        list.sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }

      return list;
    },
  };

  // ── 9. Responses ───────────────────────────────────────────────────────────
  responses: ResponsesRepository = {
    upsert: async (tenantId, data) => {
      assertTenant(tenantId);
      const attempt = this.store.attempts.get(data.attemptId);
      if (!attempt || attempt.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: attempt not found in tenant");
      }
      const question = this.store.questions.get(data.questionId);
      if (!question || question.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: question not found in tenant");
      }

      // Check deadline + 15 s grace window (Decision R10 / B4 row 1)
      const now = this.clock.now();
      const cutoff = new Date(attempt.deadlineAt.getTime() + 15_000);
      if (now > cutoff) {
        throw new Error("ATTEMPT_CLOSED: Cannot save answer past the deadline window");
      }

      // Upsert by (attemptId, questionId)
      let found: Response | null = null;
      for (const r of this.store.responses.values()) {
        if (r.attemptId === data.attemptId && r.questionId === data.questionId) {
          found = r;
          break;
        }
      }

      const savedAt = now;
      if (found) {
        found.answerText = data.answerText;
        found.savedAt = savedAt;
      } else {
        const id = newId();
        const resp: Response = {
          id,
          tenantId,
          attemptId: data.attemptId,
          questionId: data.questionId,
          answerText: data.answerText,
          savedAt,
        };
        this.store.responses.set(id, resp);
      }

      return { savedAt };
    },
    listByAttempt: async (tenantId, attemptId) => {
      assertTenant(tenantId);
      return Array.from(this.store.responses.values())
        .filter((r) => r.tenantId === tenantId && r.attemptId === attemptId)
        .map((r) => ({ ...r }));
    },
  };

  // ── 10. Scores ─────────────────────────────────────────────────────────────
  scores: ScoresRepository = {
    upsert: async (tenantId, data) => {
      assertTenant(tenantId);
      const attempt = this.store.attempts.get(data.attemptId);
      if (!attempt || attempt.tenantId !== tenantId) {
        throw new Error("Foreign key constraint failed: attempt not found in tenant");
      }

      let found: Score | null = null;
      for (const s of this.store.scores.values()) {
        if (s.attemptId === data.attemptId && s.questionId === data.questionId) {
          found = s;
          break;
        }
      }

      const now = this.clock.now();
      if (found) {
        found.score = data.score;
        found.maxScore = data.maxScore;
        found.source = data.source;
        found.justification = data.justification ?? null;
        found.updatedAt = now;
        return { ...found };
      } else {
        const id = newId();
        const score: Score = {
          id,
          tenantId,
          attemptId: data.attemptId,
          questionId: data.questionId,
          score: data.score,
          maxScore: data.maxScore,
          source: data.source,
          justification: data.justification ?? null,
          createdAt: now,
          updatedAt: now,
        };
        this.store.scores.set(id, score);
        return { ...score };
      }
    },
    listByAttempt: async (tenantId, attemptId) => {
      assertTenant(tenantId);
      return Array.from(this.store.scores.values())
        .filter((s) => s.tenantId === tenantId && s.attemptId === attemptId)
        .map((s) => ({ ...s }));
    },
  };

  // ── 11. Jobs ───────────────────────────────────────────────────────────────
  jobs: JobsRepository = {
    enqueue: async (tenantId, data) => {
      assertTenant(tenantId);
      const id = newId();
      const job: Job = {
        id,
        tenantId,
        type: data.type,
        status: "queued",
        refId: data.refId,
        payload: data.payload,
        result: null,
        error: null,
        attempts: 0,
        maxAttempts: data.maxAttempts ?? 3,
        lockedAt: null,
        lockedBy: null,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.store.jobs.set(id, job);
      return { ...job };
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const j = this.store.jobs.get(id);
      if (!j || j.tenantId !== tenantId) return null;
      return { ...j };
    },
    claimNext: async (workerId) => {
      // Cross-tenant system worker query
      const queuedJobs = Array.from(this.store.jobs.values())
        .filter((j) => j.status === "queued" && j.attempts < j.maxAttempts)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (queuedJobs.length === 0) return null;

      const job = queuedJobs[0]!;
      job.status = "running";
      job.lockedBy = workerId;
      job.lockedAt = this.clock.now();
      job.attempts += 1;
      job.updatedAt = this.clock.now();
      return { ...job };
    },
    complete: async (id, result) => {
      const job = this.store.jobs.get(id);
      if (!job) return;
      job.status = "done";
      job.result = result;
      job.lockedBy = null;
      job.lockedAt = null;
      job.updatedAt = this.clock.now();
    },
    fail: async (id, error) => {
      const job = this.store.jobs.get(id);
      if (!job) return;
      job.status = "failed";
      job.error = error;
      job.lockedBy = null;
      job.lockedAt = null;
      job.updatedAt = this.clock.now();
    },
    countDailyGenerations: async (tenantId, dateUtc) => {
      assertTenant(tenantId);
      const startOfDay = new Date(
        Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), 0, 0, 0)
      );
      const endOfDay = new Date(
        Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), 23, 59, 59, 999)
      );

      return Array.from(this.store.jobs.values()).filter(
        (j) =>
          j.tenantId === tenantId &&
          j.type === "generate" &&
          j.createdAt >= startOfDay &&
          j.createdAt <= endOfDay
      ).length;
    },
  };

  // ── 12. Audit ──────────────────────────────────────────────────────────────
  audit: AuditRepository = {
    log: async (tenantId, data) => {
      assertTenant(tenantId);
      this.store.audit.push({
        id: newId(),
        tenantId,
        actorId: data.actorId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        details: data.details || null,
        createdAt: this.clock.now(),
      });
    },
    listByEntity: async (tenantId, entityType, entityId) => {
      assertTenant(tenantId);
      return this.store.audit
        .filter(
          (a) =>
            a.tenantId === tenantId &&
            a.entityType === entityType &&
            a.entityId === entityId
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((a) => ({ ...a }));
    },
  };

  // ── 13. System (Cross-Tenant Queries) ──────────────────────────────────────
  system: SystemRepository = {
    claimNextJob: async (workerId) => {
      return this.jobs.claimNext(workerId);
    },
    findExpiredAttempts: async (now) => {
      const gracePeriodMs = 15_000;
      return Array.from(this.store.attempts.values())
        .filter(
          (att) =>
            att.status === "in_progress" &&
            now.getTime() > att.deadlineAt.getTime() + gracePeriodMs
        )
        .map((att) => ({ ...att }));
    },
    findSessionByTokenHash: async (tokenHash) => {
      return this.sessions.findByTokenHash(tokenHash);
    },
    findParticipantByTokenHash: async (tokenHash) => {
      return this.participants.findByTokenHash(tokenHash);
    },
    findAttemptByTokenHash: async (tokenHash) => {
      return this.attempts.findByAttemptTokenHash(tokenHash);
    },
  };

  // ── Transaction Helper (Snapshot & Rollback) ───────────────────────────────
  async withTransaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    const snapshot = cloneStore(this.store);
    try {
      return await fn(this);
    } catch (err) {
      this.store = snapshot;
      throw err;
    }
  }
}
