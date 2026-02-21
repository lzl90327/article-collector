import { PROMPT_TEMPLATES, PromptTemplateId } from './templates';

export class PromptManager {
  static getPrompt(id: PromptTemplateId, variables: Record<string, string> = {}): string {
    const template = PROMPT_TEMPLATES[id];
    if (!template) {
      throw new Error(`Prompt template not found: ${id}`);
    }

    let prompt = template;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return prompt;
  }
}
