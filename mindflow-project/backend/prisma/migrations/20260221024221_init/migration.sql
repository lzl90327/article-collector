-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "substate" TEXT NOT NULL DEFAULT 'idle',
    "pending_input" TEXT,
    "state_json" JSONB NOT NULL DEFAULT '{}',
    "brief_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "meta_json" JSONB NOT NULL DEFAULT '{}',
    "source_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "seq" INTEGER NOT NULL DEFAULT 0,
    "snapshot" TEXT NOT NULL DEFAULT '',
    "progress_json" JSONB,
    "error_json" JSONB,
    "inputs_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "credential_json" JSONB NOT NULL,
    "default_target_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_json" JSONB,
    "error_message" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "steps_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_queue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT,
    "session_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_digest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "materials_count" INTEGER NOT NULL,
    "materials_json" JSONB NOT NULL,
    "theme_clusters_json" JSONB NOT NULL,
    "cross_theme_tension" TEXT,
    "contrarian_questions_json" JSONB NOT NULL,
    "deep_dive_candidates_json" JSONB NOT NULL,
    "feishu_doc_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_digest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_cards" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "article_title" TEXT NOT NULL,
    "publish_date" TIMESTAMP(3) NOT NULL,
    "metrics_json" JSONB NOT NULL,
    "top3_objections_json" JSONB NOT NULL,
    "keep_items_json" JSONB NOT NULL,
    "change_items_json" JSONB NOT NULL,
    "next_hypothesis" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socratic_sessions" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "current_depth" INTEGER NOT NULL,
    "questions_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socratic_sessions_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_queue" ADD CONSTRAINT "topic_queue_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
