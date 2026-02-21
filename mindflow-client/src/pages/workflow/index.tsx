import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
// import { getWorkflowState, triggerPhase, sendChatMessage, sendChatMessageStream } from '../../api';
import { BriefCard } from './components/BriefCard';
import { AngleSelector } from './components/AngleSelector';
import { ChatInterface } from './components/ChatInterface';
import { DraftViewer } from './components/DraftViewer';
import { AuditReport } from './components/AuditReport';
import './index.scss';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 20, background: '#fee', borderRadius: 8, margin: 10 }}>
          <Text style={{ color: '#c00', fontWeight: 'bold' }}>页面渲染错误</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
            {this.state.error?.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function WorkflowPage() {
  const router = useRouter();
  const id = router.params.id;
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchState = async () => {
      if (!id) return;
      try {
        const data = await getWorkflowState(id);
        setState(data);
      } catch (error) {
        console.error('Failed to load workflow', error);
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, [id]);

  // Phase -1 -> 1.5
  const handleBriefConfirm = async (updatedBrief: any) => {
    if (!id) return;
    setActionLoading(true);
    try {
      // Send updated brief as data payload
      const res = await triggerPhase(id, { brief: updatedBrief });
      setState(res.state);
    } catch (error) {
      console.error('Failed to trigger next phase', error);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 1.5 -> 2 (Use streaming for better UX)
  const handleAngleSelect = async (result: { selectedAngles: string[], thoughts: string }) => {
    if (!id) return;
    setActionLoading(true);
    
    // Format the input for the backend
    const input = `Selected Angles: ${result.selectedAngles.join(', ')}\nSupplemental Thoughts: ${result.thoughts}`;
    
    // Optimistic Update - immediately show user message and placeholder
    const userMsg = { role: 'user', content: input, timestamp: Date.now() };
    const placeholderAiMsg = { role: 'assistant', content: '', timestamp: Date.now() + 1 };
    setState((prev: any) => ({
      ...prev,
      currentPhase: 2, // Force phase to 2 for UI switch
      history: [...(prev.history || []), userMsg, placeholderAiMsg]
    }));
    
    // Use streaming API
    sendChatMessageStream(
      id,
      input,
      (chunk) => {
        setState((prev: any) => {
          const newHistory = [...(prev.history || [])];
          const lastMsgIndex = newHistory.length - 1;
          if (lastMsgIndex >= 0 && newHistory[lastMsgIndex].role === 'assistant') {
            newHistory[lastMsgIndex] = {
              ...newHistory[lastMsgIndex],
              content: newHistory[lastMsgIndex].content + chunk
            };
          }
          return { ...prev, history: newHistory };
        });
      },
      () => {
        setActionLoading(false);
        // Sync with backend
        getWorkflowState(id).then(newState => {
          setState(newState);
        });
      },
      (err) => {
        console.error('Stream failed', err);
        setActionLoading(false);
        Taro.showToast({ title: '选择失败', icon: 'none' });
      }
    );
  };

  const handleAngleRefresh = () => {
    Taro.showToast({ title: '刷新功能暂未对接', icon: 'none' });
  };

  // Phase 2 Chat
  const handleSendMessage = async (msg: string) => {
    if (!id) return;

    console.log('[Workflow] handleSendMessage called:', { msg, currentPhase: state.currentPhase });

    // Determine if we should use streaming (Phase 2 AND in WeChat Mini Program)
    const isPhase2 = Number(state.currentPhase) === 2;
    const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP;
    const isStreaming = isPhase2 && isWeapp;
    console.log('[Workflow] isStreaming:', isStreaming, { isPhase2, isWeapp, env: Taro.getEnv() });

    // Optimistic Update - ALWAYS add user message immediately for better UX
    const userMsg = { role: 'user', content: msg, timestamp: Date.now() };
    
    if (isStreaming) {
      // Add user message AND placeholder assistant message immediately
      const placeholderAiMsg = { role: 'assistant', content: '', timestamp: Date.now() + 1 };
      console.log('[Workflow] Optimistic update with streaming:', { userMsg, placeholderAiMsg });
      setState((prev: any) => ({
        ...prev,
        history: [...(prev.history || []), userMsg, placeholderAiMsg]
      }));
    } else {
      // For non-streaming, still add user message optimistically
      console.log('[Workflow] Optimistic update (user only):', { userMsg });
      setState((prev: any) => ({
        ...prev,
        history: [...(prev.history || []), userMsg]
      }));
    }

    setActionLoading(true);

    if (isStreaming) {
      sendChatMessageStream(
        id, 
        msg, 
        (chunk) => {
          setState((prev: any) => {
            const newHistory = [...(prev.history || [])];
            const lastMsgIndex = newHistory.length - 1;
            // Ensure we are updating the assistant message
            if (lastMsgIndex >= 0 && newHistory[lastMsgIndex].role === 'assistant') {
              newHistory[lastMsgIndex] = {
                ...newHistory[lastMsgIndex],
                content: newHistory[lastMsgIndex].content + chunk
              };
            }
            return { ...prev, history: newHistory };
          });
        },
        () => {
          setActionLoading(false);
          // Sync with backend state after stream completes
          // This ensures phase transitions etc. are captured
          getWorkflowState(id).then(newState => {
             // Only update if phase changed or something major happened
             // We don't want to overwrite the chat history if it causes flicker
             if (newState.currentPhase !== state.currentPhase) {
                 setState(newState);
             } else {
                 // Update history but keep local if needed? 
                 // Backend history should be identical now.
                 setState(newState);
             }
          });
        },
        (err) => {
          console.error('Stream failed', err);
          setActionLoading(false);
          Taro.showToast({ title: '发送失败', icon: 'none' });
        }
      );
    } else {
      try {
        const res = await sendChatMessage(id, msg);
        setState(res.state);
      } catch (error) {
        console.error('Failed to send message', error);
        Taro.showToast({ title: '发送失败', icon: 'none' });
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleChatDone = async () => {
    if (!id) return;
    // Auto trigger next phase when chat is done
    setActionLoading(true);
    try {
      const res = await triggerPhase(id);
      setState(res.state);
    } catch (error) {
      console.error('Failed to trigger drafting', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 3 Draft Review
  const handleDraftConfirm = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await triggerPhase(id); // Go to Phase 4 (Audit)
      setState(res.state);
    } catch (error) {
      console.error('Failed to confirm draft', error);
      Taro.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDraftBack = () => {
    // Go back to discussion phase
    setState((prev: any) => ({
      ...prev,
      currentPhase: 2,
      context: {
        ...prev.context,
        draft: undefined
      }
    }));
  };

  // Phase 4.5 Audit
  const handleAuditConfirm = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await triggerPhase(id); // Go to Phase 5
      setState(res.state);
    } catch (error) {
      console.error('Failed to confirm audit', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <View className='loading-container'>正在加载工作流...</View>;
  
  if (!state) return (
    <View className='error-container'>
      <View>无法获取工作流状态</View>
      <View>ID: {id}</View>
    </View>
  );

  console.log('Rendering Workflow Page, State:', state);

  return (
    <View className='workflow-container'>
      {Number(state.currentPhase) === -1 && (
        state.context?.brief ? (
          <BriefCard 
            data={state.context.brief} 
            onConfirm={handleBriefConfirm} 
            loading={actionLoading} 
          />
        ) : <View>Brief data is missing</View>
      )}

      {Number(state.currentPhase) === 1.5 && (
        state.context?.angles ? (
          <AngleSelector 
            data={state.context.angles} 
            onConfirm={handleAngleSelect}
            onRefresh={handleAngleRefresh}
            loading={actionLoading} 
          />
        ) : <View>Angles data is missing</View>
      )}

      {Number(state.currentPhase) === 2 && (
        <ChatInterface
          history={state.history || []}
          selectedAngle={state.context.selectedAngle}
          onSend={handleSendMessage}
          loading={actionLoading}
          onDone={handleChatDone}
        />
      )}

      {(Number(state.currentPhase) === 3 || Number(state.currentPhase) === 4) && (
        <ErrorBoundary>
          {state.context?.draft ? (
            <DraftViewer
              draft={state.context.draft}
              onConfirm={handleDraftConfirm}
              onBack={handleDraftBack}
              loading={actionLoading}
            />
          ) : (
            <View className='loading-container'>
              <Text>正在生成文章初稿...</Text>
            </View>
          )}
        </ErrorBoundary>
      )}

      {state.currentPhase === 4.5 && (
        <AuditReport
          report={state.context.auditReports || state.context.auditReport}
          onConfirm={handleAuditConfirm}
          loading={actionLoading}
        />
      )}

      {/* Fallback for other phases */}
      {state.currentPhase !== -1 && state.currentPhase !== 1.5 && state.currentPhase !== 2 && state.currentPhase !== 3 && state.currentPhase !== 4 && state.currentPhase !== 4.5 && (
        <View>
          <View>Current Phase: {state.currentPhase}</View>
          <View>Work in progress...</View>
        </View>
      )}
    </View>
  );
}
