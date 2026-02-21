#!/usr/bin/env node
/**
 * 数据库连接验证脚本
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyDatabase() {
  console.log('🔍 验证数据库连接...\n');

  // 1. 测试连接
  console.log('1. 测试数据库连接...');
  const { data: testData, error: testError } = await supabase
    .from('mindflow_workflows')
    .select('count')
    .limit(1);

  if (testError) {
    console.log('   ❌ 连接失败:', testError.message);
    return;
  }
  console.log('   ✅ 连接成功');

  // 2. 查询最近创建的工作流
  console.log('\n2. 查询最近的工作流...');
  const { data: workflows, error: wfError } = await supabase
    .from('mindflow_workflows')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (wfError) {
    console.log('   ❌ 查询失败:', wfError.message);
  } else {
    console.log(`   ✅ 找到 ${workflows.length} 个工作流`);
    workflows.forEach((wf, i) => {
      console.log(`      ${i + 1}. ${wf.workflow_id} (${wf.current_phase}) - ${new Date(wf.created_at).toLocaleString()}`);
    });
  }

  // 3. 查询历史消息
  console.log('\n3. 查询历史消息...');
  const { data: messages, error: msgError } = await supabase
    .from('mindflow_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5);

  if (msgError) {
    console.log('   ❌ 查询失败:', msgError.message);
  } else {
    console.log(`   ✅ 找到 ${messages.length} 条消息`);
    messages.forEach((msg, i) => {
      const preview = msg.content.substring(0, 50).replace(/\n/g, ' ');
      console.log(`      ${i + 1}. [${msg.role}] ${preview}...`);
    });
  }

  // 4. 统计信息
  console.log('\n4. 数据库统计...');
  const tables = ['mindflow_workflows', 'mindflow_history', 'mindflow_drafts', 'mindflow_audits'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ${table}: ❌ ${error.message}`);
    } else {
      console.log(`   ${table}: ${count} 条记录 ✅`);
    }
  }

  console.log('\n✅ 数据库验证完成！');
}

verifyDatabase().catch(console.error);
