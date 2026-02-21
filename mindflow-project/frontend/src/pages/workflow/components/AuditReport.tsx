import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PhaseId, PhaseMetadata, PendingInput } from '../../../types/phase';
import './AuditReport.scss';

// Backend AuditReport type
interface BackendAuditReport {
  auditor_role: string;
  score: number;
  criticisms: string[];
  suggestions: string[];
}

// 新 Props 接口（适配 Phase 系统）
interface AuditReportNewProps {
  workflowId: string;
  phaseId: PhaseId;
  phaseMeta?: PhaseMetadata;
  fields: Map<string, unknown>;
  pendingInput?: PendingInput | null;
  loading?: boolean;
  onSubmitInput: (field: string, value: unknown) => void;
  onTriggerPhase: (targetPhase?: string) => void;
  onSendMessage?: (message: string) => void;
}

// 兼容旧 Props 接口
interface AuditReportLegacyProps {
  report: BackendAuditReport | BackendAuditReport[] | undefined;
  onConfirm: () => void;
  loading?: boolean;
  onRetry?: () => void;
}

type AuditReportProps = AuditReportNewProps | AuditReportLegacyProps;

// 判断是否是新 Props
function isNewProps(props: AuditReportProps): props is AuditReportNewProps {
  return 'workflowId' in props;
}

// 加载状态组件
const LoadingState: React.FC<{ elapsedTime?: number; onRetry?: () => void }> = ({
  elapsedTime = 0,
  onRetry
}) => {
  const [dots, setDots] = useState('.');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    '正在分析文章结构...',
    '正在评估内容质量...',
    '正在检查逻辑连贯性...',
    '正在生成改进建议...',
    '正在汇总审计结果...'
  ];

  useEffect(() => {
    // 动画点
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.');
    }, 500);

    // 进度条
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 800);

    // 阶段切换
    const stageInterval = setInterval(() => {
      setStage(prev => (prev + 1) % stages.length);
    }, 2000);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(progressInterval);
      clearInterval(stageInterval);
    };
  }, []);

  // 如果超过 60 秒，显示重试按钮
  const showRetry = elapsedTime > 60;

  return (
    <View className='audit-loading-container'>
      <View className='audit-loading-icon'>
        <View className='loading-spinner'></View>
      </View>
      <Text className='audit-loading-title'>赛博编辑部正在审计{dots}</Text>
      <Text className='audit-loading-stage'>{stages[stage]}</Text>
      <View className='audit-progress-bar'>
        <View
          className='audit-progress-fill'
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </View>
      <Text className='audit-loading-hint'>
        {showRetry
          ? `已等待 ${Math.floor(elapsedTime)} 秒，可能出现问题`
          : '预计需要 30-60 秒，请耐心等待'
        }
      </Text>
      {showRetry && onRetry && (
        <View className='audit-retry-btn' onClick={onRetry}>
          <Text>重新加载</Text>
        </View>
      )}
    </View>
  );
};

export const AuditReport: React.FC<AuditReportProps> = (props) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // 根据 Props 类型获取数据
  const report = isNewProps(props)
    ? (props.fields.get('audit_checks') as BackendAuditReport | BackendAuditReport[])
    : props.report;

  const loading = props.loading;

  // 计时器
  useEffect(() => {
    if (loading || !report) {
      const timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedTime(0);
    }
  }, [loading, report]);

  // Debug log
  console.log('[AuditReport] Received report:', report, 'loading:', loading, 'elapsed:', elapsedTime);

  const handleConfirm = () => {
    if (isNewProps(props)) {
      // 新接口：触发 Phase 转换
      props.onTriggerPhase();
    } else {
      // 旧接口：直接调用 onConfirm
      props.onConfirm();
    }
  };

  const handleRetry = () => {
    if (isNewProps(props)) {
      // 新接口：触发 Phase 重新生成审计报告
      props.onTriggerPhase();
    } else if ('onRetry' in props && props.onRetry) {
      // 旧接口：调用 onRetry
      props.onRetry();
    }
  };

  // Safety check for report data
  if (!report || loading) {
    return <LoadingState elapsedTime={elapsedTime} onRetry={handleRetry} />;
  }

  // Handle both single report and array of reports
  const reports = Array.isArray(report) ? report : [report];

  // 检查报告数据是否有效
  const validReports = reports.filter(r => r && (r.score !== undefined || r.criticisms || r.suggestions));

  if (validReports.length === 0) {
    return (
      <View className='audit-container'>
        <Text className='audit-header'>赛博编辑部审计报告</Text>
        <View className='audit-empty-state'>
          <Text className='audit-empty-icon'>📝</Text>
          <Text className='audit-empty-text'>暂无审计报告</Text>
          <View className='audit-retry-btn' onClick={handleRetry}>
            <Text>重新加载</Text>
          </View>
        </View>
      </View>
    );
  }

  // Calculate average score
  const averageScore = validReports.reduce((sum, r) => sum + (r.score ?? 0), 0) / validReports.length;

  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 8) return '#52c41a'; // 绿色
    if (score >= 6) return '#faad14'; // 黄色
    return '#f5222d'; // 红色
  };

  const renderScore = () => {
    const scoreColor = getScoreColor(averageScore);

    return (
      <View className='radar-container'>
        <View className='total-score' style={{ borderColor: scoreColor }}>
          <Text className='score-text' style={{ color: scoreColor }}>
            {averageScore.toFixed(1)}
          </Text>
          <Text className='score-label'>综合评分</Text>
        </View>
        <View className='dimension-list'>
          {validReports.map((r, idx) => {
            const itemColor = getScoreColor(r.score ?? 0);
            return (
              <View key={idx} className='dimension-item'>
                <Text className='dim-label'>{r.auditor_role || '审计员'}</Text>
                <View className='progress-bar'>
                  <View
                    className='progress-fill'
                    style={{
                      width: `${(r.score ?? 0) * 10}%`,
                      backgroundColor: itemColor
                    }}
                  />
                </View>
                <Text className='dim-score' style={{ color: itemColor }}>
                  {r.score ?? 0}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderCriticisms = () => {
    const allCriticisms = validReports.flatMap(r => r.criticisms || []);

    if (allCriticisms.length === 0) {
      return (
        <View className='issues-container'>
          <Text className='issues-title'>🎯 批评意见</Text>
          <View className='no-issues-box'>
            <Text className='no-issues-icon'>✨</Text>
            <Text className='no-issues'>太棒了！暂无批评意见</Text>
          </View>
        </View>
      );
    }

    return (
      <View className='issues-container'>
        <Text className='issues-title'>🎯 批评意见</Text>
        {allCriticisms.map((issue, idx) => (
          <View key={idx} className='issue-item'>
            <Text className='issue-bullet'>•</Text>
            <Text className='issue-text'>{issue}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSuggestions = () => {
    const allSuggestions = validReports.flatMap(r => r.suggestions || []);

    return (
      <View className='suggestions-section'>
        <Text className='section-title'>💡 改进建议</Text>
        {allSuggestions.length === 0 ? (
          <View className='no-suggestions-box'>
            <Text className='no-suggestions-icon'>🎉</Text>
            <Text className='no-suggestions'>文章已很完善，暂无建议</Text>
          </View>
        ) : (
          allSuggestions.map((sug, idx) => (
            <View key={idx} className='suggestion-item'>
              <Text className='suggestion-number'>{idx + 1}</Text>
              <Text className='suggestion-text'>{sug}</Text>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <ScrollView scrollY className='audit-container'>
      <View className='audit-header-section'>
        <Text className='audit-header'>赛博编辑部审计报告</Text>
        <Text className='audit-subheader'>基于多维度 AI 审计分析</Text>
      </View>

      {renderScore()}

      {renderCriticisms()}

      {renderSuggestions()}

      <View className='audit-actions'>
        <Button
          className='confirm-btn'
          onClick={handleConfirm}
        >
          采纳建议并润色
        </Button>
      </View>

      <View style={{ height: '40px' }} />
    </ScrollView>
  );
};
