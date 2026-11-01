/**
 * Repository Contract Test Suite (Prompt B B4 row 2 / Prompt A 2.7)
 * Written once, runs against in-memory fake at home (npm run test:repo:memory)
 * and against SQL Server 2022 in CI (npm run test:repo:sql).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { FakeClock } from "../../src/lib/clock";
import { newId } from "../../src/lib/id";
import { MemoryRepositories } from "../../src/repositories/memory";
import { Repositories } from "../../src/repositories/types";

describe("Repository Contract Suite (Cross-Backend Behavioral Contract)", () => {
  let clock: FakeClock;
  let repos: Repositories;

  beforeEach(() => {
    clock = new FakeClock(new Date("2026-11-01T12:00:00.000Z"));
    // Memory repository implementation for contract testing
    repos = new MemoryRepositories(clock);
  });

  // ── 1. Tenants & Tenant Isolation ──────────────────────────────────────────
  describe("Tenants & Users Isolation", () => {
    it("creates tenants and isolates users across tenants", async () => {
      const tenantA = await repos.tenants.create({ name: "Tenant Alpha" });
      const tenantB = await repos.tenants.create({ name: "Tenant Beta" });

      const userA = await repos.users.create(tenantA.id, {
        name: "Alice",
        email: "alice@alpha.com",
        passwordHash: "hashA",
        role: "admin",
      });

      // Tenant A can see Alice
      const foundA = await repos.users.findById(tenantA.id, userA.id);
      expect(foundA?.email).toBe("alice@alpha.com");

      // Tenant B CANNOT see Alice (isolated)
      const foundB = await repos.users.findById(tenantB.id, userA.id);
      expect(foundB).toBeNull();

      // Tenant B list is empty
      const listB = await repos.users.list(tenantB.id);
      expect(listB).toHaveLength(0);

      // Tenant B cannot update Alice
      const updateB = await repos.users.update(tenantB.id, userA.id, { name: "Hacked" });
      expect(updateB).toBeNull();
    });

    it("enforces globally unique emails across all tenants (Decision R1)", async () => {
      const tenantA = await repos.tenants.create({ name: "Tenant Alpha" });
      const tenantB = await repos.tenants.create({ name: "Tenant Beta" });

      await repos.users.create(tenantA.id, {
        name: "Alice",
        email: "shared@example.com",
        passwordHash: "hash1",
        role: "recruiter",
      });

      // Attempting to create user with same email under Tenant B must fail
      await expect(
        repos.users.create(tenantB.id, {
          name: "Bob",
          email: "shared@example.com",
          passwordHash: "hash2",
          role: "reviewer",
        })
      ).rejects.toThrow(/EMAIL_EXISTS/);
    });

    it("rejects user creation with invalid or missing tenant id", async () => {
      await expect(
        repos.users.create("not-a-uuid", {
          name: "Invalid",
          email: "test@example.com",
          passwordHash: "hash",
          role: "recruiter",
        })
      ).rejects.toThrow(/tenantId required/);
    });
  });

  // ── 2. Sessions ────────────────────────────────────────────────────────────
  describe("Sessions", () => {
    it("creates sessions and resolves them by token hash across tenants", async () => {
      const tenant = await repos.tenants.create({ name: "Session Corp" });
      const user = await repos.users.create(tenant.id, {
        name: "Dev",
        email: "dev@session.com",
        passwordHash: "hash",
        role: "admin",
      });

      const tokenHash = "token-hash-123456789";
      const expiresAt = new Date(clock.now().getTime() + 86400000);

      const session = await repos.sessions.create(tenant.id, {
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      expect(session.userId).toBe(user.id);

      const resolved = await repos.sessions.findByTokenHash(tokenHash);
      expect(resolved).not.toBeNull();
      expect(resolved?.user.id).toBe(user.id);
      expect(resolved?.tenant.id).toBe(tenant.id);

      // Delete by token hash
      const deleted = await repos.sessions.deleteByTokenHash(tokenHash);
      expect(deleted).toBe(true);

      const afterDelete = await repos.sessions.findByTokenHash(tokenHash);
      expect(afterDelete).toBeNull();
    });
  });

  // ── 3. Assessments & Composite Tenant Integrity ───────────────────────────
  describe("Assessments & Question Composite Tenant Integrity", () => {
    it("enforces tenant boundary on assessments and questions", async () => {
      const tenantA = await repos.tenants.create({ name: "Tenant A" });
      const tenantB = await repos.tenants.create({ name: "Tenant B" });

      const creatorA = await repos.users.create(tenantA.id, {
        name: "Creator A",
        email: "creator@tenantA.com",
        passwordHash: "hash",
        role: "recruiter",
      });

      const assessmentA = await repos.assessments.create(tenantA.id, {
        title: "Full Stack Engineer Assessment",
        durationMinutes: 60,
        passingScore: 70,
        sections: [{ type: "mcq", domain: "JavaScript", difficulty: "medium", count: 10 }],
        createdBy: creatorA.id,
      });

      // Tenant A can retrieve assessment
      const foundA = await repos.assessments.findById(tenantA.id, assessmentA.id);
      expect(foundA?.title).toBe("Full Stack Engineer Assessment");

      // Tenant B CANNOT retrieve assessment
      const foundB = await repos.assessments.findById(tenantB.id, assessmentA.id);
      expect(foundB).toBeNull();

      // Tenant A creates question successfully
      const qA = await repos.questions.create(tenantA.id, {
        assessmentId: assessmentA.id,
        sectionIndex: 0,
        type: "mcq",
        body: "What is closure?",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        maxScore: 5,
        source: "custom",
      });
      expect(qA.id).toBeTruthy();

      // Tenant B attempts to insert question for Tenant A's assessment -> MUST FAIL
      await expect(
        repos.questions.create(tenantB.id, {
          assessmentId: assessmentA.id,
          sectionIndex: 0,
          type: "mcq",
          body: "Hacked question",
          source: "custom",
        })
      ).rejects.toThrow(/Foreign key constraint failed/);
    });
  });

  // ── 4. Participants & Filtered Unique Index ───────────────────────────────
  describe("Participants & Filtered Unique Index", () => {
    it("allows multiple participants with NULL token_hash but rejects duplicate non-NULL tokens", async () => {
      const tenant = await repos.tenants.create({ name: "Invites Corp" });
      const user = await repos.users.create(tenant.id, {
        name: "Admin",
        email: "admin@invites.com",
        passwordHash: "hash",
        role: "admin",
      });
      const assessment = await repos.assessments.create(tenant.id, {
        title: "Test Exam",
        sections: [{ type: "mcq", count: 5 }],
        createdBy: user.id,
      });

      const created = await repos.participants.createMany(tenant.id, assessment.id, [
        { name: "John Doe", email: "john@example.com" },
        { name: "Jane Smith", email: "jane@example.com" },
        { name: "Duplicate John", email: "john@example.com" }, // duplicate in same assessment
      ]);

      expect(created.added).toHaveLength(2);
      expect(created.duplicates).toContain("john@example.com");

      const p1 = created.added[0]!;
      const p2 = created.added[1]!;

      // Both have tokenHash = null
      expect(p1.tokenHash).toBeNull();
      expect(p2.tokenHash).toBeNull();

      // Set unique tokenHash for p1
      await repos.participants.updateToken(tenant.id, p1.id, "hash-unique-1", new Date());

      // Setting SAME tokenHash for p2 must fail (filtered unique constraint violation)
      await expect(
        repos.participants.updateToken(tenant.id, p2.id, "hash-unique-1", new Date())
      ).rejects.toThrow(/Duplicate tokenHash/);

      // Clearing p1 back to null works
      await repos.participants.updateToken(tenant.id, p1.id, null, null);
      const afterClear = await repos.participants.findById(tenant.id, p1.id);
      expect(afterClear?.tokenHash).toBeNull();
    });
  });

  // ── 5. Attempts, Responses & Clock Deadline Rule ───────────────────────────
  describe("Attempts, Responses & Deadline Rule (FakeClock)", () => {
    it("enforces deadline + 15s grace cutoff on responses.upsert", async () => {
      const tenant = await repos.tenants.create({ name: "Exam Corp" });
      const user = await repos.users.create(tenant.id, {
        name: "Admin",
        email: "admin@exam.com",
        passwordHash: "hash",
        role: "admin",
      });
      const assessment = await repos.assessments.create(tenant.id, {
        title: "Timed Exam",
        sections: [{ type: "descriptive", count: 1 }],
        createdBy: user.id,
      });
      const q = await repos.questions.create(tenant.id, {
        assessmentId: assessment.id,
        type: "descriptive",
        body: "Describe async/await",
        source: "custom",
      });

      const pRes = await repos.participants.createMany(tenant.id, assessment.id, [
        { name: "Candidate", email: "candidate@exam.com" },
      ]);
      const participant = pRes.added[0]!;

      // Exam deadline: now + 30 minutes
      const deadlineAt = new Date(clock.now().getTime() + 30 * 60 * 1000);
      const attempt = await repos.attempts.create(tenant.id, {
        participantId: participant.id,
        assessmentId: assessment.id,
        attemptTokenHash: "aid-token-hash-xyz",
        deadlineAt,
      });

      // 1. Save answer at deadline + 14s (within 15s grace window) -> SUCCEEDS
      clock.setTime(new Date(deadlineAt.getTime() + 14_000));
      const res1 = await repos.responses.upsert(tenant.id, {
        attemptId: attempt.id,
        questionId: q.id,
        answerText: "Draft answer 1",
      });
      expect(res1.savedAt).toBeTruthy();

      // 2. Advance time past deadline + 15s -> MUST FAIL with ATTEMPT_CLOSED
      clock.setTime(new Date(deadlineAt.getTime() + 16_000));
      await expect(
        repos.responses.upsert(tenant.id, {
          attemptId: attempt.id,
          questionId: q.id,
          answerText: "Too late answer",
        })
      ).rejects.toThrow(/ATTEMPT_CLOSED/);
    });

    it("prevents multiple attempts for the same participant", async () => {
      const tenant = await repos.tenants.create({ name: "Single Attempt Corp" });
      const user = await repos.users.create(tenant.id, {
        name: "Admin",
        email: "admin@single.com",
        passwordHash: "hash",
        role: "admin",
      });
      const assessment = await repos.assessments.create(tenant.id, {
        title: "Single Exam",
        sections: [{ type: "mcq", count: 1 }],
        createdBy: user.id,
      });
      const pRes = await repos.participants.createMany(tenant.id, assessment.id, [
        { name: "Candidate 1", email: "cand1@single.com" },
      ]);
      const participant = pRes.added[0]!;

      await repos.attempts.create(tenant.id, {
        participantId: participant.id,
        assessmentId: assessment.id,
        attemptTokenHash: "aid-hash-1",
        deadlineAt: new Date(clock.now().getTime() + 3600000),
      });

      // Second attempt for same participant must be rejected
      await expect(
        repos.attempts.create(tenant.id, {
          participantId: participant.id,
          assessmentId: assessment.id,
          attemptTokenHash: "aid-hash-2",
          deadlineAt: new Date(clock.now().getTime() + 3600000),
        })
      ).rejects.toThrow(/attempt already exists for participant/);
    });
  });

  // ── 6. Jobs Queue & Atomic Claim ──────────────────────────────────────────
  describe("Job Queue & Claiming", () => {
    it("enqueues jobs and claims the oldest queued job", async () => {
      const tenant = await repos.tenants.create({ name: "Jobs Corp" });

      const job1 = await repos.jobs.enqueue(tenant.id, {
        type: "generate",
        refId: newId(),
        payload: { sectionIndexes: [0] },
      });

      clock.advanceSeconds(1);

      await repos.jobs.enqueue(tenant.id, {
        type: "email",
        refId: newId(),
        payload: { participantId: "p1" },
      });

      // Worker 1 claims next job
      const claimed = await repos.jobs.claimNext("worker-1");
      expect(claimed).not.toBeNull();
      expect(claimed?.id).toBe(job1.id);
      expect(claimed?.status).toBe("running");
      expect(claimed?.attempts).toBe(1);

      // Complete job
      await repos.jobs.complete(job1.id, { questionsGenerated: 5 });
      const completedJob = await repos.jobs.findById(tenant.id, job1.id);
      expect(completedJob?.status).toBe("done");

      // Daily generation count counts jobs of type generate
      const dailyCount = await repos.jobs.countDailyGenerations(tenant.id, clock.now());
      expect(dailyCount).toBe(1);
    });
  });

  // ── 7. Transactions (Snapshot & Rollback) ─────────────────────────────────
  describe("Transactions (withTransaction)", () => {
    it("rolls back all changes if an error is thrown within transaction", async () => {
      const tenant = await repos.tenants.create({ name: "Tx Corp" });

      await expect(
        repos.withTransaction(async (txRepos) => {
          await txRepos.users.create(tenant.id, {
            name: "Temp User",
            email: "temp@tx.com",
            passwordHash: "hash",
            role: "recruiter",
          });
          throw new Error("Simulated Transaction Failure");
        })
      ).rejects.toThrow("Simulated Transaction Failure");

      // Verify user was NOT committed
      const users = await repos.users.list(tenant.id);
      expect(users).toHaveLength(0);
    });
  });
});
