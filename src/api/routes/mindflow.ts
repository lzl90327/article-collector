import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowEngine } from '../../core/engine/workflow';
import { logger } from '../../utils/logger';

const router = Router();
const workflows = new Map<string, WorkflowEngine>();

// 1. Start New Workflow
router.post('/start', async (req: Request, res: Response) => {
    try {
        const workflowId = uuidv4();
        const engine = new WorkflowEngine(workflowId);
        workflows.set(workflowId, engine);
        
        logger.info(`Started new workflow: ${workflowId}`);

        // Optionally process initial input (e.g., user's first idea)
        const initialInput = req.body.input;
        let initialResponse = null;
        if (initialInput) {
            initialResponse = await engine.processInput(initialInput);
        }

        res.json({ 
            workflowId, 
            state: engine.getState(),
            response: initialResponse 
        });
    } catch (error) {
        logger.error('Failed to start workflow', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Chat / Process Input
router.post('/:workflowId/chat', async (req: Request, res: Response) => {
    const workflowId = req.params.workflowId as string;
    const { input } = req.body;

    let engine = workflows.get(workflowId);
    if (!engine) {
        engine = new WorkflowEngine(workflowId);
        workflows.set(workflowId, engine);
        // init will be called inside processInput
    }

    try {
        const response = await engine.processInput(input || '');
        res.json({ 
            response, 
            state: engine.getState() 
        });
    } catch (error) {
        logger.error(`Error processing chat for workflow ${workflowId}`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 3. Get State
router.get('/:workflowId', async (req: Request, res: Response) => {
    const workflowId = req.params.workflowId as string;
    let engine = workflows.get(workflowId);
    
    if (!engine) {
        // Try to revive from DB
        engine = new WorkflowEngine(workflowId);
        await engine.init();
        workflows.set(workflowId, engine);
    }

    res.json(engine.getState());
});

// 4. Trigger Phase Transition (e.g. force "Start Drafting")
router.post('/:workflowId/trigger', async (req: Request, res: Response) => {
    const workflowId = req.params.workflowId as string;
    
    let engine = workflows.get(workflowId);
    if (!engine) {
        engine = new WorkflowEngine(workflowId);
        await engine.init();
        workflows.set(workflowId, engine);
    }

    try {
        // Trigger next phase logic with empty input (for auto-phases like Drafting/Audit)
        const response = await engine.processInput(''); 
        res.json({ 
            response, 
            state: engine.getState() 
        });
    } catch (error) {
        logger.error(`Error triggering workflow ${workflowId}`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 5. Stream Chat
router.post('/:workflowId/chat/stream', async (req: Request, res: Response) => {
    const workflowId = req.params.workflowId as string;
    const { input } = req.body;

    let engine = workflows.get(workflowId);
    if (!engine) {
        engine = new WorkflowEngine(workflowId);
        await engine.init();
        workflows.set(workflowId, engine);
    }

    // Set headers for chunked transfer
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        await engine.processInputStream(input || '', (chunk) => {
            res.write(chunk);
        });
        res.end();
    } catch (error) {
        logger.error(`Error processing stream chat for workflow ${workflowId}`, error);
        res.status(500).end();
    }
});

export default router;
