-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "substate" TEXT NOT NULL DEFAULT 'idle',
    "pending_input" TEXT,
    "state_json" TEXT NOT NULL DEFAULT '{}',
    "brief_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "meta_json" TEXT NOT NULL DEFAULT '{}',
    "source_job_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifacts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "seq" INTEGER NOT NULL DEFAULT 0,
    "snapshot" TEXT NOT NULL DEFAULT '',
    "progress_json" TEXT,
    "error_json" TEXT,
    "inputs_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "credential_json" TEXT NOT NULL,
    "default_target_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_json" TEXT,
    "error_message" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "presets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "steps_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "topic_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT,
    "session_id" TEXT,
    "scheduled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "topic_queue_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_digest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "week_start" DATETIME NOT NULL,
    "week_end" DATETIME NOT NULL,
    "materials_count" INTEGER NOT NULL,
    "materials_json" TEXT NOT NULL,
    "theme_clusters_json" TEXT NOT NULL,
    "cross_theme_tension" TEXT,
    "contrarian_questions_json" TEXT NOT NULL,
    "deep_dive_candidates_json" TEXT NOT NULL,
    "feishu_doc_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "retro_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "article_title" TEXT NOT NULL,
    "publish_date" DATETIME NOT NULL,
    "metrics_json" TEXT NOT NULL,
    "top3_objections_json" TEXT NOT NULL,
    "keep_items_json" TEXT NOT NULL,
    "change_items_json" TEXT NOT NULL,
    "next_hypothesis" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "socratic_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "current_depth" INTEGER NOT NULL,
    "questions_json" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "summary" TEXT,
    "url" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncError" TEXT,
    "feishuWikiToken" TEXT,
    "feishuRecordId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "phase" TEXT NOT NULL DEFAULT '3',
    "userId" TEXT NOT NULL,
    "feishuWikiToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "viewpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "sourceArticle" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "nickname" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "skill_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sync_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "lastSyncAt" DATETIME NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "feishu_auths" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "openId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "audioUrl" TEXT,
    "userId" TEXT NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ideas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "consolidatedSummary" TEXT,
    "userAction" TEXT,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "agent_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewReportId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issues" TEXT,
    "summary" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "agent_reviews_reviewReportId_fkey" FOREIGN KEY ("reviewReportId") REFERENCES "review_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consolidated_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewReportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionStart" INTEGER,
    "positionEnd" INTEGER,
    "original" TEXT NOT NULL,
    "replacement" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "consensus" TEXT NOT NULL,
    "modelVotes" TEXT NOT NULL,
    CONSTRAINT "consolidated_suggestions_reviewReportId_fkey" FOREIGN KEY ("reviewReportId") REFERENCES "review_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "sessions_phase_idx" ON "sessions"("phase");

-- CreateIndex
CREATE INDEX "sessions_substate_idx" ON "sessions"("substate");

-- CreateIndex
CREATE INDEX "sessions_brief_confirmed_idx" ON "sessions"("brief_confirmed");

-- CreateIndex
CREATE INDEX "sessions_created_at_idx" ON "sessions"("created_at");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "artifacts_session_id_idx" ON "artifacts"("session_id");

-- CreateIndex
CREATE INDEX "artifacts_kind_idx" ON "artifacts"("kind");

-- CreateIndex
CREATE INDEX "artifacts_session_id_kind_version_idx" ON "artifacts"("session_id", "kind", "version");

-- CreateIndex
CREATE INDEX "artifacts_created_at_idx" ON "artifacts"("created_at");

-- CreateIndex
CREATE INDEX "jobs_session_id_idx" ON "jobs"("session_id");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_session_id_created_at_idx" ON "jobs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "job_events_job_id_idx" ON "job_events"("job_id");

-- CreateIndex
CREATE INDEX "job_events_created_at_idx" ON "job_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_events_job_id_seq_key" ON "job_events"("job_id", "seq");

-- CreateIndex
CREATE INDEX "integrations_provider_idx" ON "integrations"("provider");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "integrations"("status");

-- CreateIndex
CREATE INDEX "sync_logs_session_id_idx" ON "sync_logs"("session_id");

-- CreateIndex
CREATE INDEX "sync_logs_integration_id_idx" ON "sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs"("created_at");

-- CreateIndex
CREATE INDEX "presets_is_default_idx" ON "presets"("is_default");

-- CreateIndex
CREATE INDEX "topic_queue_status_idx" ON "topic_queue"("status");

-- CreateIndex
CREATE INDEX "topic_queue_priority_idx" ON "topic_queue"("priority");

-- CreateIndex
CREATE INDEX "topic_queue_created_at_idx" ON "topic_queue"("created_at");

-- CreateIndex
CREATE INDEX "topic_queue_session_id_idx" ON "topic_queue"("session_id");

-- CreateIndex
CREATE INDEX "weekly_digest_user_id_idx" ON "weekly_digest"("user_id");

-- CreateIndex
CREATE INDEX "weekly_digest_week_start_idx" ON "weekly_digest"("week_start");

-- CreateIndex
CREATE INDEX "weekly_digest_week_end_idx" ON "weekly_digest"("week_end");

-- CreateIndex
CREATE INDEX "weekly_digest_created_at_idx" ON "weekly_digest"("created_at");

-- CreateIndex
CREATE INDEX "retro_cards_article_id_idx" ON "retro_cards"("article_id");

-- CreateIndex
CREATE INDEX "retro_cards_publish_date_idx" ON "retro_cards"("publish_date");

-- CreateIndex
CREATE INDEX "retro_cards_created_at_idx" ON "retro_cards"("created_at");

-- CreateIndex
CREATE INDEX "socratic_sessions_is_active_idx" ON "socratic_sessions"("is_active");

-- CreateIndex
CREATE INDEX "socratic_sessions_created_at_idx" ON "socratic_sessions"("created_at");

-- CreateIndex
CREATE INDEX "socratic_sessions_updated_at_idx" ON "socratic_sessions"("updated_at");

-- CreateIndex
CREATE INDEX "sources_type_idx" ON "sources"("type");

-- CreateIndex
CREATE INDEX "sources_syncStatus_idx" ON "sources"("syncStatus");

-- CreateIndex
CREATE INDEX "sources_createdAt_idx" ON "sources"("createdAt");

-- CreateIndex
CREATE INDEX "articles_status_idx" ON "articles"("status");

-- CreateIndex
CREATE INDEX "articles_userId_idx" ON "articles"("userId");

-- CreateIndex
CREATE INDEX "articles_createdAt_idx" ON "articles"("createdAt");

-- CreateIndex
CREATE INDEX "viewpoints_createdAt_idx" ON "viewpoints"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- CreateIndex
CREATE INDEX "users_openid_idx" ON "users"("openid");

-- CreateIndex
CREATE INDEX "skill_configs_isActive_idx" ON "skill_configs"("isActive");

-- CreateIndex
CREATE INDEX "skill_configs_version_idx" ON "skill_configs"("version");

-- CreateIndex
CREATE INDEX "sync_records_type_idx" ON "sync_records"("type");

-- CreateIndex
CREATE INDEX "sync_records_status_idx" ON "sync_records"("status");

-- CreateIndex
CREATE INDEX "sync_records_createdAt_idx" ON "sync_records"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "feishu_auths_userId_key" ON "feishu_auths"("userId");

-- CreateIndex
CREATE INDEX "feishu_auths_userId_idx" ON "feishu_auths"("userId");

-- CreateIndex
CREATE INDEX "feishu_auths_openId_idx" ON "feishu_auths"("openId");

-- CreateIndex
CREATE INDEX "ideas_userId_idx" ON "ideas"("userId");

-- CreateIndex
CREATE INDEX "ideas_synced_idx" ON "ideas"("synced");

-- CreateIndex
CREATE INDEX "ideas_createdAt_idx" ON "ideas"("createdAt");

-- CreateIndex
CREATE INDEX "review_reports_articleId_idx" ON "review_reports"("articleId");

-- CreateIndex
CREATE INDEX "review_reports_userId_idx" ON "review_reports"("userId");

-- CreateIndex
CREATE INDEX "review_reports_status_idx" ON "review_reports"("status");

-- CreateIndex
CREATE INDEX "review_reports_createdAt_idx" ON "review_reports"("createdAt");

-- CreateIndex
CREATE INDEX "agent_reviews_reviewReportId_idx" ON "agent_reviews"("reviewReportId");

-- CreateIndex
CREATE INDEX "agent_reviews_agentName_idx" ON "agent_reviews"("agentName");

-- CreateIndex
CREATE INDEX "agent_reviews_status_idx" ON "agent_reviews"("status");

-- CreateIndex
CREATE INDEX "consolidated_suggestions_reviewReportId_idx" ON "consolidated_suggestions"("reviewReportId");
