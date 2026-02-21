/**
 * Workflow Page - New Phase System
 * 适配 Skill 规范的新工作流页面
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { getWorkflowState, triggerPhase, sendChatMessage, submitInput } from '../../api';
import { PhaseId, PhaseMetadata, WorkflowState, getPhaseMetadata, getPhasesForMode } from '../../types/phase';

// 导入组件
import {
  BriefCard,
  AngleSelector,
  ChatInterface,
  DraftViewer,
  AuditReport,
  MaterialSelector,
  PreAngleSelector,
  AutoSync,
  AngleConfirmation,
  ObservationCollector,
  ObservationJournal,
  ConvergenceView,
  LightReview,
  ImageGenerator,
  PublishView,
  ViewpointExtractor,
  RetroView,
} from './components';
import { 
  BriefCardSkeleton, 
  AngleSelectorSkeleton, 
  DraftViewerSkeleton 
} from '../../components/Skeleton';

import './index.scss';

// Phase 到组件的映射
const PHASE_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  'BriefCard': BriefCard,
  'MaterialSelector': MaterialSelector,
  'PreAngleSelector': PreAngleSelector,
  'AutoSync': AutoSync,
  'AngleConfirmation': AngleConfirmation,
  'AngleSelector': AngleSelector,
  'ChatInterface': ChatInterface,
  'ObservationCollector': ObservationCollector,
  'ObservationJournal': ObservationJournal,
  'ConvergenceView': ConvergenceView,
  'DraftViewer': DraftViewer,
  'LightReview': LightReview,
  'AuditReport': AuditReport,
  'ImageGenerator': ImageGenerator,
  'PublishView': PublishView,
  'ViewpointExtractor': ViewpointExtractor,
  'RetroView': RetroView,
};

// Skeleton 组件映射
const SKELETON_MAP: Record<string, React.ComponentType> = {
  'BriefCard': BriefCardSkeleton,
  'AngleSelector': AngleSelectorSkeleton,
  'DraftViewer': DraftViewerSkeleton,
};

export default function WorkflowPage() {
  const router = useRouter();
  const { id } = router.params;
  
  const [state, setState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取当前 Phase 元数据
  const currentPhaseMeta = useMemo<PhaseMetadata | undefined>(() => {
    if (!state) {
      console.log('[Workflow] No state available');
      return undefined;
    }
    console.log('[Workflow] Looking up phase metadata for:', state.currentPhaseId, 'type:', typeof state.currentPhaseId);
    const meta = getPhaseMetadata(state.currentPhaseId);
    console.log('[Workflow] Found metadata:', meta);
    return meta;
  }, [state?.currentPhaseId]);

  // 获取当前模式的所有 Phase
  const modePhases = useMemo<PhaseId[]>(() => {
    if (!state) return [];
    return getPhasesForMode(state.mode);
  }, [state?.mode]);

  // 计算进度
  const progress = useMemo(() => {
    if (!state || modePhases.length === 0) return 0;
    const currentIndex = modePhases.indexOf(state.currentPhaseId);
    return Math.round((currentIndex / modePhases.length) * 100);
  }, [state?.currentPhaseId, modePhases]);

  // 加载工作流状态
  const loadState = useCallback(async () => {
    if (!id) {
      setError('缺少工作流ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await getWorkflowState(id);
      console.log('[Workflow] Loaded state:', res);
      
      // 转换后端状态为前端格式
      // 注意：后端使用 currentPhase（数值），前端使用 currentPhaseId（字符串）
      const phaseId = res.currentPhaseId !== undefined 
        ? String(res.currentPhaseId) 
        : res.currentPhase !== undefined 
          ? String(res.currentPhase) 
          : '-1';
      
      const workflowState: WorkflowState = {
        id: res.id || res.workflowId || id,
        currentPhaseId: phaseId as PhaseId,
        mode: res.mode || 'argument_mode',
        fields: new Map(Object.entries(res.fields || {})),
        artifacts: new Map(Object.entries(res.artifacts || {})),
        completedActions: new Set(res.completedActions || []),
        pendingInput: res.pendingInput,
        metadata: res.metadata || { version: 1 },
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
      };
      
      setState(workflowState);
      setError(null);
    } catch (err) {
      console.error('Failed to load workflow', err);
      setError('加载工作流失败');
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 初始加载
  useEffect(() => {
    loadState();
  }, [loadState]);

  // 提交输入
  const handleSubmitInput = useCallback(async (field: string, value: unknown) => {
    if (!id || !state) return;
    
    setActionLoading(true);
    try {
      await submitInput(id, field, value);
      await loadState();
    } catch (err) {
      console.error('Failed to submit input', err);
      Taro.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  }, [id, state, loadState]);

  // 触发 Phase 转换
  const handleTriggerPhase = useCallback(async (targetPhase?: string) => {
    if (!id) return;
    
    setActionLoading(true);
    try {
      const res = await triggerPhase(id, targetPhase ? { targetPhase } : undefined);
      console.log('[Workflow] Phase triggered:', res.state.currentPhaseId);
      
      // 更新状态
      setState(prev => {
        if (!prev) return null;
        
        // 注意：后端可能使用 currentPhase 或 currentPhaseId
        const newPhaseId = res.state.currentPhaseId !== undefined 
          ? String(res.state.currentPhaseId) 
          : res.state.currentPhase !== undefined 
            ? String(res.state.currentPhase) 
            : prev.currentPhaseId;
        
        return {
          ...prev,
          currentPhaseId: newPhaseId as PhaseId,
          fields: new Map(Object.entries(res.state.fields || {})),
          artifacts: new Map(Object.entries(res.state.artifacts || {})),
          completedActions: new Set(res.state.completedActions || []),
          pendingInput: res.state.pendingInput,
          updatedAt: res.state.updatedAt,
        };
      });
    } catch (err) {
      console.error('Failed to trigger phase', err);
      Taro.showToast({ title: '阶段转换失败', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  }, [id]);

  // 发送聊天消息
  const handleSendMessage = useCallback(async (message: string) => {
    if (!id || !message.trim()) return;
    
    setActionLoading(true);
    try {
      await sendChatMessage(id, message);
      await loadState();
    } catch (err) {
      console.error('Failed to send message', err);
      Taro.showToast({ title: '发送失败', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  }, [id, loadState]);

  // 渲染当前 Phase 组件
  const renderPhaseComponent = () => {
    if (!state || !currentPhaseMeta) {
      return (
        <View className='unknown-phase'>
          <Text>未知阶段</Text>
        </View>
      );
    }

    const componentName = currentPhaseMeta.component;
    if (!componentName) {
      return (
        <View className='unknown-phase'>
          <Text>未配置的组件: {state.currentPhaseId}</Text>
        </View>
      );
    }

    const Component = PHASE_COMPONENT_MAP[componentName];
    if (!Component) {
      // 如果组件未实现，显示占位符
      return (
        <View className='placeholder-phase'>
          <Text className='phase-title'>{currentPhaseMeta.name}</Text>
          <Text className='phase-desc'>{currentPhaseMeta.description}</Text>
          <Text className='phase-hint'>组件开发中...</Text>
          
          {/* 显示 pendingInput 提示 */}
          {state.pendingInput && (
            <View className='pending-input-section'>
              <Text className='pending-prompt'>{state.pendingInput.prompt}</Text>
              {/* 这里可以根据 pendingInput.type 渲染不同的输入组件 */}
            </View>
          )}
          
          <View className='action-buttons'>
            <button 
              className='btn-primary'
              onClick={() => handleTriggerPhase()}
              disabled={actionLoading}
            >
              {actionLoading ? '处理中...' : '继续'}
            </button>
            {currentPhaseMeta.skippable && (
              <button 
                className='btn-secondary'
                onClick={() => handleSubmitInput('skip', true)}
                disabled={actionLoading}
              >
                跳过
              </button>
            )}
          </View>
        </View>
      );
    }

    // 根据组件类型传递不同的 props
    const commonProps = {
      workflowId: state.id,
      phaseId: state.currentPhaseId,
      phaseMeta: currentPhaseMeta,
      fields: state.fields,
      pendingInput: state.pendingInput,
      loading: actionLoading,
      onSubmitInput: handleSubmitInput,
      onTriggerPhase: handleTriggerPhase,
      onSendMessage: handleSendMessage,
    };

    // 根据组件类型添加特定 props
    switch (componentName) {
      case 'BriefCard':
        return <Component {...commonProps} brief={state.fields.get('briefData')} />;
      case 'AngleSelector':
        return <Component {...commonProps} angles={state.fields.get('angle_pool')} />;
      case 'ChatInterface':
        return <Component {...commonProps} history={state.fields.get('discussion_messages') || []} />;
      case 'DraftViewer':
        return <Component {...commonProps} draft={state.fields.get('current_draft')} />;
      case 'AuditReport':
        return <Component {...commonProps} report={state.fields.get('audit_checks')} />;
      default:
        return <Component {...commonProps} />;
    }
  };

  // 渲染骨架屏
  const renderSkeleton = () => {
    if (!currentPhaseMeta?.component) {
      return <BriefCardSkeleton />;
    }
    const Skeleton = SKELETON_MAP[currentPhaseMeta.component];
    return Skeleton ? <Skeleton /> : <BriefCardSkeleton />;
  };

  // 渲染进度条
  const renderProgress = () => {
    if (!state || modePhases.length <= 1) return null;
    
    return (
      <View className='progress-bar'>
        <View className='progress-track'>
          <View 
            className='progress-fill' 
            style={{ width: `${progress}%` }}
          />
        </View>
        <Text className='progress-text'>{progress}%</Text>
      </View>
    );
  };

  // 渲染 Phase 导航
  const renderPhaseNav = () => {
    if (!state || modePhases.length <= 1) return null;
    
    const currentIndex = modePhases.indexOf(state.currentPhaseId);
    
    return (
      <View className='phase-nav'>
        {modePhases.map((phaseId, index) => {
          const meta = getPhaseMetadata(phaseId);
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          
          return (
            <View 
              key={phaseId}
              className={`phase-nav-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <View className='phase-dot' />
              <Text className='phase-name'>{meta?.name || phaseId}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View className='workflow-page'>
        <View className='loading-container'>
          {renderSkeleton()}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className='workflow-page'>
        <View className='error-container'>
          <Text className='error-title'>出错了</Text>
          <Text className='error-message'>{error}</Text>
          <button className='btn-retry' onClick={loadState}>重试</button>
        </View>
      </View>
    );
  }

  if (!state) {
    return (
      <View className='workflow-page'>
        <View className='error-container'>
          <Text>无法获取工作流状态</Text>
          <Text>ID: {id}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className='workflow-page'>
      {/* 进度条 */}
      {renderProgress()}
      
      {/* Phase 导航 */}
      {renderPhaseNav()}
      
      {/* 当前 Phase 信息 */}
      <View className='phase-header'>
        <Text className='phase-title'>
          {currentPhaseMeta?.name || state.currentPhaseId}
        </Text>
        <Text className='phase-desc'>
          {currentPhaseMeta?.description}
        </Text>
      </View>

      {/* 主内容区 */}
      <View className='content-container'>
        {actionLoading ? renderSkeleton() : renderPhaseComponent()}
      </View>

      {/* 调试信息（开发模式） */}
      {process.env.NODE_ENV === 'development' && (
        <View className='debug-info'>
          <Text className='debug-text'>Phase: {state.currentPhaseId}</Text>
          <Text className='debug-text'>Mode: {state.mode}</Text>
          <Text className='debug-text'>Progress: {progress}%</Text>
        </View>
      )}
    </View>
  );
}
