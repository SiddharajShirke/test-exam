import sql from "mssql";
import { getPool } from "../../db/pool";
import { config } from "../../config";
import { Clock, SystemClock } from "../../lib/clock";
import { newId } from "../../lib/id";
import {
  assertTenant,
  Assessment,
  AssessmentListItem,
  AssessmentsRepository,
  Attempt,
  AttemptListItem,
  AttemptsRepository,
  AuditRepository,
  Job,
  JobsRepository,
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
  UsersRepository,
} from "../types";

export class SqlRepositories implements Repositories {
  private clock: Clock;
  private schema: string;

  constructor(clock: Clock = new SystemClock(), schema: string = config.DB_SCHEMA || "assess") {
    this.clock = clock;
    this.schema = schema;
  }

  // ── 1. Tenants ─────────────────────────────────────────────────────────────
  tenants: TenantsRepository = {
    create: async (data) => {
      const pool = await getPool();
      const id = data.id || newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("name", sql.NVarChar(255), data.name);

      const res = await req.query<Tenant>(`
        INSERT INTO [${this.schema}].[tenants] ([id], [name])
        OUTPUT inserted.[id], inserted.[name], inserted.[status], inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        VALUES (@id, @name);
      `);
      return res.recordset[0]!;
    },
    findById: async (id) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query<Tenant>(`
        SELECT [id], [name], [status], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[tenants]
        WHERE [id] = @id;
      `);
      return res.recordset[0] || null;
    },
    list: async () => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      const res = await req.query<Tenant>(`
        SELECT [id], [name], [status], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[tenants]
        ORDER BY [created_at] ASC;
      `);
      return res.recordset;
    },
  };

  // ── 2. Users ───────────────────────────────────────────────────────────────
  users: UsersRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const id = data.id || newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("name", sql.NVarChar(255), data.name);
      req.input("email", sql.NVarChar(320), data.email.trim());
      req.input("passwordHash", sql.VarChar(255), data.passwordHash);
      req.input("role", sql.VarChar(20), data.role);
      req.input("status", sql.VarChar(20), data.status || "active");

      const res = await req.query<User>(`
        INSERT INTO [${this.schema}].[users] ([id], [tenant_id], [name], [email], [password_hash], [role], [status])
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[name], inserted.[email],
               inserted.[password_hash] as passwordHash, inserted.[role], inserted.[status],
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        VALUES (@id, @tenantId, @name, @email, @passwordHash, @role, @status);
      `);
      return res.recordset[0]!;
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query<User>(`
        SELECT [id], [tenant_id] as tenantId, [name], [email], [password_hash] as passwordHash,
               [role], [status], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[users]
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      return res.recordset[0] || null;
    },
    findByEmail: async (email) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("email", sql.NVarChar(320), email.trim());
      const res = await req.query<User>(`
        SELECT [id], [tenant_id] as tenantId, [name], [email], [password_hash] as passwordHash,
               [role], [status], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[users]
        WHERE LOWER([email]) = LOWER(@email);
      `);
      return res.recordset[0] || null;
    },
    list: async (tenantId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      const res = await req.query<User>(`
        SELECT [id], [tenant_id] as tenantId, [name], [email], [password_hash] as passwordHash,
               [role], [status], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[users]
        WHERE [tenant_id] = @tenantId
        ORDER BY [created_at] ASC;
      `);
      return res.recordset;
    },
    update: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("name", sql.NVarChar(255), data.name ?? null);
      req.input("role", sql.VarChar(20), data.role ?? null);
      req.input("status", sql.VarChar(20), data.status ?? null);

      const res = await req.query<User>(`
        UPDATE [${this.schema}].[users]
        SET [name] = COALESCE(@name, [name]),
            [role] = COALESCE(@role, [role]),
            [status] = COALESCE(@status, [status]),
            [updated_at] = SYSUTCDATETIME()
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[name], inserted.[email],
               inserted.[password_hash] as passwordHash, inserted.[role], inserted.[status],
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      return res.recordset[0] || null;
    },
  };

  // ── 3. Sessions ────────────────────────────────────────────────────────────
  sessions: SessionsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const id = data.id || newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("userId", sql.UniqueIdentifier, data.userId);
      req.input("tokenHash", sql.VarChar(64), data.tokenHash);
      req.input("expiresAt", sql.DateTime2(3), data.expiresAt);

      const res = await req.query<Session>(`
        INSERT INTO [${this.schema}].[sessions] ([id], [tenant_id], [user_id], [token_hash], [expires_at])
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[user_id] as userId,
               inserted.[token_hash] as tokenHash, inserted.[expires_at] as expiresAt, inserted.[created_at] as createdAt
        VALUES (@id, @tenantId, @userId, @tokenHash, @expiresAt);
      `);
      return res.recordset[0]!;
    },
    findByTokenHash: async (tokenHash) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tokenHash", sql.VarChar(64), tokenHash);

      type Row = {
        s_id: string;
        s_tenant_id: string;
        s_user_id: string;
        s_token_hash: string;
        s_expires_at: Date;
        s_created_at: Date;
        u_id: string;
        u_tenant_id: string;
        u_name: string;
        u_email: string;
        u_password_hash: string;
        u_role: "admin" | "recruiter" | "reviewer";
        u_status: "active" | "disabled";
        u_created_at: Date;
        u_updated_at: Date;
        t_id: string;
        t_name: string;
        t_status: "active" | "suspended";
        t_created_at: Date;
        t_updated_at: Date;
      };

      const res = await req.query<Row>(`
        SELECT s.[id] as s_id, s.[tenant_id] as s_tenant_id, s.[user_id] as s_user_id,
               s.[token_hash] as s_token_hash, s.[expires_at] as s_expires_at, s.[created_at] as s_created_at,
               u.[id] as u_id, u.[tenant_id] as u_tenant_id, u.[name] as u_name, u.[email] as u_email,
               u.[password_hash] as u_password_hash, u.[role] as u_role, u.[status] as u_status,
               u.[created_at] as u_created_at, u.[updated_at] as u_updated_at,
               t.[id] as t_id, t.[name] as t_name, t.[status] as t_status,
               t.[created_at] as t_created_at, t.[updated_at] as t_updated_at
        FROM [${this.schema}].[sessions] s
        INNER JOIN [${this.schema}].[users] u ON s.[user_id] = u.[id] AND s.[tenant_id] = u.[tenant_id]
        INNER JOIN [${this.schema}].[tenants] t ON s.[tenant_id] = t.[id]
        WHERE s.[token_hash] = @tokenHash;
      `);

      const row = res.recordset[0];
      if (!row) return null;

      return {
        session: {
          id: row.s_id,
          tenantId: row.s_tenant_id,
          userId: row.s_user_id,
          tokenHash: row.s_token_hash,
          expiresAt: row.s_expires_at,
          createdAt: row.s_created_at,
        },
        user: {
          id: row.u_id,
          tenantId: row.u_tenant_id,
          name: row.u_name,
          email: row.u_email,
          passwordHash: row.u_password_hash,
          role: row.u_role,
          status: row.u_status,
          createdAt: row.u_created_at,
          updatedAt: row.u_updated_at,
        },
        tenant: {
          id: row.t_id,
          name: row.t_name,
          status: row.t_status,
          createdAt: row.t_created_at,
          updatedAt: row.t_updated_at,
        },
      };
    },
    deleteByTokenHash: async (tokenHash) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tokenHash", sql.VarChar(64), tokenHash);
      const res = await req.query(`DELETE FROM [${this.schema}].[sessions] WHERE [token_hash] = @tokenHash;`);
      return (res.rowsAffected[0] ?? 0) > 0;
    },
    deleteByUserId: async (tenantId, userId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("userId", sql.UniqueIdentifier, userId);
      const res = await req.query(
        `DELETE FROM [${this.schema}].[sessions] WHERE [tenant_id] = @tenantId AND [user_id] = @userId;`
      );
      return res.rowsAffected[0] ?? 0;
    },
  };

  // ── 4. Login Attempts ──────────────────────────────────────────────────────
  loginAttempts: LoginAttemptsRepository = {
    record: async (data) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, data.id || newId());
      req.input("email", sql.NVarChar(320), data.email.toLowerCase().trim());
      req.input("ipAddress", sql.VarChar(45), data.ipAddress);
      req.input("success", sql.Bit, data.success);
      await req.query(`
        INSERT INTO [${this.schema}].[login_attempts] ([id], [email], [ip_address], [success])
        VALUES (@id, @email, @ipAddress, @success);
      `);
    },
    countRecentFailures: async (email, since) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("email", sql.NVarChar(320), email.toLowerCase().trim());
      req.input("since", sql.DateTime2(3), since);
      const res = await req.query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt
        FROM [${this.schema}].[login_attempts]
        WHERE [email] = @email AND [success] = 0 AND [attempted_at] >= @since;
      `);
      return res.recordset[0]?.cnt || 0;
    },
  };

  // ── 5. Assessments ─────────────────────────────────────────────────────────
  assessments: AssessmentsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const id = data.id || newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("title", sql.NVarChar(255), data.title);
      req.input("jobDescription", sql.NVarChar(sql.MAX), data.jobDescription || null);
      req.input("durationMinutes", sql.Int, data.durationMinutes ?? 60);
      req.input("passingScore", sql.Int, data.passingScore ?? 60);
      req.input("sectionsJson", sql.NVarChar(sql.MAX), JSON.stringify(data.sections));
      req.input("createdBy", sql.UniqueIdentifier, data.createdBy);

      const res = await req.query<{
        id: string;
        tenantId: string;
        title: string;
        jobDescription: string | null;
        jdFileName: string | null;
        durationMinutes: number;
        passingScore: number;
        status: Assessment["status"];
        sectionsJson: string;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        INSERT INTO [${this.schema}].[assessments]
          ([id], [tenant_id], [title], [job_description], [duration_minutes], [passing_score], [sections_json], [created_by])
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[title],
               inserted.[job_description] as jobDescription, inserted.[jd_file_name] as jdFileName,
               inserted.[duration_minutes] as durationMinutes, inserted.[passing_score] as passingScore,
               inserted.[status], inserted.[sections_json] as sectionsJson, inserted.[created_by] as createdBy,
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        VALUES (@id, @tenantId, @title, @jobDescription, @durationMinutes, @passingScore, @sectionsJson, @createdBy);
      `);

      const row = res.recordset[0]!;
      return {
        ...row,
        sections: JSON.parse(row.sectionsJson),
      };
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);

      const res = await req.query<{
        id: string;
        tenantId: string;
        title: string;
        jobDescription: string | null;
        jdFileName: string | null;
        durationMinutes: number;
        passingScore: number;
        status: Assessment["status"];
        sectionsJson: string;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        SELECT [id], [tenant_id] as tenantId, [title], [job_description] as jobDescription,
               [jd_file_name] as jdFileName, [duration_minutes] as durationMinutes,
               [passing_score] as passingScore, [status], [sections_json] as sectionsJson,
               [created_by] as createdBy, [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[assessments]
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);

      const row = res.recordset[0];
      if (!row) return null;
      return {
        ...row,
        sections: JSON.parse(row.sectionsJson),
      };
    },
    list: async (tenantId, filter) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("status", sql.VarChar(20), filter?.status || null);

      const res = await req.query<AssessmentListItem>(`
        SELECT a.[id], a.[title], a.[status], a.[created_at] as createdAt,
               COUNT(DISTINCT p.[id]) as participantCount,
               COUNT(DISTINCT CASE WHEN att.[status] <> 'in_progress' THEN att.[id] END) as submittedCount
        FROM [${this.schema}].[assessments] a
        LEFT JOIN [${this.schema}].[participants] p ON p.[assessment_id] = a.[id] AND p.[tenant_id] = a.[tenant_id]
        LEFT JOIN [${this.schema}].[attempts] att ON att.[assessment_id] = a.[id] AND att.[tenant_id] = a.[tenant_id]
        WHERE a.[tenant_id] = @tenantId AND (@status IS NULL OR a.[status] = @status)
        GROUP BY a.[id], a.[title], a.[status], a.[created_at]
        ORDER BY a.[created_at] DESC;
      `);
      return res.recordset;
    },
    update: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("title", sql.NVarChar(255), data.title ?? null);
      req.input("jobDescription", sql.NVarChar(sql.MAX), data.jobDescription ?? null);
      req.input("jdFileName", sql.NVarChar(255), data.jdFileName ?? null);
      req.input("durationMinutes", sql.Int, data.durationMinutes ?? null);
      req.input("passingScore", sql.Int, data.passingScore ?? null);
      req.input("status", sql.VarChar(20), data.status ?? null);
      req.input("sectionsJson", sql.NVarChar(sql.MAX), data.sections ? JSON.stringify(data.sections) : null);

      const res = await req.query<{
        id: string;
        tenantId: string;
        title: string;
        jobDescription: string | null;
        jdFileName: string | null;
        durationMinutes: number;
        passingScore: number;
        status: Assessment["status"];
        sectionsJson: string;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        UPDATE [${this.schema}].[assessments]
        SET [title] = COALESCE(@title, [title]),
            [job_description] = CASE WHEN @jobDescription IS NOT NULL THEN @jobDescription ELSE [job_description] END,
            [jd_file_name] = CASE WHEN @jdFileName IS NOT NULL THEN @jdFileName ELSE [jd_file_name] END,
            [duration_minutes] = COALESCE(@durationMinutes, [duration_minutes]),
            [passing_score] = COALESCE(@passingScore, [passing_score]),
            [status] = COALESCE(@status, [status]),
            [sections_json] = COALESCE(@sectionsJson, [sections_json]),
            [updated_at] = SYSUTCDATETIME()
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[title],
               inserted.[job_description] as jobDescription, inserted.[jd_file_name] as jdFileName,
               inserted.[duration_minutes] as durationMinutes, inserted.[passing_score] as passingScore,
               inserted.[status], inserted.[sections_json] as sectionsJson, inserted.[created_by] as createdBy,
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);

      const row = res.recordset[0];
      if (!row) return null;
      return {
        ...row,
        sections: JSON.parse(row.sectionsJson),
      };
    },
    delete: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query(`
        DELETE FROM [${this.schema}].[assessments]
        WHERE [tenant_id] = @tenantId AND [id] = @id AND [status] = 'draft';
      `);
      return (res.rowsAffected[0] ?? 0) > 0;
    },
  };

  // ── 6. Questions ───────────────────────────────────────────────────────────
  questions: QuestionsRepository = {
    create: async (tenantId, data) => {
      const created = await this.questions.createMany(tenantId, [data]);
      return created[0]!;
    },
    createMany: async (tenantId, items) => {
      assertTenant(tenantId);
      if (items.length === 0) return [];
      const pool = await getPool();
      const results: Question[] = [];

      for (const item of items) {
        const id = item.id || newId();
        const req = new sql.Request(pool);
        req.input("id", sql.UniqueIdentifier, id);
        req.input("tenantId", sql.UniqueIdentifier, tenantId);
        req.input("assessmentId", sql.UniqueIdentifier, item.assessmentId);
        req.input("sectionIndex", sql.Int, item.sectionIndex ?? 0);
        req.input("type", sql.VarChar(20), item.type);
        req.input("body", sql.NVarChar(sql.MAX), item.body);
        req.input("optionsJson", sql.NVarChar(sql.MAX), item.options ? JSON.stringify(item.options) : null);
        req.input("correctAnswer", sql.NVarChar(sql.MAX), item.correctAnswer || null);
        req.input("rubric", sql.NVarChar(sql.MAX), item.rubric || null);
        req.input("maxScore", sql.Int, item.maxScore ?? 10);
        req.input("source", sql.VarChar(20), item.source || "ai");
        req.input("position", sql.Int, item.position ?? 0);

        const res = await req.query<{
          id: string;
          tenantId: string;
          assessmentId: string;
          sectionIndex: number;
          type: Question["type"];
          body: string;
          optionsJson: string | null;
          correctAnswer: string | null;
          rubric: string | null;
          maxScore: number;
          source: Question["source"];
          position: number;
          createdAt: Date;
          updatedAt: Date;
        }>(`
          INSERT INTO [${this.schema}].[questions]
            ([id], [tenant_id], [assessment_id], [section_index], [type], [body], [options_json],
             [correct_answer], [rubric], [max_score], [source], [position])
          OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[assessment_id] as assessmentId,
                 inserted.[section_index] as sectionIndex, inserted.[type], inserted.[body],
                 inserted.[options_json] as optionsJson, inserted.[correct_answer] as correctAnswer,
                 inserted.[rubric], inserted.[max_score] as maxScore, inserted.[source],
                 inserted.[position], inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
          VALUES (@id, @tenantId, @assessmentId, @sectionIndex, @type, @body, @optionsJson,
                  @correctAnswer, @rubric, @maxScore, @source, @position);
        `);

        const r = res.recordset[0]!;
        results.push({
          ...r,
          options: r.optionsJson ? JSON.parse(r.optionsJson) : undefined,
        });
      }

      return results;
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query<{
        id: string;
        tenantId: string;
        assessmentId: string;
        sectionIndex: number;
        type: Question["type"];
        body: string;
        optionsJson: string | null;
        correctAnswer: string | null;
        rubric: string | null;
        maxScore: number;
        source: Question["source"];
        position: number;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        SELECT [id], [tenant_id] as tenantId, [assessment_id] as assessmentId,
               [section_index] as sectionIndex, [type], [body], [options_json] as optionsJson,
               [correct_answer] as correctAnswer, [rubric], [max_score] as maxScore, [source],
               [position], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[questions]
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      const row = res.recordset[0];
      if (!row) return null;
      return {
        ...row,
        options: row.optionsJson ? JSON.parse(row.optionsJson) : undefined,
      };
    },
    listByAssessment: async (tenantId, assessmentId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("assessmentId", sql.UniqueIdentifier, assessmentId);
      const res = await req.query<{
        id: string;
        tenantId: string;
        assessmentId: string;
        sectionIndex: number;
        type: Question["type"];
        body: string;
        optionsJson: string | null;
        correctAnswer: string | null;
        rubric: string | null;
        maxScore: number;
        source: Question["source"];
        position: number;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        SELECT [id], [tenant_id] as tenantId, [assessment_id] as assessmentId,
               [section_index] as sectionIndex, [type], [body], [options_json] as optionsJson,
               [correct_answer] as correctAnswer, [rubric], [max_score] as maxScore, [source],
               [position], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[questions]
        WHERE [tenant_id] = @tenantId AND [assessment_id] = @assessmentId
        ORDER BY [position] ASC;
      `);
      return res.recordset.map((r) => ({
        ...r,
        options: r.optionsJson ? JSON.parse(r.optionsJson) : undefined,
      }));
    },
    update: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("body", sql.NVarChar(sql.MAX), data.body ?? null);
      req.input("optionsJson", sql.NVarChar(sql.MAX), data.options ? JSON.stringify(data.options) : null);
      req.input("correctAnswer", sql.NVarChar(sql.MAX), data.correctAnswer ?? null);
      req.input("rubric", sql.NVarChar(sql.MAX), data.rubric ?? null);
      req.input("maxScore", sql.Int, data.maxScore ?? null);
      req.input("position", sql.Int, data.position ?? null);

      const res = await req.query<{
        id: string;
        tenantId: string;
        assessmentId: string;
        sectionIndex: number;
        type: Question["type"];
        body: string;
        optionsJson: string | null;
        correctAnswer: string | null;
        rubric: string | null;
        maxScore: number;
        source: Question["source"];
        position: number;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        UPDATE [${this.schema}].[questions]
        SET [body] = COALESCE(@body, [body]),
            [options_json] = COALESCE(@optionsJson, [options_json]),
            [correct_answer] = COALESCE(@correctAnswer, [correct_answer]),
            [rubric] = COALESCE(@rubric, [rubric]),
            [max_score] = COALESCE(@maxScore, [max_score]),
            [position] = COALESCE(@position, [position]),
            [updated_at] = SYSUTCDATETIME()
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[assessment_id] as assessmentId,
               inserted.[section_index] as sectionIndex, inserted.[type], inserted.[body],
               inserted.[options_json] as optionsJson, inserted.[correct_answer] as correctAnswer,
               inserted.[rubric], inserted.[max_score] as maxScore, inserted.[source],
               inserted.[position], inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      const row = res.recordset[0];
      if (!row) return null;
      return {
        ...row,
        options: row.optionsJson ? JSON.parse(row.optionsJson) : undefined,
      };
    },
    delete: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query(`DELETE FROM [${this.schema}].[questions] WHERE [tenant_id] = @tenantId AND [id] = @id;`);
      return (res.rowsAffected[0] ?? 0) > 0;
    },
    deleteByAssessmentAndSource: async (tenantId, assessmentId, sectionIndex, source) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("assessmentId", sql.UniqueIdentifier, assessmentId);
      req.input("sectionIndex", sql.Int, sectionIndex);
      req.input("source", sql.VarChar(20), source);
      const res = await req.query(`
        DELETE FROM [${this.schema}].[questions]
        WHERE [tenant_id] = @tenantId AND [assessment_id] = @assessmentId
          AND [section_index] = @sectionIndex AND [source] = @source;
      `);
      return res.rowsAffected[0] ?? 0;
    },
  };

  // ── 7. Participants ────────────────────────────────────────────────────────
  participants: ParticipantsRepository = {
    createMany: async (tenantId, assessmentId, items) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const added: Participant[] = [];
      const duplicates: string[] = [];
      const invalid: string[] = [];

      for (const item of items) {
        const email = item.email.toLowerCase().trim();
        if (!email || !email.includes("@")) {
          invalid.push(item.email);
          continue;
        }

        const id = newId();
        const req = new sql.Request(pool);
        req.input("id", sql.UniqueIdentifier, id);
        req.input("tenantId", sql.UniqueIdentifier, tenantId);
        req.input("assessmentId", sql.UniqueIdentifier, assessmentId);
        req.input("name", sql.NVarChar(255), item.name.trim());
        req.input("email", sql.NVarChar(320), email);

        try {
          const res = await req.query<Participant>(`
            INSERT INTO [${this.schema}].[participants]
              ([id], [tenant_id], [assessment_id], [name], [email])
            OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[assessment_id] as assessmentId,
                   inserted.[name], inserted.[email], inserted.[invite_status] as inviteStatus,
                   inserted.[token_hash] as tokenHash, inserted.[token_expires_at] as tokenExpiresAt,
                   inserted.[invited_at] as invitedAt, inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
            VALUES (@id, @tenantId, @assessmentId, @name, @email);
          `);
          added.push(res.recordset[0]!);
        } catch (err: unknown) {
          const errStr = String(err);
          if (errStr.includes("UQ_participants_assessment_email") || errStr.includes("UNIQUE KEY")) {
            duplicates.push(item.email);
          } else {
            throw err;
          }
        }
      }

      return { added, duplicates, invalid };
    },
    listByAssessment: async (tenantId, assessmentId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("assessmentId", sql.UniqueIdentifier, assessmentId);

      const res = await req.query<ParticipantListItem>(`
        SELECT p.[id], p.[name], p.[email], p.[invite_status] as inviteStatus,
               COALESCE(att.[status], 'not_started') as attemptStatus,
               att.[percent]
        FROM [${this.schema}].[participants] p
        LEFT JOIN [${this.schema}].[attempts] att ON att.[participant_id] = p.[id] AND att.[tenant_id] = p.[tenant_id]
        WHERE p.[tenant_id] = @tenantId AND p.[assessment_id] = @assessmentId
        ORDER BY p.[created_at] ASC;
      `);
      return res.recordset;
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query<Participant>(`
        SELECT [id], [tenant_id] as tenantId, [assessment_id] as assessmentId,
               [name], [email], [invite_status] as inviteStatus, [token_hash] as tokenHash,
               [token_expires_at] as tokenExpiresAt, [invited_at] as invitedAt,
               [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[participants]
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      return res.recordset[0] || null;
    },
    findByTokenHash: async (tokenHash) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tokenHash", sql.VarChar(64), tokenHash);

      const res = await req.query<{
        p_id: string; p_tenant_id: string; p_assessment_id: string; p_name: string; p_email: string;
        p_invite_status: Participant["inviteStatus"]; p_token_hash: string | null;
        p_token_expires_at: Date | null; p_invited_at: Date | null; p_created_at: Date; p_updated_at: Date;
        a_id: string; a_tenant_id: string; a_title: string; a_job_description: string | null;
        a_jd_file_name: string | null; a_duration_minutes: number; a_passing_score: number;
        a_status: Assessment["status"]; a_sections_json: string; a_created_by: string;
        a_created_at: Date; a_updated_at: Date;
        t_id: string; t_name: string; t_status: Tenant["status"]; t_created_at: Date; t_updated_at: Date;
      }>(`
        SELECT p.[id] as p_id, p.[tenant_id] as p_tenant_id, p.[assessment_id] as p_assessment_id,
               p.[name] as p_name, p.[email] as p_email, p.[invite_status] as p_invite_status,
               p.[token_hash] as p_token_hash, p.[token_expires_at] as p_token_expires_at,
               p.[invited_at] as p_invited_at, p.[created_at] as p_created_at, p.[updated_at] as p_updated_at,
               a.[id] as a_id, a.[tenant_id] as a_tenant_id, a.[title] as a_title,
               a.[job_description] as a_job_description, a.[jd_file_name] as a_jd_file_name,
               a.[duration_minutes] as a_duration_minutes, a.[passing_score] as a_passing_score,
               a.[status] as a_status, a.[sections_json] as a_sections_json, a.[created_by] as a_created_by,
               a.[created_at] as a_created_at, a.[updated_at] as a_updated_at,
               t.[id] as t_id, t.[name] as t_name, t.[status] as t_status,
               t.[created_at] as t_created_at, t.[updated_at] as t_updated_at
        FROM [${this.schema}].[participants] p
        INNER JOIN [${this.schema}].[assessments] a ON p.[assessment_id] = a.[id] AND p.[tenant_id] = a.[tenant_id]
        INNER JOIN [${this.schema}].[tenants] t ON p.[tenant_id] = t.[id]
        WHERE p.[token_hash] = @tokenHash;
      `);

      const row = res.recordset[0];
      if (!row) return null;

      return {
        participant: {
          id: row.p_id,
          tenantId: row.p_tenant_id,
          assessmentId: row.p_assessment_id,
          name: row.p_name,
          email: row.p_email,
          inviteStatus: row.p_invite_status,
          tokenHash: row.p_token_hash,
          tokenExpiresAt: row.p_token_expires_at,
          invitedAt: row.p_invited_at,
          createdAt: row.p_created_at,
          updatedAt: row.p_updated_at,
        },
        assessment: {
          id: row.a_id,
          tenantId: row.a_tenant_id,
          title: row.a_title,
          jobDescription: row.a_job_description,
          jdFileName: row.a_jd_file_name,
          durationMinutes: row.a_duration_minutes,
          passingScore: row.a_passing_score,
          status: row.a_status,
          sections: JSON.parse(row.a_sections_json),
          createdBy: row.a_created_by,
          createdAt: row.a_created_at,
          updatedAt: row.a_updated_at,
        },
        tenant: {
          id: row.t_id,
          name: row.t_name,
          status: row.t_status,
          createdAt: row.t_created_at,
          updatedAt: row.t_updated_at,
        },
      };
    },
    updateToken: async (tenantId, id, tokenHash, expiresAt) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tokenHash", sql.VarChar(64), tokenHash);
      req.input("expiresAt", sql.DateTime2(3), expiresAt);

      await req.query(`
        UPDATE [${this.schema}].[participants]
        SET [token_hash] = @tokenHash,
            [token_expires_at] = @expiresAt,
            [updated_at] = SYSUTCDATETIME()
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
    },
    updateInviteStatus: async (tenantId, id, status, invitedAt) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("status", sql.VarChar(20), status);
      req.input("invitedAt", sql.DateTime2(3), invitedAt || null);

      await req.query(`
        UPDATE [${this.schema}].[participants]
        SET [invite_status] = @status,
            [invited_at] = COALESCE(@invitedAt, [invited_at]),
            [updated_at] = SYSUTCDATETIME()
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
    },
    delete: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      const res = await req.query(`DELETE FROM [${this.schema}].[participants] WHERE [tenant_id] = @tenantId AND [id] = @id;`);
      return (res.rowsAffected[0] ?? 0) > 0;
    },
  };

  // ── 8. Attempts ────────────────────────────────────────────────────────────
  attempts: AttemptsRepository = {
    create: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const id = data.id || newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("participantId", sql.UniqueIdentifier, data.participantId);
      req.input("assessmentId", sql.UniqueIdentifier, data.assessmentId);
      req.input("attemptTokenHash", sql.VarChar(64), data.attemptTokenHash);
      req.input("deadlineAt", sql.DateTime2(3), data.deadlineAt);

      const res = await req.query<Attempt>(`
        INSERT INTO [${this.schema}].[attempts]
          ([id], [tenant_id], [participant_id], [assessment_id], [attempt_token_hash], [deadline_at])
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[participant_id] as participantId,
               inserted.[assessment_id] as assessmentId, inserted.[attempt_token_hash] as attemptTokenHash,
               inserted.[started_at] as startedAt, inserted.[deadline_at] as deadlineAt,
               inserted.[submitted_at] as submittedAt, inserted.[status], inserted.[score],
               inserted.[max_score] as maxScore, inserted.[percent], inserted.[passed],
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        VALUES (@id, @tenantId, @participantId, @assessmentId, @attemptTokenHash, @deadlineAt);
      `);
      return res.recordset[0]!;
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);

      const res = await req.query<Attempt>(`
        SELECT [id], [tenant_id] as tenantId, [participant_id] as participantId,
               [assessment_id] as assessmentId, [attempt_token_hash] as attemptTokenHash,
               [started_at] as startedAt, [deadline_at] as deadlineAt, [submitted_at] as submittedAt,
               [status], [score], [max_score] as maxScore, [percent], [passed],
               [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[attempts]
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      return res.recordset[0] || null;
    },
    findByParticipantId: async (tenantId, participantId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("participantId", sql.UniqueIdentifier, participantId);

      const res = await req.query<Attempt>(`
        SELECT [id], [tenant_id] as tenantId, [participant_id] as participantId,
               [assessment_id] as assessmentId, [attempt_token_hash] as attemptTokenHash,
               [started_at] as startedAt, [deadline_at] as deadlineAt, [submitted_at] as submittedAt,
               [status], [score], [max_score] as maxScore, [percent], [passed],
               [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[attempts]
        WHERE [tenant_id] = @tenantId AND [participant_id] = @participantId;
      `);
      return res.recordset[0] || null;
    },
    findByAttemptTokenHash: async (tokenHash) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tokenHash", sql.VarChar(64), tokenHash);

      const res = await req.query<{
        att_id: string; att_tenant_id: string; att_participant_id: string; att_assessment_id: string;
        att_token_hash: string; att_started_at: Date; att_deadline_at: Date; att_submitted_at: Date | null;
        att_status: Attempt["status"]; att_score: number | null; att_max_score: number | null;
        att_percent: number | null; att_passed: boolean | null; att_created_at: Date; att_updated_at: Date;
        p_id: string; p_tenant_id: string; p_assessment_id: string; p_name: string; p_email: string;
        p_invite_status: Participant["inviteStatus"]; p_token_hash: string | null;
        p_token_expires_at: Date | null; p_invited_at: Date | null; p_created_at: Date; p_updated_at: Date;
        a_id: string; a_tenant_id: string; a_title: string; a_job_description: string | null;
        a_jd_file_name: string | null; a_duration_minutes: number; a_passing_score: number;
        a_status: Assessment["status"]; a_sections_json: string; a_created_by: string;
        a_created_at: Date; a_updated_at: Date;
        t_id: string; t_name: string; t_status: Tenant["status"]; t_created_at: Date; t_updated_at: Date;
      }>(`
        SELECT att.[id] as att_id, att.[tenant_id] as att_tenant_id, att.[participant_id] as att_participant_id,
               att.[assessment_id] as att_assessment_id, att.[attempt_token_hash] as att_token_hash,
               att.[started_at] as att_started_at, att.[deadline_at] as att_deadline_at,
               att.[submitted_at] as att_submitted_at, att.[status] as att_status, att.[score] as att_score,
               att.[max_score] as att_max_score, att.[percent] as att_percent, att.[passed] as att_passed,
               att.[created_at] as att_created_at, att.[updated_at] as att_updated_at,
               p.[id] as p_id, p.[tenant_id] as p_tenant_id, p.[assessment_id] as p_assessment_id,
               p.[name] as p_name, p.[email] as p_email, p.[invite_status] as p_invite_status,
               p.[token_hash] as p_token_hash, p.[token_expires_at] as p_token_expires_at,
               p.[invited_at] as p_invited_at, p.[created_at] as p_created_at, p.[updated_at] as p_updated_at,
               a.[id] as a_id, a.[tenant_id] as a_tenant_id, a.[title] as a_title,
               a.[job_description] as a_job_description, a.[jd_file_name] as a_jd_file_name,
               a.[duration_minutes] as a_duration_minutes, a.[passing_score] as a_passing_score,
               a.[status] as a_status, a.[sections_json] as a_sections_json, a.[created_by] as a_created_by,
               a.[created_at] as a_created_at, a.[updated_at] as a_updated_at,
               t.[id] as t_id, t.[name] as t_name, t.[status] as t_status,
               t.[created_at] as t_created_at, t.[updated_at] as t_updated_at
        FROM [${this.schema}].[attempts] att
        INNER JOIN [${this.schema}].[participants] p ON att.[participant_id] = p.[id] AND att.[tenant_id] = p.[tenant_id]
        INNER JOIN [${this.schema}].[assessments] a ON att.[assessment_id] = a.[id] AND att.[tenant_id] = a.[tenant_id]
        INNER JOIN [${this.schema}].[tenants] t ON att.[tenant_id] = t.[id]
        WHERE att.[attempt_token_hash] = @tokenHash;
      `);

      const row = res.recordset[0];
      if (!row) return null;

      return {
        attempt: {
          id: row.att_id,
          tenantId: row.att_tenant_id,
          participantId: row.att_participant_id,
          assessmentId: row.att_assessment_id,
          attemptTokenHash: row.att_token_hash,
          startedAt: row.att_started_at,
          deadlineAt: row.att_deadline_at,
          submittedAt: row.att_submitted_at,
          status: row.att_status,
          score: row.att_score,
          maxScore: row.att_max_score,
          percent: row.att_percent,
          passed: row.att_passed,
          createdAt: row.att_created_at,
          updatedAt: row.att_updated_at,
        },
        participant: {
          id: row.p_id,
          tenantId: row.p_tenant_id,
          assessmentId: row.p_assessment_id,
          name: row.p_name,
          email: row.p_email,
          inviteStatus: row.p_invite_status,
          tokenHash: row.p_token_hash,
          tokenExpiresAt: row.p_token_expires_at,
          invitedAt: row.p_invited_at,
          createdAt: row.p_created_at,
          updatedAt: row.p_updated_at,
        },
        assessment: {
          id: row.a_id,
          tenantId: row.a_tenant_id,
          title: row.a_title,
          jobDescription: row.a_job_description,
          jdFileName: row.a_jd_file_name,
          durationMinutes: row.a_duration_minutes,
          passingScore: row.a_passing_score,
          status: row.a_status,
          sections: JSON.parse(row.a_sections_json),
          createdBy: row.a_created_by,
          createdAt: row.a_created_at,
          updatedAt: row.a_updated_at,
        },
        tenant: {
          id: row.t_id,
          name: row.t_name,
          status: row.t_status,
          createdAt: row.t_created_at,
          updatedAt: row.t_updated_at,
        },
      };
    },
    updateStatus: async (tenantId, id, status, submittedAt) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("status", sql.VarChar(20), status);
      req.input("submittedAt", sql.DateTime2(3), submittedAt || null);

      const res = await req.query<Attempt>(`
        UPDATE [${this.schema}].[attempts]
        SET [status] = @status,
            [submitted_at] = COALESCE(@submittedAt, [submitted_at]),
            [updated_at] = SYSUTCDATETIME()
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[participant_id] as participantId,
               inserted.[assessment_id] as assessmentId, inserted.[attempt_token_hash] as attemptTokenHash,
               inserted.[started_at] as startedAt, inserted.[deadline_at] as deadlineAt,
               inserted.[submitted_at] as submittedAt, inserted.[status], inserted.[score],
               inserted.[max_score] as maxScore, inserted.[percent], inserted.[passed],
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      return res.recordset[0] || null;
    },
    updateScores: async (tenantId, id, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("score", sql.Decimal(5, 2), data.score);
      req.input("maxScore", sql.Decimal(5, 2), data.maxScore);
      req.input("percent", sql.Decimal(5, 2), data.percent);
      req.input("passed", sql.Bit, data.passed);
      req.input("status", sql.VarChar(20), data.status || null);

      const res = await req.query<Attempt>(`
        UPDATE [${this.schema}].[attempts]
        SET [score] = @score,
            [max_score] = @maxScore,
            [percent] = @percent,
            [passed] = @passed,
            [status] = COALESCE(@status, [status]),
            [updated_at] = SYSUTCDATETIME()
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[participant_id] as participantId,
               inserted.[assessment_id] as assessmentId, inserted.[attempt_token_hash] as attemptTokenHash,
               inserted.[started_at] as startedAt, inserted.[deadline_at] as deadlineAt,
               inserted.[submitted_at] as submittedAt, inserted.[status], inserted.[score],
               inserted.[max_score] as maxScore, inserted.[percent], inserted.[passed],
               inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);
      return res.recordset[0] || null;
    },
    listByAssessment: async (tenantId, assessmentId, sort = "score") => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("assessmentId", sql.UniqueIdentifier, assessmentId);

      const orderBy = sort === "score" ? "att.[percent] DESC" : "p.[name] ASC";

      const res = await req.query<AttemptListItem>(`
        SELECT att.[id] as attemptId, p.[name], p.[email],
               att.[score], att.[max_score] as maxScore, att.[percent], att.[passed],
               DATEDIFF(SECOND, att.[started_at], att.[submitted_at]) as timeTakenSec,
               att.[status]
        FROM [${this.schema}].[attempts] att
        INNER JOIN [${this.schema}].[participants] p ON att.[participant_id] = p.[id] AND att.[tenant_id] = p.[tenant_id]
        WHERE att.[tenant_id] = @tenantId AND att.[assessment_id] = @assessmentId
        ORDER BY ${orderBy};
      `);
      return res.recordset;
    },
  };

  // ── 9. Responses ───────────────────────────────────────────────────────────
  responses: ResponsesRepository = {
    upsert: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();

      // Verify attempt deadline + 15s window
      const checkReq = new sql.Request(pool);
      checkReq.input("tenantId", sql.UniqueIdentifier, tenantId);
      checkReq.input("attemptId", sql.UniqueIdentifier, data.attemptId);
      const checkRes = await checkReq.query<{ deadline_at: Date }>(`
        SELECT [deadline_at]
        FROM [${this.schema}].[attempts]
        WHERE [tenant_id] = @tenantId AND [id] = @attemptId;
      `);

      const attemptRow = checkRes.recordset[0];
      if (!attemptRow) {
        throw new Error("Attempt not found for response");
      }

      const cutoff = new Date(attemptRow.deadline_at.getTime() + 15_000);
      const now = this.clock.now();
      if (now > cutoff) {
        throw new Error("ATTEMPT_CLOSED: Cannot save answer past the deadline window");
      }

      const id = newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("attemptId", sql.UniqueIdentifier, data.attemptId);
      req.input("questionId", sql.UniqueIdentifier, data.questionId);
      req.input("answerText", sql.NVarChar(sql.MAX), data.answerText);
      req.input("savedAt", sql.DateTime2(3), now);

      await req.query(`
        MERGE [${this.schema}].[responses] WITH (HOLDLOCK) AS target
        USING (SELECT @attemptId AS attempt_id, @questionId AS question_id) AS src
        ON (target.[attempt_id] = src.[attempt_id] AND target.[question_id] = src.[question_id])
        WHEN MATCHED THEN
          UPDATE SET [answer_text] = @answerText, [saved_at] = @savedAt
        WHEN NOT MATCHED THEN
          INSERT ([id], [tenant_id], [attempt_id], [question_id], [answer_text], [saved_at])
          VALUES (@id, @tenantId, @attemptId, @questionId, @answerText, @savedAt);
      `);

      return { savedAt: now };
    },
    listByAttempt: async (tenantId, attemptId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("attemptId", sql.UniqueIdentifier, attemptId);

      const res = await req.query<Response>(`
        SELECT [id], [tenant_id] as tenantId, [attempt_id] as attemptId,
               [question_id] as questionId, [answer_text] as answerText, [saved_at] as savedAt
        FROM [${this.schema}].[responses]
        WHERE [tenant_id] = @tenantId AND [attempt_id] = @attemptId;
      `);
      return res.recordset;
    },
  };

  // ── 10. Scores ─────────────────────────────────────────────────────────────
  scores: ScoresRepository = {
    upsert: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const id = newId();
      const now = this.clock.now();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("attemptId", sql.UniqueIdentifier, data.attemptId);
      req.input("questionId", sql.UniqueIdentifier, data.questionId);
      req.input("score", sql.Decimal(5, 2), data.score);
      req.input("maxScore", sql.Decimal(5, 2), data.maxScore);
      req.input("source", sql.VarChar(20), data.source);
      req.input("justification", sql.NVarChar(sql.MAX), data.justification || null);
      req.input("now", sql.DateTime2(3), now);

      const res = await req.query<Score>(`
        MERGE [${this.schema}].[scores] WITH (HOLDLOCK) AS target
        USING (SELECT @attemptId AS attempt_id, @questionId AS question_id) AS src
        ON (target.[attempt_id] = src.[attempt_id] AND target.[question_id] = src.[question_id])
        WHEN MATCHED THEN
          UPDATE SET [score] = @score, [max_score] = @maxScore, [source] = @source,
                     [justification] = @justification, [updated_at] = @now
        WHEN NOT MATCHED THEN
          INSERT ([id], [tenant_id], [attempt_id], [question_id], [score], [max_score], [source], [justification])
          VALUES (@id, @tenantId, @attemptId, @questionId, @score, @maxScore, @source, @justification)
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[attempt_id] as attemptId,
               inserted.[question_id] as questionId, inserted.[score], inserted.[max_score] as maxScore,
               inserted.[source], inserted.[justification], inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt;
      `);

      return res.recordset[0]!;
    },
    listByAttempt: async (tenantId, attemptId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("attemptId", sql.UniqueIdentifier, attemptId);

      const res = await req.query<Score>(`
        SELECT [id], [tenant_id] as tenantId, [attempt_id] as attemptId,
               [question_id] as questionId, [score], [max_score] as maxScore,
               [source], [justification], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[scores]
        WHERE [tenant_id] = @tenantId AND [attempt_id] = @attemptId;
      `);
      return res.recordset;
    },
  };

  // ── 11. Jobs ───────────────────────────────────────────────────────────────
  jobs: JobsRepository = {
    enqueue: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const id = newId();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("type", sql.VarChar(20), data.type);
      req.input("refId", sql.UniqueIdentifier, data.refId);
      req.input("payloadJson", sql.NVarChar(sql.MAX), JSON.stringify(data.payload));
      req.input("maxAttempts", sql.Int, data.maxAttempts ?? 3);

      const res = await req.query<{
        id: string;
        tenantId: string;
        type: Job["type"];
        status: Job["status"];
        refId: string;
        payloadJson: string;
        resultJson: string | null;
        error: string | null;
        attempts: number;
        maxAttempts: number;
        lockedAt: Date | null;
        lockedBy: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        INSERT INTO [${this.schema}].[jobs]
          ([id], [tenant_id], [type], [ref_id], [payload_json], [max_attempts])
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[type],
               inserted.[status], inserted.[ref_id] as refId, inserted.[payload_json] as payloadJson,
               inserted.[result_json] as resultJson, inserted.[error], inserted.[attempts],
               inserted.[max_attempts] as maxAttempts, inserted.[locked_at] as lockedAt,
               inserted.[locked_by] as lockedBy, inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt
        VALUES (@id, @tenantId, @type, @refId, @payloadJson, @maxAttempts);
      `);

      const r = res.recordset[0]!;
      return {
        ...r,
        payload: JSON.parse(r.payloadJson),
        result: r.resultJson ? JSON.parse(r.resultJson) : null,
      };
    },
    findById: async (tenantId, id) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("id", sql.UniqueIdentifier, id);

      const res = await req.query<{
        id: string;
        tenantId: string;
        type: Job["type"];
        status: Job["status"];
        refId: string;
        payloadJson: string;
        resultJson: string | null;
        error: string | null;
        attempts: number;
        maxAttempts: number;
        lockedAt: Date | null;
        lockedBy: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        SELECT [id], [tenant_id] as tenantId, [type], [status], [ref_id] as refId,
               [payload_json] as payloadJson, [result_json] as resultJson, [error],
               [attempts], [max_attempts] as maxAttempts, [locked_at] as lockedAt,
               [locked_by] as lockedBy, [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[jobs]
        WHERE [tenant_id] = @tenantId AND [id] = @id;
      `);

      const r = res.recordset[0];
      if (!r) return null;
      return {
        ...r,
        payload: JSON.parse(r.payloadJson),
        result: r.resultJson ? JSON.parse(r.resultJson) : null,
      };
    },
    claimNext: async (workerId) => {
      // Cross-tenant system query for job worker using UPDLOCK and READPAST
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("workerId", sql.NVarChar(100), workerId);

      const res = await req.query<{
        id: string;
        tenantId: string;
        type: Job["type"];
        status: Job["status"];
        refId: string;
        payloadJson: string;
        resultJson: string | null;
        error: string | null;
        attempts: number;
        maxAttempts: number;
        lockedAt: Date | null;
        lockedBy: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        WITH cte AS (
          SELECT TOP (1) *
          FROM [${this.schema}].[jobs] WITH (UPDLOCK, READPAST)
          WHERE [status] = 'queued' AND [attempts] < [max_attempts]
          ORDER BY [created_at] ASC
        )
        UPDATE cte
        SET [status] = 'running',
            [locked_by] = @workerId,
            [locked_at] = SYSUTCDATETIME(),
            [attempts] = [attempts] + 1,
            [updated_at] = SYSUTCDATETIME()
        OUTPUT inserted.[id], inserted.[tenant_id] as tenantId, inserted.[type],
               inserted.[status], inserted.[ref_id] as refId, inserted.[payload_json] as payloadJson,
               inserted.[result_json] as resultJson, inserted.[error], inserted.[attempts],
               inserted.[max_attempts] as maxAttempts, inserted.[locked_at] as lockedAt,
               inserted.[locked_by] as lockedBy, inserted.[created_at] as createdAt, inserted.[updated_at] as updatedAt;
      `);

      const r = res.recordset[0];
      if (!r) return null;
      return {
        ...r,
        payload: JSON.parse(r.payloadJson),
        result: r.resultJson ? JSON.parse(r.resultJson) : null,
      };
    },
    complete: async (id, result) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("resultJson", sql.NVarChar(sql.MAX), result !== undefined ? JSON.stringify(result) : null);

      await req.query(`
        UPDATE [${this.schema}].[jobs]
        SET [status] = 'done',
            [result_json] = @resultJson,
            [locked_by] = NULL,
            [locked_at] = NULL,
            [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @id;
      `);
    },
    fail: async (id, error) => {
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, id);
      req.input("error", sql.NVarChar(sql.MAX), error);

      await req.query(`
        UPDATE [${this.schema}].[jobs]
        SET [status] = 'failed',
            [error] = @error,
            [locked_by] = NULL,
            [locked_at] = NULL,
            [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @id;
      `);
    },
    countDailyGenerations: async (tenantId, dateUtc) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const startOfDay = new Date(
        Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), 0, 0, 0)
      );
      const endOfDay = new Date(
        Date.UTC(dateUtc.getUTCFullYear(), dateUtc.getUTCMonth(), dateUtc.getUTCDate(), 23, 59, 59, 999)
      );

      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("startOfDay", sql.DateTime2(3), startOfDay);
      req.input("endOfDay", sql.DateTime2(3), endOfDay);

      const res = await req.query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt
        FROM [${this.schema}].[jobs]
        WHERE [tenant_id] = @tenantId AND [type] = 'generate'
          AND [created_at] >= @startOfDay AND [created_at] <= @endOfDay;
      `);
      return res.recordset[0]?.cnt || 0;
    },
  };

  // ── 12. Audit ──────────────────────────────────────────────────────────────
  audit: AuditRepository = {
    log: async (tenantId, data) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("id", sql.UniqueIdentifier, newId());
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("actorId", sql.UniqueIdentifier, data.actorId || null);
      req.input("action", sql.VarChar(50), data.action);
      req.input("entityType", sql.VarChar(50), data.entityType);
      req.input("entityId", sql.UniqueIdentifier, data.entityId);
      req.input("detailsJson", sql.NVarChar(sql.MAX), data.details ? JSON.stringify(data.details) : null);

      await req.query(`
        INSERT INTO [${this.schema}].[audit_log]
          ([id], [tenant_id], [actor_id], [action], [entity_type], [entity_id], [details_json])
        VALUES (@id, @tenantId, @actorId, @action, @entityType, @entityId, @detailsJson);
      `);
    },
    listByEntity: async (tenantId, entityType, entityId) => {
      assertTenant(tenantId);
      const pool = await getPool();
      const req = new sql.Request(pool);
      req.input("tenantId", sql.UniqueIdentifier, tenantId);
      req.input("entityType", sql.VarChar(50), entityType);
      req.input("entityId", sql.UniqueIdentifier, entityId);

      const res = await req.query<{
        id: string;
        tenantId: string;
        actorId: string | null;
        action: string;
        entityType: string;
        entityId: string;
        detailsJson: string | null;
        createdAt: Date;
      }>(`
        SELECT [id], [tenant_id] as tenantId, [actor_id] as actorId, [action],
               [entity_type] as entityType, [entity_id] as entityId,
               [details_json] as detailsJson, [created_at] as createdAt
        FROM [${this.schema}].[audit_log]
        WHERE [tenant_id] = @tenantId AND [entity_type] = @entityType AND [entity_id] = @entityId
        ORDER BY [created_at] DESC;
      `);

      return res.recordset.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        actorId: r.actorId,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        details: r.detailsJson ? JSON.parse(r.detailsJson) : null,
        createdAt: r.createdAt,
      }));
    },
  };

  // ── 13. System (Cross-Tenant Queries) ──────────────────────────────────────
  system: SystemRepository = {
    claimNextJob: async (workerId) => {
      return this.jobs.claimNext(workerId);
    },
    findExpiredAttempts: async (now) => {
      const pool = await getPool();
      const cutoff = new Date(now.getTime() - 15_000);
      const req = new sql.Request(pool);
      req.input("cutoff", sql.DateTime2(3), cutoff);

      const res = await req.query<{
        id: string;
        tenantId: string;
        participantId: string;
        assessmentId: string;
        attemptTokenHash: string;
        startedAt: Date;
        deadlineAt: Date;
        submittedAt: Date | null;
        status: Attempt["status"];
        score: number | null;
        maxScore: number | null;
        percent: number | null;
        passed: boolean | null;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        SELECT [id], [tenant_id] as tenantId, [participant_id] as participantId,
               [assessment_id] as assessmentId, [attempt_token_hash] as attemptTokenHash,
               [started_at] as startedAt, [deadline_at] as deadlineAt,
               [submitted_at] as submittedAt, [status], [score], [max_score] as maxScore,
               [percent], [passed], [created_at] as createdAt, [updated_at] as updatedAt
        FROM [${this.schema}].[attempts]
        WHERE [status] = 'in_progress' AND [deadline_at] < @cutoff
        ORDER BY [deadline_at] ASC;
      `);

      return res.recordset.map((r) => ({
        ...r,
        score: r.score !== null ? Number(r.score) : null,
        maxScore: r.maxScore !== null ? Number(r.maxScore) : null,
        percent: r.percent !== null ? Number(r.percent) : null,
      }));
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

  async withTransaction<T>(fn: (repos: Repositories) => Promise<T>): Promise<T> {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    const req = new sql.Request(tx);
    await req.batch("SET XACT_ABORT ON;");

    try {
      const result = await fn(this);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // rollback error suppressed
      }
      throw err;
    }
  }
}
