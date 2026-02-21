/**
 * Mock API for testing frontend without backend
 */

const MOCK_DELAY = 1000;

const mockBrief = {
  target_audience: "对AI技术发展感到担忧或不确定的普通职场人士、学生和普通公众，年龄在25-45岁之间，具备一定教育背景但对AI技术细节了解有限，担心AI会取代自己的工作、影响职业发展或对社会产生负面影响的人群。",
  existing_belief: "读者普遍认为AI发展会大规模取代人类工作，导致失业潮；认为AI技术发展速度过快，人类难以适应；担心AI会超越人类智能，带来不可控的风险；将AI视为威胁而非工具，产生不必要的恐慌和抗拒心理。",
  change_goal: "希望读者从被动焦虑转变为主动理解，认识到AI是增强人类能力的工具而非替代品，学会如何与AI协作提升自身竞争力，并采取积极行动适应技术变革。",
  thesis: "AI焦虑源于对技术变革的误解和恐惧，实际上AI是人类能力的延伸而非替代，通过积极学习和适应，我们不仅能化解焦虑，还能利用AI创造前所未有的个人和社会价值。",
  evidence_strategy: "行业数据（如就业市场变化、AI创造的新岗位统计）、专家观点（技术专家和经济学家的分析）、个人成功案例（与AI协作提升效率的实例）、历史类比（类似技术革命时期的适应过程）以及反面案例（因抗拒变革而落后的例子）。"
};

const mockAngles = {
  mainstream: [
    {
      title: "AI焦虑的本质：技术恐惧的社会建构",
      argument: "AI焦虑并非源于技术本身的威胁，而是社会媒体和舆论对AI的过度渲染造成的集体恐慌。",
      score: { R: 8, N: 7, C: 6 }
    },
    {
      title: "职业转型的必然性：AI时代的生存策略",
      argument: "AI不会完全取代人类，但会改变工作方式，关键在于主动学习新技能，与AI协作而非对抗。",
      score: { R: 9, N: 8, C: 7 }
    }
  ],
  contrarian: [
    {
      title: "AI焦虑的合理性：对未知的警惕",
      argument: "对AI的焦虑并非毫无根据，历史上技术革命确实造成了大规模失业和社会动荡，保持警惕是理性的。",
      score: { R: 7, N: 6, C: 8 }
    }
  ]
};

export const startWorkflow = (input?: string): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const workflowId = 'mock-' + Date.now();
      resolve({
        workflowId,
        state: {
          workflowId,
          currentPhase: -1,
          context: {
            brief: mockBrief
          },
          history: [
            { role: 'user', content: input || '测试输入', timestamp: Date.now() },
            { 
              role: 'assistant', 
              content: JSON.stringify({ type: 'BRIEF_CARD', data: mockBrief, message: '这是为您生成的 Brief，请确认。' }),
              timestamp: Date.now() + 1
            }
          ]
        },
        response: JSON.stringify({ type: 'BRIEF_CARD', data: mockBrief, message: '这是为您生成的 Brief，请确认。' })
      });
    }, MOCK_DELAY);
  });
};

export const getWorkflowState = (workflowId: string): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        workflowId,
        currentPhase: -1,
        context: {
          brief: mockBrief
        },
        history: [
          { role: 'user', content: '测试输入', timestamp: Date.now() },
          { 
            role: 'assistant', 
            content: JSON.stringify({ type: 'BRIEF_CARD', data: mockBrief, message: '这是为您生成的 Brief，请确认。' }),
            timestamp: Date.now() + 1
          }
        ]
      });
    }, MOCK_DELAY);
  });
};

export const sendChatMessage = (workflowId: string, input: string): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        response: "这是一个模拟的AI回复。在实际环境中，这里会返回DeepSeek API的响应。",
        state: {
          workflowId,
          currentPhase: 2,
          history: [
            { role: 'user', content: input, timestamp: Date.now() }
          ]
        }
      });
    }, MOCK_DELAY);
  });
};

export const sendChatMessageStream = (
  workflowId: string, 
  input: string, 
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (err: any) => void
) => {
  const response = "这是一个模拟的流式响应。在实际环境中，这里会返回DeepSeek API的流式响应。";
  let index = 0;
  
  const interval = setInterval(() => {
    if (index < response.length) {
      onChunk(response[index]);
      index++;
    } else {
      clearInterval(interval);
      onComplete();
    }
  }, 50);
  
  return { abort: () => clearInterval(interval) };
};

export const triggerPhase = (workflowId: string, data?: any): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        response: JSON.stringify({ type: 'ANGLE_SELECTION', data: mockAngles, message: '请选择一个切入点：' }),
        state: {
          workflowId,
          currentPhase: 1,
          context: {
            brief: mockBrief,
            angles: mockAngles
          }
        }
      });
    }, MOCK_DELAY);
  });
};
