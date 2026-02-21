-- Migration: Create MindFlow Tables

CREATE TABLE IF NOT EXISTS mindflow_workflows (
    id UUID PRIMARY KEY,
    user_id TEXT,
    status TEXT DEFAULT 'active',
    current_phase NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mindflow_context (
    workflow_id UUID REFERENCES mindflow_workflows(id) ON DELETE CASCADE,
    data JSONB,
    PRIMARY KEY (workflow_id)
);

CREATE TABLE IF NOT EXISTS mindflow_history (
    id SERIAL PRIMARY KEY,
    workflow_id UUID REFERENCES mindflow_workflows(id) ON DELETE CASCADE,
    role TEXT,
    content TEXT,
    timestamp BIGINT
);

-- Enable RLS (Row Level Security)
ALTER TABLE mindflow_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindflow_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindflow_history ENABLE ROW LEVEL SECURITY;

-- Policies (Open for now, tighten later when auth is ready)
CREATE POLICY "Enable all access for now" ON mindflow_workflows FOR ALL USING (true);
CREATE POLICY "Enable all access for now" ON mindflow_context FOR ALL USING (true);
CREATE POLICY "Enable all access for now" ON mindflow_history FOR ALL USING (true);

