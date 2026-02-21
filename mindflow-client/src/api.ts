import { request, streamRequest } from './utils/request';

export const startWorkflow = (input?: string) => {
  return request('/start', 'POST', { input });
};

export const getWorkflowState = (workflowId: string) => {
  return request(`/${workflowId}`, 'GET');
};

export const sendChatMessage = (workflowId: string, input: string) => {
  return request(`/${workflowId}/chat`, 'POST', { input });
};

export const sendChatMessageStream = (
  workflowId: string, 
  input: string, 
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (err: any) => void
) => {
  return streamRequest(
    `/${workflowId}/chat/stream`, 
    { input },
    { onChunk, onComplete, onError }
  );
};

export const triggerPhase = (workflowId: string, data?: any) => {
  return request(`/${workflowId}/trigger`, 'POST', { data });
};

