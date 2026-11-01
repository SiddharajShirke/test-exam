/**
 * System-Level Cross-Tenant Repositories
 *
 * Per Prompt A 2.4:
 * jobs.claimNext and the cross-tenant system queries (job loop, deadline timer,
 * session lookup by hash) are in src/repositories/system/ and are the ONLY
 * functions without a tenant argument; each has a comment explaining why,
 * and the unit test lists them so no new ones appear unnoticed.
 */

import type {
  Attempt,
  Assessment,
  Job,
  Participant,
  Session,
  SystemRepository,
  Tenant,
  User,
} from "../types";

export type { SystemRepository };

export interface SystemQueries extends SystemRepository {
  /**
   * Cross-tenant worker execution: claims the oldest queued background job across all tenants.
   * No tenantId argument because background workers service jobs globally across all tenants.
   */
  claimNextJob(workerId: string): Promise<Job | null>;

  /**
   * Cross-tenant deadline timer: detects in-progress candidate attempts that passed their
   * deadline plus 15s grace period across all tenants.
   * No tenantId argument because the auto-submission sweep runs globally on a background interval.
   */
  findExpiredAttempts(now: Date): Promise<Attempt[]>;

  /**
   * Session authentication resolver: authenticates HTTP request by sid cookie token hash.
   * No tenantId argument because the incoming cookie arrives before the tenant context is established.
   */
  findSessionByTokenHash(
    tokenHash: string
  ): Promise<{ session: Session; user: User; tenant: Tenant } | null>;

  /**
   * Candidate invitation entrypoint: resolves invitation token on public candidate landing pages.
   * No tenantId argument because invitation links are presented by candidates prior to knowing their tenant.
   */
  findParticipantByTokenHash(
    tokenHash: string
  ): Promise<{ participant: Participant; assessment: Assessment; tenant: Tenant } | null>;

  /**
   * Candidate exam resume: authenticates candidate by aid cookie token hash across all tenants.
   * No tenantId argument because attempt cookies are presented by anonymous candidates.
   */
  findAttemptByTokenHash(
    tokenHash: string
  ): Promise<{ attempt: Attempt; participant: Participant; assessment: Assessment; tenant: Tenant } | null>;
}

export const ALLOWED_CROSS_TENANT_SYSTEM_FUNCTIONS = [
  "claimNextJob",
  "findExpiredAttempts",
  "findSessionByTokenHash",
  "findParticipantByTokenHash",
  "findAttemptByTokenHash",
] as const;

export type AllowedCrossTenantFunction = typeof ALLOWED_CROSS_TENANT_SYSTEM_FUNCTIONS[number];
