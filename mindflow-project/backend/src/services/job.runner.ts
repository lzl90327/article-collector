/**
 * Job Runner
 * 异步任务执行器：集成 Phase 处理器
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import {
  updateJobStatus,
  updateJobSnapshot,
  updateJobProgress,
  updateJobError,
} from './job.service';
import {
  createEventStream,
  emitStarted,
  emitDelta,
  emitProgress,
  emitCompleted,
} from './sse.service';
import { PhaseRegistry, PhaseContext } from '../phases';
import type { Job, JobInputs } from '../types/job';

// 模拟文本段落（用于测试）
const MOCK_PARAGRAPHS = [
  '在当今快速发展的数字时代，人工智能正在深刻改变着我们的工作和生活方式。',
  '从智能助手到自动化工具，AI 技术已经渗透到各个领域，为企业和个人带来了前所未有的效率提升。',
  '然而，这种变革也带来了新的挑战和思考。',
  '我们需要在拥抱技术进步的同时，保持对伦理和社会影响的关注。',
  '只有在创新与责任之间找到平衡，才能真正实现可持续的发展。',
];

/**
 * 启动 Job 执行
 */
export async function startJob(job: Job): Promise<void> {
  const { id: jobId, session_id, task, phase } = job;

  try {
    // 创建事件流
    createEventStream(jobId);

    // 更新状态为 running
    await updateJobStatus(jobId, 'running');

    // 发送 started 事件
    emitStarted(jobId, session_id, task, phase);

    logger.info(`Job 开始执行: ${jobId}`, { task, phase });

    // 根据任务类型执行不同的逻辑
    switch (task) {
      case 'generate_brief':
        await runPhaseJob(job, '-1');
        break;
      case 'generate_outline':
        await runGenerateOutline(job);
        break;
      case 'generate_draft':
        await runPhaseJob(job, '4');
        break;
      case 'audit_draft':
        await runPhaseJob(job, '4.5');
        break;
      case 'review':
        await runReview(job);
        break;
      case 'rewrite_paragraph':
        await runRewriteParagraph(job);
        break;
      case 'publish_dry_run':
        await runPublishDryRun(job);
        break;
      case 'publish':
        await runPublish(job);
        break;
      default:
        throw new Error(`未知任务类型: ${task}`);
    }

    // 更新状态为 completed
    await updateJobStatus(jobId, 'completed');

    // 发送 completed 事件
    const finalSeq = job.seq + MOCK_PARAGRAPHS.length + 1;
    emitCompleted(jobId, finalSeq);

    logger.info(`Job 执行完成: ${jobId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    logger.error(`Job 执行失败: ${jobId}`, error);

    // 更新错误状态
    await updateJobError(jobId, {
      code: 'JOB_EXECUTION_ERROR',
      message: errorMessage,
      retryable: true,
    });

    throw error;
  }
}

/**
 * 模拟流式输出
 */
async function streamOutput(
  jobId: string,
  startSeq: number,
  paragraphs: string[]
): Promise<number> {
  let seq = startSeq;
  let snapshot = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];

    // 模拟逐字输出
    const chars = paragraph.split('');
    for (const char of chars) {
      seq++;
      snapshot += char;

      // 每 5 个字符发送一次 delta（减少事件频率）
      if (seq % 5 === 0) {
        emitDelta(jobId, seq, char);
        await updateJobSnapshot(jobId, seq, snapshot);
      }

      // 模拟延迟
      await delay(20);
    }

    // 段落结束添加换行
    seq++;
    snapshot += '\n\n';
    emitDelta(jobId, seq, '\n\n');
    await updateJobSnapshot(jobId, seq, snapshot);

    // 发送进度
    const percent = (i + 1) / paragraphs.length;
    emitProgress(jobId, seq, 'generating', percent);
    await updateJobProgress(jobId, 'generating', percent);

    // 段落间延迟
    await delay(100);
  }

  return seq;
}

/**
 * 生成大纲任务
 */
async function runGenerateOutline(job: Job): Promise<void> {
  const outline = [
    '## 一、引言',
    '介绍 AI 技术的背景和现状',
    '',
    '## 二、主要观点',
    '2.1 AI 带来的效率提升',
    '2.2 AI 引发的伦理思考',
    '',
    '## 三、结论',
    '平衡创新与责任的重要性',
  ];

  await streamOutput(job.id, job.seq, outline);
}

/**
 * 生成草稿任务
 */
async function runGenerateDraft(job: Job): Promise<void> {
  await streamOutput(job.id, job.seq, MOCK_PARAGRAPHS);
}

/**
 * 审阅任务
 */
async function runReview(job: Job): Promise<void> {
  const reviewComments = [
    '【结构建议】文章整体结构清晰，但第二部分可以进一步展开。',
    '【内容建议】建议增加具体的案例来支撑论点。',
    '【语言建议】部分句子较长，建议适当拆分以提高可读性。',
  ];

  await streamOutput(job.id, job.seq, reviewComments);
}

/**
 * 段落重写任务
 */
async function runRewriteParagraph(job: Job): Promise<void> {
  const { inputs_json } = job;
  const instruction = (inputs_json as JobInputs).instruction || '优化表达';

  const rewritten = [
    `【根据指令"${instruction}"重写】`,
    MOCK_PARAGRAPHS[0],
    MOCK_PARAGRAPHS[1],
  ];

  await streamOutput(job.id, job.seq, rewritten);
}

/**
 * 发布预演任务
 */
async function runPublishDryRun(job: Job): Promise<void> {
  const dryRunResult = [
    '## 发布预演结果',
    '',
    '✓ 内容格式检查通过',
    '✓ 敏感词检查通过',
    '⚠ 标题长度建议控制在 20 字以内',
    '',
    '执行计划：',
    '1. 保存发布记录',
    '2. 同步到飞书多维表格',
    '3. 创建微信公众号草稿',
  ];

  await streamOutput(job.id, job.seq, dryRunResult);
}

/**
 * 发布任务
 */
async function runPublish(job: Job): Promise<void> {
  const publishResult = [
    '## 发布执行结果',
    '',
    '✓ 发布记录已保存',
    '✓ 飞书多维表格同步成功',
    '  - 记录 ID: rec_abc123',
    '✓ 微信公众号草稿创建成功',
    '  - 草稿 ID: draft_xyz789',
    '',
    '发布完成！',
  ];

  await streamOutput(job.id, job.seq, publishResult);
}

/**
 * 执行 Phase Job
 */
async function runPhaseJob(job: Job, phaseId: string): Promise<void> {
  const phase = PhaseRegistry.get(phaseId);
  if (!phase) {
    throw new Error(`Phase not found: ${phaseId}`);
  }

  // 获取 Session 和 Artifacts
  const session = await prisma.session.findUnique({
    where: { id: job.session_id },
  });

  if (!session) {
    throw new Error(`Session not found: ${job.session_id}`);
  }

  const artifacts = await prisma.artifact.findMany({
    where: { session_id: job.session_id },
  });

  // 构建 Phase 上下文
  const context: PhaseContext = {
    session,
    artifacts,
    job,
    inputs: job.inputs_json as Record<string, any>,
  };

  // 执行 Phase
  const result = await phase.execute(context);

  if (!result.success) {
    throw new Error(result.error || 'Phase execution failed');
  }

  // 如果有消息，通过 SSE 发送
  if (result.messages && result.messages.length > 0) {
    for (const message of result.messages) {
      emitDelta(job.id, job.seq + 1, message.content);
    }
  }

  // 更新 Job snapshot
  const snapshot = result.messages?.map((m) => m.content).join('\n') || '';
  await updateJobSnapshot(job.id, job.seq + 1, snapshot);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
