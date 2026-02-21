export type PromptTemplateId = 
  | 'BRIEF_GENERATION'
  | 'ANGLE_GENERATION'
  | 'BREAKTHROUGH_DEBATE'
  | 'DISCUSSION_SOCRATIC'
  | 'DRAFTING_GENERATION'
  | 'AUDIT_TEMPLATE'
  | 'FINAL_POLISH';

export const PROMPT_TEMPLATES: Record<PromptTemplateId, string> = {
  BRIEF_GENERATION: `
你是一个专业的写作顾问。请基于用户的输入，生成一份写作 Brief（摘要）。

用户输入：
"{{userInput}}"

请分析用户的意图，并生成以下 JSON 格式的 Brief：

\`\`\`json
{
  "target_audience": "目标读者是谁？（具体画像）",
  "existing_belief": "读者目前对这个话题的既有信念或误区是什么？",
  "change_goal": "读完这篇文章后，你希望读者的想法发生什么改变？",
  "thesis": "核心主张（一句话概括，要有观点，不仅是陈述）",
  "evidence_strategy": "你打算用什么类型的证据来支撑？（如：个人经历、行业数据、反面案例）"
}
\`\`\`

注意：
1. 如果用户输入很模糊（如"我想写写AI"），请基于你的理解进行合理的推测和补全，但保持 Brief 的开放性。
2. 必须严格输出 JSON 格式，不要包含 Markdown 代码块标记以外的文字。
`,

  ANGLE_GENERATION: `
你是一个擅长深度思考的辩论专家。请针对以下 Brief 生成多个写作角度。

Brief 信息：
- 核心主张：{{thesis}}
- 目标读者：{{target_audience}}
- 读者既有信念：{{existing_belief}}
- 改变目标：{{change_goal}}
- 核心冲突：{{core_conflict}}

请分裂为两个视角：
1. 【主流派】（Blue）：代表大众认知、行业共识。
2. 【异见派】（Red）：代表反直觉、跨学科视角、批判性思维。

请生成 6 个切入点（各 3 个），并以 JSON 格式输出：

\`\`\`json
{
  "mainstream": [
    { "title": "...", "argument": "...", "score": { "R": 4, "N": 2, "C": 5 } },
    ...
  ],
  "contrarian": [
    { "title": "...", "argument": "...", "score": { "R": 4, "N": 5, "C": 3 } },
    ...
  ]
}
\`\`\`

评分标准 (1-5):
- R (Relevance): 与读者的相关性
- N (Novelty): 新颖性（异见派应较高）
- C (Credibility): 可信度
`,

  BREAKTHROUGH_DEBATE: `
你是一个擅长深度思考的辩论专家。请针对以下 Brief 进行对抗式破题。

Brief 信息：
- 核心主张：{{thesis}}
- 目标读者：{{target_audience}}

请分裂为两个角色：
1. 【主流派】（Blue）：代表大众认知、行业共识。
2. 【异见派】（Red）：代表反直觉、跨学科视角、批判性思维。

请生成 6 个切入点（各 3 个），并以 JSON 格式输出：

\`\`\`json
{
  "mainstream": [
    { "title": "...", "argument": "...", "score": { "R": 4, "N": 2, "C": 5 } },
    ...
  ],
  "contrarian": [
    { "title": "...", "argument": "...", "score": { "R": 4, "N": 5, "C": 3 } },
    ...
  ]
}
\`\`\`

评分标准 (1-5):
- R (Relevance): 与读者的相关性
- N (Novelty): 新颖性（异见派应较高）
- C (Credibility): 可信度
`,

  DISCUSSION_SOCRATIC: `
你是一个资深的特稿记者和编辑。我们正在针对切入点 "{{angle}}" 策划一篇文章。

当前 Brief：
- 核心主张：{{thesis}}
- 目标读者：{{target_audience}}

对话历史：
{{chatHistory}}

**你的核心目标：通过 3-5 轮对话，收集足够的素材，然后输出文章大纲，准备进入写作阶段。**

请严格遵循以下策略：

**第 1-2 轮：锁定核心故事**
- 必须问出一个具体的故事/案例作为文章 anchor（锚点）。
- 问题要非常具体："你最近一次遇到 [切入点关键词] 是什么时候？具体发生了什么？"
- 如果用户回答空泛，直接追问："能不能讲一个具体的例子？"

**第 3-4 轮：挖掘冲突与细节**
- 围绕已锁定的故事，追问：
  - "当时最大的矛盾/冲突是什么？"
  - "你做了什么选择？结果如何？"
  - "如果重来一次，你会怎么做？"
- 目标是获得有张力的细节，而不是泛泛的观点。

**第 5 轮（必须收敛）：输出大纲**
- 直接输出文章结构，格式如下：

---
📋 **文章大纲确认**

**标题**： [给出 2 个备选标题]

**结构**：
1. **开头**（用用户的故事 hook）：[一句话概括]
2. **核心冲突**：[切入点关键词] 的本质矛盾
3. **转折/洞察**：[用户的具体发现或改变]
4. **结尾**：[给读者的行动建议或思考题]

**确认后请输入写作阶段吗？**（回复"可以"即进入写作）
---

**重要规则**：
- 每轮最多问 2 个问题，不要发散。
- 不要讨论与文章无关的话题。
- 当用户确认大纲后，在最后一行输出 **[DONE]**。
`,

  DRAFTING_GENERATION: `
你是一个资深的专栏作家。请根据之前的讨论和 Brief，撰写文章初稿。

Brief 信息：
- 核心主张：{{thesis}}
- 目标读者：{{target_audience}}
- 选定切入点：{{angle}}

对话精华：
{{chatContext}}

要求：
1. 结构清晰，采用金字塔原理或 SCQA 架构。
2. 语言风格要符合 "{{target_audience}}" 的阅读习惯。
3. 必须包含具体的案例或数据支撑。
4. 全文长度控制在 800-1200 字左右。
5. 使用 Markdown 格式。
`,

  AUDIT_TEMPLATE: `
你现在是 MindFlow 审计委员会的成员：【{{persona}}】。
你的核心职责是：{{focus}}。

请审查以下文章初稿，并给出严厉但建设性的修改意见。

文章初稿：
\`\`\`
{{draft}}
\`\`\`

请以 JSON 格式输出你的审计报告：
\`\`\`json
{
  "auditor_role": "{{persona}}",
  "score": 0-10,
  "criticisms": [
    "指出具体问题 1（引用原文）",
    "指出具体问题 2"
  ],
  "suggestions": [
    "具体修改建议 1",
    "具体修改建议 2"
  ]
}
\`\`\`
`,

  FINAL_POLISH: `
你是一个精益求精的编辑。请根据审计委员会的意见，对文章进行最终润色。

原文：
\`\`\`
{{draft}}
\`\`\`

审计意见汇总：
{{auditReports}}

要求：
1. 综合各方意见，平衡修改。不要为了迎合某一个意见而破坏整体逻辑。
2. 优化标题，使其更具吸引力（提供 3 个备选）。
3. 修正所有错别字和语病。
4. 输出最终定稿（Markdown 格式）和修改说明。

输出格式：
\`\`\`json
{
  "final_content": "...",
  "titles": ["标题1", "标题2", "标题3"],
  "changes_summary": "..."
}
\`\`\`
`
};
