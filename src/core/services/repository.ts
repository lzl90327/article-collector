import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mindflowConfig } from '../../config';
import { WorkflowState, Phase, ChatMessage } from '../engine/types';
import { logger } from '../../utils/logger';

export class WorkflowRepository {
  private client: SupabaseClient | null = null;

  constructor() {
    if (mindflowConfig.supabase.url && mindflowConfig.supabase.serviceRoleKey) {
      this.client = createClient(
        mindflowConfig.supabase.url,
        mindflowConfig.supabase.serviceRoleKey
      );
    } else {
      logger.warn('Supabase not configured. Persistence disabled.');
    }
  }

  public async saveState(state: WorkflowState): Promise<void> {
    if (!this.client) return;

    try {
      // 1. Upsert Workflow Metadata
      const { error: wfError } = await this.client
        .from('mindflow_workflows')
        .upsert({
          id: state.workflowId,
          current_phase: state.currentPhase,
          updated_at: new Date().toISOString()
        });

      if (wfError) throw wfError;

      // 2. Upsert Context
      const { error: ctxError } = await this.client
        .from('mindflow_context')
        .upsert({
          workflow_id: state.workflowId,
          data: state.context
        });

      if (ctxError) throw ctxError;

      // 3. Insert New History (Optimization: Only insert new ones? 
      // For now, let's just assume we append. But wait, we don't track which are new.
      // To avoid duplication, maybe we only insert the last message if it's new?
      // Actually, for MVP, let's trust the engine to manage memory and just dump history 
      // is inefficient. Let's rely on the engine to call saveHistory specifically or 
      // just save the whole history array into context if it's small?
      // Better approach: WorkflowEngine keeps history in memory. 
      // We only append the LATEST message to DB.
      // But here we receive the whole state.
      
      // Let's simplified: We won't sync history table in this method call to avoid N^2 writes.
      // We will add a separate method `appendMessage` for chat history.
      
    } catch (error) {
      logger.error('Failed to save workflow state', error);
    }
  }

  public async appendMessage(workflowId: string, message: ChatMessage): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.from('mindflow_history').insert({
        workflow_id: workflowId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp
      });
    } catch (error) {
      logger.error('Failed to append message history', error);
    }
  }

  public async loadState(workflowId: string): Promise<WorkflowState | null> {
    if (!this.client) return null;

    try {
      // 1. Get Workflow
      const { data: wf, error: wfError } = await this.client
        .from('mindflow_workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (wfError || !wf) return null;

      // 2. Get Context
      const { data: ctx, error: ctxError } = await this.client
        .from('mindflow_context')
        .select('data')
        .eq('workflow_id', workflowId)
        .single();

      // 3. Get History
      const { data: history, error: histError } = await this.client
        .from('mindflow_history')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('timestamp', { ascending: true });

      return {
        workflowId: wf.id,
        currentPhase: Number(wf.current_phase),
        context: ctx?.data || {},
        history: history?.map((h: any) => ({
          role: h.role,
          content: h.content,
          timestamp: Number(h.timestamp)
        })) || []
      };

    } catch (error) {
      logger.error(`Failed to load workflow ${workflowId}`, error);
      return null;
    }
  }
}

export const repository = new WorkflowRepository();
