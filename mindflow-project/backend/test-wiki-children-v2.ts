import axios from 'axios';
import { feishuAuthDB } from './src/lib/feishuAuth.db';

async function testWikiChildrenV2() {
  console.log('======================================');
  console.log('获取文字素材库下的子文档 (尝试不同方法)');
  console.log('======================================\n');

  const spaceId = '7597246840014130375';
  
  // 文字素材库的两种 token
  const nodeToken = 'E8jHwM9kIip9lnkyLWRcNxGjndb';  // node_token
  const objToken = 'HOLEdDQmhoTz4UxhLAWcve4UnCc';    // obj_token

  try {
    const authInfo = await feishuAuthDB.findByUserId('test_user_123');
    if (!authInfo) {
      console.log('❌ 未找到用户授权信息');
      return;
    }

    console.log('✅ 获取到 User Access Token\n');

    // 方法 1: 使用 node_token 作为 parent_node_token
    console.log('方法 1: 使用 node_token 作为 parent_node_token');
    console.log(`parent_node_token: ${nodeToken}`);
    
    try {
      const response1 = await axios.get(
        `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
        {
          headers: { 'Authorization': `Bearer ${authInfo.accessToken}` },
          params: { page_size: 50, parent_node_token: nodeToken },
        }
      );
      
      if (response1.data.code === 0) {
        const nodes1 = response1.data.data?.items || [];
        console.log(`✅ 找到 ${nodes1.length} 个子文档\n`);
        if (nodes1.length > 0) {
          nodes1.forEach((node: any, i: number) => {
            console.log(`  ${i + 1}. ${node.title}`);
          });
        }
      } else {
        console.log(`❌ 错误: ${response1.data.msg}\n`);
      }
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}\n`);
    }

    // 方法 2: 使用 obj_token 作为 parent_node_token
    console.log('\n方法 2: 使用 obj_token 作为 parent_node_token');
    console.log(`parent_node_token: ${objToken}`);
    
    try {
      const response2 = await axios.get(
        `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
        {
          headers: { 'Authorization': `Bearer ${authInfo.accessToken}` },
          params: { page_size: 50, parent_node_token: objToken },
        }
      );
      
      if (response2.data.code === 0) {
        const nodes2 = response2.data.data?.items || [];
        console.log(`✅ 找到 ${nodes2.length} 个子文档\n`);
        if (nodes2.length > 0) {
          nodes2.forEach((node: any, i: number) => {
            console.log(`  ${i + 1}. ${node.title}`);
          });
        }
      } else {
        console.log(`❌ 错误: ${response2.data.msg}\n`);
      }
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}\n`);
    }

    // 方法 3: 尝试获取所有节点并筛选
    console.log('\n方法 3: 获取所有节点并筛选 parent_node_token');
    
    try {
      const response3 = await axios.get(
        `https://open.feishu.cn/open-apis/wiki/v2/spaces/${spaceId}/nodes`,
        {
          headers: { 'Authorization': `Bearer ${authInfo.accessToken}` },
          params: { page_size: 50 },
        }
      );
      
      if (response3.data.code === 0) {
        const allNodes = response3.data.data?.items || [];
        
        // 筛选出 parent_node_token 匹配 nodeToken 的节点
        const childrenByNodeToken = allNodes.filter((n: any) => n.parent_node_token === nodeToken);
        console.log(`\n  匹配 node_token (${nodeToken}): ${childrenByNodeToken.length} 个`);
        
        // 筛选出 parent_node_token 匹配 objToken 的节点
        const childrenByObjToken = allNodes.filter((n: any) => n.parent_node_token === objToken);
        console.log(`  匹配 obj_token (${objToken}): ${childrenByObjToken.length} 个`);
        
        // 显示所有节点的 parent_node_token 分布
        console.log('\n  所有节点的 parent_node_token 分布:');
        const parentMap: any = {};
        allNodes.forEach((n: any) => {
          const parent = n.parent_node_token || '(空)';
          parentMap[parent] = (parentMap[parent] || 0) + 1;
        });
        Object.entries(parentMap).forEach(([parent, count]) => {
          console.log(`    ${parent}: ${count} 个节点`);
        });
      }
    } catch (e: any) {
      console.log(`❌ 请求失败: ${e.message}\n`);
    }

  } catch (error: any) {
    console.log('❌ 获取失败:', error.message);
  }
}

testWikiChildrenV2();
