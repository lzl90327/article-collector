import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './ChatInterface.scss';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface ChatInterfaceProps {
  history: Message[];
  selectedAngle?: string;
  onSend: (message: string) => Promise<void>;
  loading?: boolean;
  onDone?: () => void;
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

// Check if content needs folding
const shouldFold = (content: string) => content.length > 200;

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  history,
  selectedAngle,
  onSend,
  loading = false,
  onDone
}) => {
  const [inputValue, setInputValue] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [scrollTop, setScrollTop] = useState<number>(0);
  const scrollViewRef = useRef<any>(null);
  const prevHistoryLength = useRef<number | null>(null);
  const shouldScrollToBottom = useRef(false);

  // Filter out system messages AND the initial brief input
  const filteredHistory = history.filter((msg, index) => {
    if (msg.role === 'system') return false;
    if (index === 0 && msg.role === 'user') return false;
    if (msg.content.includes('请选择一个切入点') || msg.content.includes('调试模式')) return false;
    if (msg.role === 'user' && (msg.content.startsWith('Selected Angles:') || msg.content.includes('Supplemental Thoughts:'))) return false;
    if (msg.content.includes('"type":"BRIEF_CARD"') || msg.content.includes('{"thesis":')) return false;
    return true;
  });

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
  // Track if this is the first render
  const isFirstRender = useRef(true);

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
      onDone?.();
    }
  }, [history, onDone]);

  // Perform scroll after DOM update
  useEffect(() => {
    if (shouldScrollToBottom.current) {
      shouldScrollToBottom.current = false;
      
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        const scrollView = scrollViewRef.current;
        if (scrollView) {
          // For Taro ScrollView, we need to use the scrollTop property
          setScrollTop(999999);
          console.log('[ChatInterface] Scrolled to bottom');
        }
      }, 100);
    }
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;
    const msg = inputValue;
    setInputValue('');
    await onSend(msg);
  };

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

  return (
    <View className='chat-container'>
      {selectedAngle && (
        <View className='sticky-header'>
          <Text className='label'>当前探讨切入点：</Text>
          <Text className='content'>{selectedAngle}</Text>
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
          onChange={(e) => setInputValue(e.target.value)}
          placeholder='输入你的想法...'
          rows={1}
          onInput={(e) => {
            // Auto-resize textarea
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
          onFocus={(e) => {
            // Prevent default scroll behavior on focus
            e.preventDefault();
            // Don't scroll the page
            if (typeof window !== 'undefined') {
              const scrollY = window.scrollY;
              setTimeout(() => {
                window.scrollTo(0, scrollY);
              }, 0);
            }
          }}
        />
        <button
          className='send-btn'
          onClick={handleSend}
          disabled={loading || !inputValue.trim()}
        >
          发送
        </button>
      </View>
    </View>
  );
};
