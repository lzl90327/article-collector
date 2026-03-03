import { feishuWiki } from './src/services/feishu.wiki';
import { feishuConfig } from './src/config/feishu';

async function testWikiSync() {
    try {
        console.log('测试飞书知识库同步功能...');
        console.log('======================================');
        
        // 测试获取知识库节点
        const spaceId = feishuConfig.wiki.article.spaceId;
        console.log('文章库 Space ID:', spaceId);
        
        if (!spaceId) {
            console.log('❌ Space ID 未配置');
            return;
        }
        
        console.log('正在获取知识库节点列表...');
        const nodes = await feishuWiki.getWikiNodes(spaceId);
        console.log('✅ 成功获取节点列表，节点数:', nodes.length);
        
        if (nodes.length > 0) {
            console.log('第一个节点:', {
                title: nodes[0].title,
                type: nodes[0].obj_type,
                token: nodes[0].node_token?.substring(0, 10) + '...'
            });
        }
        
        // 测试创建文档
        console.log('');
        console.log('测试创建文档...');
        const result = await feishuWiki.createDocument({
            spaceId: spaceId,
            title: '测试文档-' + new Date().toISOString(),
            content: '# 测试标题\n\n这是一篇测试文档的内容。\n\n## 二级标题\n\n正文内容 here。'
        });
        
        console.log('✅ 文档创建成功！');
        console.log('文档 Token:', result.wikiToken.substring(0, 20) + '...');
        console.log('节点 Token:', result.nodeToken.substring(0, 20) + '...');
        console.log('文档 URL:', result.url);
        
    } catch (error: any) {
        console.log('❌ 测试失败:', error.message);
        console.log('错误详情:', error);
    }
}

testWikiSync();
