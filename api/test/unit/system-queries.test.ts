/**
 * System Queries & Tenant Boundary Unit Tests (Prompt A 2.4)
 * Verifies that the only functions without a tenantId argument are the documented
 * system queries in ALLOWED_CROSS_TENANT_SYSTEM_FUNCTIONS.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { FakeClock } from "../../src/lib/clock";
import { newId } from "../../src/lib/id";
import { MemoryRepositories } from "../../src/repositories/memory";
import { ALLOWED_CROSS_TENANT_SYSTEM_FUNCTIONS } from "../../src/repositories/system";

describe("System Queries & Cross-Tenant Boundary (Prompt A 2.4)", () => {
  let clock: FakeClock;
  let repos: MemoryRepositories;

  beforeEach(() => {
    clock = new FakeClock(new Date("2026-11-01T12:00:00.000Z"));
    repos = new MemoryRepositories(clock);
  });

  it("lists exactly the 5 allowed cross-tenant system functions with documented rationales", () => {
    expect(ALLOWED_CROSS_TENANT_SYSTEM_FUNCTIONS).toEqual([
      "claimNextJob",
      "findExpiredAttempts",
      "findSessionByTokenHash",
      "findParticipantByTokenHash",
      "findAttemptByTokenHash",
    ]);

    // Ensure all 5 exist on repos.system
    for (const fnName of ALLOWED_CROSS_TENANT_SYSTEM_FUNCTIONS) {
      expect(typeof (repos.system as Record<string, unknown>)[fnName]).toBe("function");
    }
  });

  it("system.claimNextJob claims queued job across any tenant", async () => {
    const tenant = await repos.tenants.create({ name: "Cross-Tenant Jobs" });
    const job = await repos.jobs.enqueue(tenant.id, {
      type: "generate",
      refId: newId(),
      payload: { sectionIndex: 0 },
    });

    const claimed = await repos.system.claimNextJob("worker-node-1");
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.tenantId).toBe(tenant.id);
    expect(claimed?.status).toBe("running");
  });

  it("system.findExpiredAttempts returns attempts past deadline + 15s grace across any tenant", async () => {
    const tenantA = await repos.tenants.create({ name: "Tenant A" });
    const userA = await repos.users.create(tenantA.id, {
      name: "Admin A",
      email: "admin@tenantA.com",
      passwordHash: "hash",
      role: "admin",
    });
    const assessmentA = await repos.assessments.create(tenantA.id, {
      title: "Assessment A",
      sections: [{ type: "mcq", count: 1 }],
      createdBy: userA.id,
    });
    const pA = (
      await repos.participants.createMany(tenantA.id, assessmentA.id, [
        { name: "Candidate A", email: "candA@tenantA.com" },
      ])
    ).added[0]!;

    const deadline = new Date("2026-11-01T12:30:00.000Z");
    await repos.attempts.create(tenantA.id, {
      participantId: pA.id,
      assessmentId: assessmentA.id,
      attemptTokenHash: "att-hash-a",
      deadlineAt: deadline,
    });

    // At deadline + 14s (within 15s grace): not expired yet
    const expiredAt14s = await repos.system.findExpiredAttempts(
      new Date("2026-11-01T12:30:14.000Z")
    );
    expect(expiredAt14s).toHaveLength(0);

    // At deadline + 16s (past 15s grace): expired and eligible for auto-submit
    const expiredAt16s = await repos.system.findExpiredAttempts(
      new Date("2026-11-01T12:30:16.000Z")
    );
    expect(expiredAt16s).toHaveLength(1);
    expect(expiredAt16s[0]!.tenantId).toBe(tenantA.id);
  });

  it("system.findSessionByTokenHash resolves user and tenant from sid cookie token hash", async () => {
    const tenant = await repos.tenants.create({ name: "Session Tenant" });
    const user = await repos.users.create(tenant.id, {
      name: "Session User",
      email: "user@session.com",
      passwordHash: "hash",
      role: "recruiter",
    });

    const tokenHash = "sid-hash-abcdef123456";
    await repos.sessions.create(tenant.id, {
      userId: user.id,
      tokenHash,
      expiresAt: new Date("2026-11-02T12:00:00.000Z"),
    });

    const resolved = await repos.system.findSessionByTokenHash(tokenHash);
    expect(resolved).not.toBeNull();
    expect(resolved?.tenant.id).toBe(tenant.id);
    expect(resolved?.user.id).toBe(user.id);
  });

  it("all tenant-owned repository functions strictly reject missing or non-UUID tenantId", async () => {
    const invalidIds = ["", "   ", "not-a-uuid", null as unknown as string, undefined as unknown as string];

    for (const badId of invalidIds) {
      await expect(repos.users.list(badId)).rejects.toThrow(/tenantId required/);
      await expect(repos.assessments.list(badId)).rejects.toThrow(/tenantId required/);
      await expect(repos.questions.findById(badId, newId())).rejects.toThrow(/tenantId required/);
      await expect(repos.participants.findById(badId, newId())).rejects.toThrow(/tenantId required/);
      await expect(repos.attempts.findById(badId, newId())).rejects.toThrow(/tenantId required/);
      await expect(repos.responses.listByAttempt(badId, newId())).rejects.toThrow(/tenantId required/);
      await expect(repos.scores.listByAttempt(badId, newId())).rejects.toThrow(/tenantId required/);
      await expect(repos.jobs.findById(badId, newId())).rejects.toThrow(/tenantId required/);
      await expect(repos.audit.listByEntity(badId, "assessment", newId())).rejects.toThrow(/tenantId required/);
    }
  });
});
