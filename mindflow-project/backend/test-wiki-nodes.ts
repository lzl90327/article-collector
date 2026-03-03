import { feishuWiki } from './src/services/feishu.wiki';
import { feishuConfig } from './src/config/feishu';

async function testGetWikiNodes() {
    try {
        console.log('测试获取飞书知识库节点...');
        console.log('======================================');
        
        const spaceId = feishuConfig.wiki.article.spaceId;
        console.log('Space ID:', spaceId);
        
        if (!spaceId) {
            console.log('❌ Space ID 未配置');
            return;
        }
        
        console.log('正在获取知识库节点列表...');
        const nodes = await feishuWiki.getWikiNodes(spaceId);
        console.log('✅ 成功获取节点列表！');
        console.log('节点数量:', nodes.length);
        
        if (nodes.length > 0) {
            console.log('\n前 3 个节点:');
            nodes.slice(0, 3).forEach((node, index) => {
                console.log(`\n[${index + 1}] ${node.title}`);
                console.log(`    类型: ${node.obj_type}`);
                console.log(`    Token: ${node.node_token?.substring(0, 15)}...`);
            });
        }
        
    } catch (error: any) {
        console.log('❌ 测试失败:', error.message);
        if (error.response?.data) {
            console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testGetWikiNodes();
