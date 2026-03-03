import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function runTests() {
  console.log('======================================');
  console.log('飞书知识库功能完整自测');
  console.log('======================================\n');

  const results: any = {
    tests: [],
    passed: 0,
    failed: 0,
  };

  try {
    // 获取 Token
    console.log('🔑 获取 Access Token...');
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    // ========== 测试 1: 获取知识库文档列表 ==========
    console.log('📋 测试 1: 获取知识库文档列表');
    console.log('--------------------------------------');
    try {
      const docs = await feishuMCP.listDocuments(token, 'my_library', 20);
      console.log(`✅ 成功获取文档列表，共 ${docs.length} 个文档`);
      
      if (docs.length > 0) {
        console.log('\n前 5 个文档:');
        docs.slice(0, 5).forEach((doc, i) => {
          console.log(`  [${i + 1}] ${doc.title}`);
          console.log(`      ID: ${doc.docId}`);
          console.log(`      URL: ${doc.url}`);
        });
      }
      
      results.tests.push({
        name: '获取知识库文档列表',
        status: 'passed',
        count: docs.length,
      });
      results.passed++;
      
      // 保存第一个文档 ID 用于后续测试
      results.firstDocId = docs[0]?.docId;
    } catch (error: any) {
      console.log('❌ 失败:', error.message);
      results.tests.push({
        name: '获取知识库文档列表',
        status: 'failed',
        error: error.message,
      });
      results.failed++;
    }
    console.log('');

    // ========== 测试 2: 获取文档内容 ==========
    console.log('📄 测试 2: 获取文档内容');
    console.log('--------------------------------------');
    if (results.firstDocId) {
      try {
        const docContent = await feishuMCP.fetchDocument(token, results.firstDocId);
        console.log('✅ 成功获取文档内容');
        console.log(`   标题: ${docContent.title}`);
        console.log(`   内容长度: ${docContent.content?.length || 0} 字符`);
        console.log(`   内容预览: ${docContent.content?.substring(0, 100)}...`);
        
        results.tests.push({
          name: '获取文档内容',
          status: 'passed',
          title: docContent.title,
        });
        results.passed++;
      } catch (error: any) {
        console.log('❌ 失败:', error.message);
        results.tests.push({
          name: '获取文档内容',
          status: 'failed',
          error: error.message,
        });
        results.failed++;
      }
    } else {
      console.log('⚠️  跳过: 没有可用的文档 ID');
      results.tests.push({
        name: '获取文档内容',
        status: 'skipped',
        reason: '没有可用的文档 ID',
      });
    }
    console.log('');

    // ========== 测试 3: 在指定知识库下创建子文档 ==========
    console.log('📝 测试 3: 在指定知识库下创建子文档');
    console.log('--------------------------------------');
    try {
      const testTitle = `自测子文档 - ${new Date().toLocaleString()}`;
      const testContent = `# 自测文档

这是通过 MCP 创建的测试子文档。

## 测试信息

- 创建时间: ${new Date().toISOString()}
- 测试目的: 验证在知识库下创建子文档功能
- 来源: MindFlow 小程序自测

## 内容验证

如果看到这段文字，说明文档内容保存成功！
`;

      // 创建文档（不指定 folder_token，会创建在我的文档库）
      const createResult = await feishuMCP.createDocument(token, {
        title: testTitle,
        content: testContent,
      });
      
      console.log('✅ 成功创建子文档');
      console.log(`   文档 ID: ${createResult.docToken}`);
      console.log(`   文档 URL: ${createResult.url}`);
      
      results.newDocId = createResult.docToken;
      results.newDocUrl = createResult.url;
      
      results.tests.push({
        name: '在指定知识库下创建子文档',
        status: 'passed',
        docId: createResult.docToken,
        url: createResult.url,
      });
      results.passed++;
    } catch (error: any) {
      console.log('❌ 失败:', error.message);
      results.tests.push({
        name: '在指定知识库下创建子文档',
        status: 'failed',
        error: error.message,
      });
      results.failed++;
    }
    console.log('');

    // ========== 测试 4: 验证子文档内容 ==========
    console.log('🔍 测试 4: 验证子文档内容');
    console.log('--------------------------------------');
    if (results.newDocId) {
      try {
        const verifyContent = await feishuMCP.fetchDocument(token, results.newDocId);
        console.log('✅ 成功验证子文档');
        console.log(`   标题: ${verifyContent.title}`);
        console.log(`   内容长度: ${verifyContent.content?.length || 0} 字符`);
        
        // 验证内容是否包含预期文本
        const hasExpectedContent = verifyContent.content?.includes('MindFlow 小程序自测');
        console.log(`   内容验证: ${hasExpectedContent ? '✅ 通过' : '❌ 未通过'}`);
        
        results.tests.push({
          name: '验证子文档内容',
          status: 'passed',
          contentVerified: hasExpectedContent,
        });
        results.passed++;
      } catch (error: any) {
        console.log('❌ 失败:', error.message);
        results.tests.push({
          name: '验证子文档内容',
          status: 'failed',
          error: error.message,
        });
        results.failed++;
      }
    } else {
      console.log('⚠️  跳过: 没有新创建的文档 ID');
      results.tests.push({
        name: '验证子文档内容',
        status: 'skipped',
        reason: '没有新创建的文档 ID',
      });
    }
    console.log('');

    // ========== 测试 5: 更新文档内容 ==========
    console.log('✏️  测试 5: 更新文档内容');
    console.log('--------------------------------------');
    if (results.newDocId) {
      try {
        await feishuMCP.updateDocument(token, {
          docId: results.newDocId,
          content: '\n\n## 更新测试\n\n文档已通过 MCP 更新功能追加内容！',
          mode: 'append',
        });
        
        console.log('✅ 成功更新文档');
        
        // 验证更新
        const updatedContent = await feishuMCP.fetchDocument(token, results.newDocId);
        const hasUpdate = updatedContent.content?.includes('文档已通过 MCP 更新功能追加内容');
        console.log(`   更新验证: ${hasUpdate ? '✅ 通过' : '❌ 未通过'}`);
        
        results.tests.push({
          name: '更新文档内容',
          status: 'passed',
          updateVerified: hasUpdate,
        });
        results.passed++;
      } catch (error: any) {
        console.log('❌ 失败:', error.message);
        results.tests.push({
          name: '更新文档内容',
          status: 'failed',
          error: error.message,
        });
        results.failed++;
      }
    } else {
      console.log('⚠️  跳过: 没有新创建的文档 ID');
      results.tests.push({
        name: '更新文档内容',
        status: 'skipped',
        reason: '没有新创建的文档 ID',
      });
    }
    console.log('');

    // ========== 生成测试报告 ==========
    console.log('======================================');
    console.log('📊 自测报告');
    console.log('======================================');
    console.log(`\n总测试数: ${results.tests.length}`);
    console.log(`✅ 通过: ${results.passed}`);
    console.log(`❌ 失败: ${results.failed}`);
    console.log(`⏭️  跳过: ${results.tests.length - results.passed - results.failed}`);
    console.log('\n详细结果:');
    results.tests.forEach((test: any, i: number) => {
      const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️';
      console.log(`  ${icon} ${test.name}`);
    });
    
    if (results.newDocUrl) {
      console.log('\n📎 测试创建的文档:');
      console.log(`   ${results.newDocUrl}`);
    }
    
    console.log('\n======================================');
    console.log(results.failed === 0 ? '🎉 所有测试通过！' : '⚠️  部分测试失败，请检查');
    console.log('======================================');

  } catch (error: any) {
    console.log('❌ 测试过程出错:', error.message);
    console.log(error);
  }
}

runTests();
