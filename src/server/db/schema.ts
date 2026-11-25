import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const examTypeEnum = pgEnum("exam_type", [
  "REGULAR",
  "SUPPLY",
  "MID_1",
  "MID_2",
]);

export const paperStatusEnum = pgEnum("paper_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
]);

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "MODERATOR"]);

export const reportStatusEnum = pgEnum("report_status", [
  "OPEN",
  "RESOLVED",
  "DISMISSED",
]);

export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const regulations = pgTable("regulations", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  startYear: integer("start_year").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 24 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    regulationId: uuid("regulation_id")
      .notNull()
      .references(() => regulations.id, { onDelete: "restrict" }),
    yearOfStudy: smallint("year_of_study").notNull(),
    semester: smallint("semester").notNull(),
    isCommonFirstYear: boolean("is_common_first_year").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_subjects_code_branch_reg").on(
      table.code,
      table.branchId,
      table.regulationId
    ),
    index("idx_subjects_year_sem_branch").on(
      table.yearOfStudy,
      table.semester,
      table.branchId
    ),
  ]
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("MODERATOR"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const papers = pgTable(
  "papers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackingCode: varchar("tracking_code", { length: 24 }).notNull().unique(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    regulationId: uuid("regulation_id")
      .notNull()
      .references(() => regulations.id, { onDelete: "restrict" }),
    yearOfStudy: smallint("year_of_study").notNull(),
    semester: smallint("semester").notNull(),
    examType: examTypeEnum("exam_type").notNull(),
    examMonth: smallint("exam_month").notNull(),
    examYear: smallint("exam_year").notNull(),
    setLabel: varchar("set_label", { length: 40 }),
    storageKey: varchar("storage_key", { length: 300 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    pageCount: integer("page_count").notNull(),
    sha256Hash: char("sha256_hash", { length: 64 }).notNull(),
    status: paperStatusEnum("status").notNull().default("PENDING"),
    uploaderName: varchar("uploader_name", { length: 80 }),
    uploaderEmail: varchar("uploader_email", { length: 160 }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    downloadCount: integer("download_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_papers_public_filter").on(
      table.status,
      table.yearOfStudy,
      table.semester,
      table.branchId,
      table.examType,
      table.examYear
    ),
    index("idx_papers_sha256").on(table.sha256Hash),
    index("idx_papers_subject").on(table.subjectId),
  ]
);

export const paperReports = pgTable("paper_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  paperId: uuid("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 120 }).notNull(),
  details: text("details"),
  reporterIpHash: char("reporter_ip_hash", { length: 64 }).notNull(),
  status: reportStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_audit_logs_created").on(table.createdAt)]
);
