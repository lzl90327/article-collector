/**
 * Jest 配置文件
 * 用于配置测试框架和测试环境
 */

module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',

  // 根目录
  rootDir: '.',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/?(*.)+(spec|test).{ts,tsx}',
  ],

  // 忽略测试的文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.taro/',
  ],

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 模块路径别名
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tarojs/components$': '<rootDir>/src/__mocks__/taro-components.ts',
    '^@tarojs/taro$': '<rootDir>/src/__mocks__/taro.ts',
    '^@nutui/nutui-react-taro$': '<rootDir>/src/__mocks__/nutui-react-taro.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // 转换器配置 - 使用 babel-jest 处理所有文件
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },

  // 转换忽略模式
  transformIgnorePatterns: [
    'node_modules/(?!(@tarojs|@nutui)/)',
  ],

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
    '!src/**/__tests__/**',
    '!src/**/*.config.{ts,js}',
    '!src/app.ts',
    '!src/index.html',
  ],

  // 覆盖率目录
  coverageDirectory: '<rootDir>/coverage',

  // 覆盖率报告格式
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 60,
      statements: 60,
    },
  },

  // 测试超时
  testTimeout: 10000,

  // 是否显示详细输出
  verbose: true,

  // 清除 mock
  clearMocks: true,

  // 恢复 mock
  restoreMocks: true,

  // 错误时停止
  bail: 0,

  // 缓存目录
  cacheDirectory: '<rootDir>/.jest-cache',

  // 全局变量
  globals: {
    'process.env.TARO_ENV': 'h5',
    'process.env.NODE_ENV': 'test',
  },
};
