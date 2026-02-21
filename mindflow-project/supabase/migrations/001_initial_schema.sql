-- MindFlow 初始数据库 Schema
-- 创建时间: 2025-02-17

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 工作流状态表
CREATE TABLE IF NOT EXISTS mindflow_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) UNIQUE NOT NULL,
    current_phase VARCHAR(50) NOT NULL DEFAULT 'BRIEF',
    context JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 工作流历史消息表
CREATE TABLE IF NOT EXISTS mindflow_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL REFERENCES mindflow_workflows(workflow_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 文章草稿表
CREATE TABLE IF NOT EXISTS mindflow_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL REFERENCES mindflow_workflows(workflow_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 审计报告表
CREATE TABLE IF NOT EXISTS mindflow_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL REFERENCES mindflow_workflows(workflow_id) ON DELETE CASCADE,
    auditor_role VARCHAR(100) NOT NULL,
    score INTEGER CHECK (score >= 0 AND score <= 10),
    criticisms JSONB DEFAULT '[]',
    suggestions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_workflows_workflow_id ON mindflow_workflows(workflow_id);
CREATE INDEX idx_workflows_status ON mindflow_workflows(status);
CREATE INDEX idx_history_workflow_id ON mindflow_history(workflow_id);
CREATE INDEX idx_history_timestamp ON mindflow_history(timestamp);
CREATE INDEX idx_drafts_workflow_id ON mindflow_drafts(workflow_id);
CREATE INDEX idx_audits_workflow_id ON mindflow_audits(workflow_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON mindflow_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at
    BEFORE UPDATE ON mindflow_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加表注释
COMMENT ON TABLE mindflow_workflows IS 'MindFlow 工作流主表';
COMMENT ON TABLE mindflow_history IS '工作流对话历史';
COMMENT ON TABLE mindflow_drafts IS '文章草稿';
COMMENT ON TABLE mindflow_audits IS '审计报告';
