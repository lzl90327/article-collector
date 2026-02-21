import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { PhaseId, PhaseMetadata, PendingInput } from '../../../types/phase';
import './ChatInterface.scss';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// 新 Props 接口（适配 Phase 系统）
interface ChatInterfaceNewProps {
  workflowId: string;
  phaseId: PhaseId;
  phaseMeta?: PhaseMetadata;
  fields: Map<string, unknown>;
  pendingInput?: PendingInput | null;
  loading?: boolean;
  onSubmitInput: (field: string, value: unknown) => void;
  onTriggerPhase: (targetPhase?: string) => void;
  onSendMessage: (message: string) => void;
}

// 兼容旧 Props 接口
interface ChatInterfaceLegacyProps {
  history: Message[];
  selectedAngle?: string;
  onSend: (message: string) => Promise<void>;
  loading?: boolean;
  onDone?: () => void;
}

type ChatInterfaceProps = ChatInterfaceNewProps | ChatInterfaceLegacyProps;

// 判断是否是新 Props
function isNewProps(props: ChatInterfaceProps): props is ChatInterfaceNewProps {
  return 'workflowId' in props;
}

// Parse message content to separate thinking and actual content
const parseMessageContent = (content: string) => {
  const thinkingRegex = /\[THINKING\]([\s\S]*?)(?=\[THINKING\]|$)/g;
  const thinkings: string[] = [];
  let match;

  while ((match = thinkingRegex.exec(content)) !== null) {
    thinkings.push(match[1].trim());
  }

  const actualContent = content.replace(/\[THINKING\][\s\S]*?(?=\[THINKING\]|$)/g, '').trim();

  return { thinkings, actualContent };
};

// Check if content needs folding - 根据内容行数判断是否折叠
const shouldFold = (content: string) => {
  if (!content) return false;
  // 按换行符分割，计算实际行数
  const lines = content.split('\n').length;
  // 如果超过5行或字符超过300，则需要折叠
  return lines > 5 || content.length > 300;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
  const [inputValue, setInputValue] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [scrollTop, setScrollTop] = useState<number>(0);
  const scrollViewRef = useRef<any>(null);
  const prevHistoryLength = useRef<number | null>(null);
  const shouldScrollToBottom = useRef(false);

  // 根据 Props 类型获取数据
  const history = isNewProps(props)
    ? (props.fields.get('discussion_messages') as Message[]) || []
    : props.history;

  const selectedAngle = isNewProps(props)
    ? (props.fields.get('selected_angle') as string)
    : props.selectedAngle;

  const loading = props.loading;

  // Filter out system messages AND the initial brief input - memoized for performance
  const filteredHistory = useMemo(() => {
    return history.filter((msg, index) => {
      if (msg.role === 'system') return false;
      if (index === 0 && msg.role === 'user') return false;
      if (msg.content.includes('请选择一个切入点')) return false;
      if (msg.role === 'user' && (msg.content.startsWith('Selected Angles:') || msg.content.includes('Supplemental Thoughts:'))) return false;
      if (msg.content.includes('"type":"BRIEF_CARD"') || msg.content.includes('{"thesis":')) return false;
      return true;
    });
  }, [history]);

  // Initialize prevHistoryLength on first render with filteredHistory (using null check)
  if (prevHistoryLength.current === null) {
    prevHistoryLength.current = filteredHistory.length;
    console.log('[ChatInterface] Initialized prevHistoryLength:', filteredHistory.length);
  }

  // Check if the last assistant message is empty (streaming placeholder)
  const lastAssistantMsg = filteredHistory.filter(m => m.role === 'assistant').pop();
  const isStreamingPlaceholder = lastAssistantMsg && !lastAssistantMsg.content;

  // Track which messages are new for animation
  const [newMessageIndices, setNewMessageIndices] = useState<Set<number>>(new Set());

  // Auto scroll to bottom when new messages arrive
  // Use history.length (prop) instead of filteredHistory to avoid unnecessary re-renders
  useEffect(() => {
    const currentLength = history.length;
    const prevLength = prevHistoryLength.current ?? 0;

    console.log('[ChatInterface] useEffect:', {
      currentLength,
      prevLength,
      historyChanged: currentLength !== prevLength
    });

    if (currentLength > prevLength && currentLength > 0) {
      console.log('[ChatInterface] New messages detected, will scroll to bottom');

      // Mark new messages for animation (skip for initial load)
      if (prevLength > 0) {
        const newIndices = new Set<number>();
        for (let i = prevLength; i < currentLength; i++) {
          newIndices.add(i);
        }
        setNewMessageIndices(newIndices);

        // Clear animation after delay
        setTimeout(() => {
          setNewMessageIndices(new Set());
        }, 500);
      }

      // Mark that we should scroll to bottom after render
      shouldScrollToBottom.current = true;
    }

    prevHistoryLength.current = currentLength;

    // Check for done signal
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content.includes('[DONE]')) {
      console.log('[ChatInterface] [DONE] detected');
      if (!isNewProps(props) && props.onDone) {
        props.onDone();
      } else if (isNewProps(props)) {
        // 新接口：触发 Phase 转换
        props.onTriggerPhase();
      }
    }
  }, [history, props]);

  // Perform scroll after DOM update
  useEffect(() => {
    if (shouldScrollToBottom.current) {
      shouldScrollToBottom.current = false;

      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        // 滚动到底部
        setScrollTop(prev => prev + 999999);
        console.log('[ChatInterface] Scrolled to bottom');
      }, 100);
    }
  });

  // 发送消息后滚动到底部
  const scrollToBottom = () => {
    setTimeout(() => {
      setScrollTop(prev => prev + 999999);
    }, 100);
  };

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || loading) return;
    const msg = inputValue;
    setInputValue('');
    // 立即滚动到底部
    scrollToBottom();
    try {
      if (isNewProps(props)) {
        // 新接口：调用 onSendMessage
        props.onSendMessage(msg);
      } else {
        // 旧接口：调用 onSend
        await props.onSend(msg);
      }
      // 发送成功后再次滚动到底部
      scrollToBottom();
    } catch (error) {
      console.error('[ChatInterface] Failed to send message:', error);
      Taro.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      });
    }
  }, [inputValue, loading, props]);

  const toggleThinking = (index: number) => {
    setExpandedThinking(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleMessageExpand = (index: number) => {
    const isExpanding = !expandedMessages.has(index);

    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });

    // If expanding, scroll to bottom after animation
    if (isExpanding) {
      setTimeout(() => {
        setScrollTop(999999);
      }, 400);
    }
  };

  console.log('[ChatInterface] Render:', {
    filteredHistoryLength: filteredHistory.length,
    scrollTop,
    newMessageIndices: Array.from(newMessageIndices)
  });

  // 处理 selectedAngle，如果包含多个角度，只显示第一个
  const displayAngle = selectedAngle ? selectedAngle.split(',')[0].trim() : '';

  return (
    <View className='chat-container'>
      {displayAngle && (
        <View className='sticky-header'>
          <Text className='label'>当前探讨切入点：</Text>
          <Text className='content'>{displayAngle}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        scrollY
        scrollWithAnimation
        className='chat-history'
        enhanced
        showScrollbar
        scrollTop={scrollTop}
      >
        {filteredHistory.map((msg, index) => {
          // Skip rendering if it's an empty streaming placeholder
          if (msg.role === 'assistant' && !msg.content && loading && index === filteredHistory.length - 1) {
            return null;
          }

          const { thinkings, actualContent } = msg.role === 'assistant'
            ? parseMessageContent(msg.content)
            : { thinkings: [], actualContent: msg.content };
          const hasThinking = thinkings.length > 0;
          const isThinkingExpanded = expandedThinking.has(index);
          const needsFolding = msg.role === 'assistant' && shouldFold(actualContent);
          const isMessageExpanded = expandedMessages.has(index);
          const isNew = newMessageIndices.has(index);

          return (
            <View
              key={`${msg.role}-${index}`}
              className={`message-row ${msg.role === 'user' ? 'message-right' : 'message-left'} ${isNew ? 'message-new' : ''}`}
            >
              <View className={`message-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                {msg.role === 'assistant' && !msg.content && !loading ? (
                  <Text className='thinking-text'>深度思考中...</Text>
                ) : (
                  <>
                    {/* Thinking Process Foldable Section */}
                    {hasThinking && (
                      <View className='thinking-section'>
                        <View
                          className='thinking-header'
                          onClick={() => toggleThinking(index)}
                        >
                          <Text className='thinking-title'>💭 深度思考过程</Text>
                          <Text className='thinking-toggle'>{isThinkingExpanded ? '▼' : '▶'}</Text>
                        </View>
                        {isThinkingExpanded && (
                          <View className='thinking-content'>
                            {thinkings.map((thinking, tIndex) => (
                              <Text key={tIndex} className='thinking-text-block'>{thinking}</Text>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Actual Content with Collapsible Container */}
                    {actualContent && (
                      <View
                        className={`content-container ${needsFolding && !isMessageExpanded ? 'folded' : 'expanded'}`}
                      >
                        <View className="content-inner">
                          <Text userSelect className='actual-content'>{actualContent}</Text>
                        </View>
                        {needsFolding && !isMessageExpanded && (
                          <View className='gradient-overlay' onClick={() => toggleMessageExpand(index)}>
                            <Text className='expand-hint'>点击展开更多</Text>
                          </View>
                        )}
                        {needsFolding && isMessageExpanded && (
                          <View className='collapse-hint' onClick={() => toggleMessageExpand(index)}>
                            <Text className='collapse-text'>点击收起</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* If only has thinking and no actual content yet, show thinking indicator */}
                    {hasThinking && !actualContent && loading && (
                      <Text className='thinking-indicator'>正在整理回答...</Text>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Show thinking indicator when streaming placeholder exists */}
        {isStreamingPlaceholder && (
          <View className='message-row message-left message-new'>
            <View className='message-bubble bubble-ai loading'>
              <Text className='thinking-text'>深度思考中...</Text>
            </View>
          </View>
        )}

        <View style={{ height: '30px' }}></View>
      </ScrollView>

      <View className='chat-input-area'>
        <textarea
          className='chat-input-textarea'
          value={inputValue}
          onInput={(e) => setInputValue(e.detail.value)}
          placeholder='输入你的想法...'
          maxlength={-1}
          autoHeight
        />
        <Button
          className='send-btn'
          onClick={handleSend}
          disabled={loading || !inputValue.trim()}
        >
          发送
        </Button>
      </View>
    </View>
  );
};
