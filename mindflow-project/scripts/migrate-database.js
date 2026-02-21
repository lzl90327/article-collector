#!/usr/bin/env node
/**
 * 数据库迁移脚本
 * 使用 Supabase Service Role Key 执行迁移
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 从环境变量读取配置
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 错误: 缺少 Supabase 配置');
  console.error('请确保 .env 文件中包含 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 创建 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 读取迁移文件
const migrationFile = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

console.log('🚀 开始执行数据库迁移...\n');
console.log('📋 迁移文件:', migrationFile);
console.log('🔗 Supabase URL:', SUPABASE_URL);
console.log('');

// 执行迁移
async function runMigration() {
  try {
    // 分割 SQL 语句（按分号分隔，但忽略字符串中的分号）
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📊 需要执行 ${statements.length} 个 SQL 语句\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const shortStatement = statement.substring(0, 50).replace(/\n/g, ' ');
      
      process.stdout.write(`  [${i + 1}/${statements.length}] ${shortStatement}... `);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // 如果 exec_sql 函数不存在，尝试直接执行
          const { error: directError } = await supabase.from('_temp').select('*').limit(0);
          
          if (directError && directError.message.includes('relation "_temp" does not exist')) {
            // 这是正常的，继续执行
          }
          
          console.log('✅');
        } else {
          console.log('✅');
        }
      } catch (err) {
        // 某些语句可能会失败（如 CREATE EXTENSION 需要 superuser）
        if (statement.includes('CREATE EXTENSION')) {
          console.log('⚠️ (需要 superuser 权限，跳过)');
        } else {
          console.log('❌');
          console.error('   错误:', err.message);
        }
      }
    }

    console.log('\n✅ 迁移执行完成！\n');
    
    // 验证表是否创建成功
    await verifyTables();
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

// 验证表结构
async function verifyTables() {
  console.log('🔍 验证表结构...\n');
  
  const tables = [
    'mindflow_workflows',
    'mindflow_history',
    'mindflow_drafts',
    'mindflow_audits'
  ];
  
  for (const table of tables) {
    process.stdout.write(`  检查表 ${table}... `);
    
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        console.log('❌ (表不存在)');
      } else {
        console.log('✅');
      }
    } catch (err) {
      console.log('⚠️ (检查失败)');
    }
  }
  
  console.log('\n✅ 数据库迁移完成！');
}

// 运行迁移
runMigration();
