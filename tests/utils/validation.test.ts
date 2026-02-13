/**
 * 输入验证和清理测试
 */

import {
  sanitizeText,
  sanitizeHtml,
  validateAndCleanUrl,
  validateFileType,
  validateFileSize,
  securityCheck,
  createValidator,
  UrlSchema,
  TextContentSchema,
  ValidationPatterns,
} from '../../src/utils/validation';

describe('Validation Utils', () => {
  describe('sanitizeText', () => {
    it('应该移除 null 字节', () => {
      const input = 'hello\x00world';
      expect(sanitizeText(input)).toBe('hello world');
    });

    it('应该移除控制字符', () => {
      const input = 'hello\x01\x02\x03world';
      expect(sanitizeText(input)).toBe('hello world');
    });

    it('应该规范化空白字符', () => {
      const input = 'hello    world';
      expect(sanitizeText(input)).toBe('hello world');
    });

    it('应该处理空字符串', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null as any)).toBe('');
      expect(sanitizeText(undefined as any)).toBe('');
    });
  });

  describe('sanitizeHtml', () => {
    it('应该移除 script 标签', () => {
      const input = '<p>hello</p><script>alert("xss")</script>';
      expect(sanitizeHtml(input)).toBe('<p>hello</p>');
    });

    it('应该移除 style 标签', () => {
      const input = '<style>body{color:red}</style><p>hello</p>';
      expect(sanitizeHtml(input)).toBe('<p>hello</p>');
    });

    it('应该移除事件处理器', () => {
      const input = '<p onclick="alert(1)">hello</p>';
      expect(sanitizeHtml(input)).toBe('<p>hello</p>');
    });

    it('应该移除 javascript: 伪协议', () => {
      const input = '<a href="javascript:alert(1)">link</a>';
      const result = sanitizeHtml(input);
      // 验证 javascript: 被移除
      expect(result).not.toContain('javascript:');
      // 验证链接文本保留
      expect(result).toContain('link');
    });
  });

  describe('validateAndCleanUrl', () => {
    it('应该验证有效的 URL', () => {
      const result = validateAndCleanUrl('https://example.com/path');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://example.com/path');
    });

    it('应该拒绝无效的 URL', () => {
      const result = validateAndCleanUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该拒绝非 http/https 协议', () => {
      const result = validateAndCleanUrl('ftp://example.com');
      expect(result.valid).toBe(false);
    });

    it('应该移除跟踪参数', () => {
      const result = validateAndCleanUrl('https://example.com?utm_source=test&gclid=123');
      expect(result.valid).toBe(true);
      expect(result.url).toBe('https://example.com/');
    });
  });

  describe('validateFileType', () => {
    it('应该验证允许的文件类型', () => {
      expect(validateFileType('document.pdf', ['pdf', 'doc'])).toBe(true);
      expect(validateFileType('image.jpg', ['png', 'gif'])).toBe(false);
    });

    it('应该处理没有扩展名的文件', () => {
      expect(validateFileType('README', ['txt'])).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('应该验证文件大小', () => {
      expect(validateFileSize(1024 * 1024, 1)).toBe(true); // 1MB
      expect(validateFileSize(2 * 1024 * 1024, 1)).toBe(false); // 2MB
    });
  });

  describe('securityCheck', () => {
    it('应该检测银行卡号', () => {
      const result = securityCheck('我的卡号是 6222021234567890123');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('检测到可能的银行卡号');
    });

    it('应该检测身份证号', () => {
      const result = securityCheck('身份证号：110101199001011234');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('检测到可能的身份证号');
    });

    it('应该检测手机号', () => {
      const result = securityCheck('联系我：13800138000');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('检测到可能的手机号');
    });

    it('应该检测密码', () => {
      const result = securityCheck('password: mysecret123');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('检测到可能的密码');
    });

    it('应该检测 API Key', () => {
      const result = securityCheck('api_key=sk-1234567890abcdef');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain('检测到可能的 API Key');
    });

    it('应该认为安全的内容为安全', () => {
      const result = securityCheck('这是一段普通的文本内容');
      expect(result.safe).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('InputValidator', () => {
    it('应该验证 URL', () => {
      const validator = createValidator();
      const result = validator.url('not-a-url').validate();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该验证文本内容', () => {
      const validator = createValidator();
      const result = validator.text('', '标题').validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('不能为空');
    });

    it('应该验证必填字段', () => {
      const validator = createValidator();
      const result = validator.required(null, '字段名').validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('必填字段');
    });

    it('应该验证数组', () => {
      const validator = createValidator();
      const result = validator.array('not-array', '列表', 1, 10).validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('必须是数组');
    });

    it('应该支持链式调用', () => {
      const validator = createValidator();
      const result = validator
        .required('value', '字段1')
        .url('https://example.com', '字段2')
        .text('content', '字段3')
        .validate();

      expect(result.valid).toBe(true);
    });

    it('应该支持自定义验证', () => {
      const validator = createValidator();
      const result = validator
        .custom(() => false, '自定义错误')
        .validate();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe('自定义错误');
    });

    it('应该能重置验证器', () => {
      const validator = createValidator();
      validator.required(null, '字段');
      validator.reset();
      const result = validator.validate();

      expect(result.valid).toBe(true);
    });
  });

  describe('Zod Schemas', () => {
    describe('UrlSchema', () => {
      it('应该验证有效的 URL', () => {
        const result = UrlSchema.safeParse('https://example.com');
        expect(result.success).toBe(true);
      });

      it('应该拒绝无效的 URL', () => {
        const result = UrlSchema.safeParse('not-a-url');
        expect(result.success).toBe(false);
      });

      it('应该拒绝过长的 URL', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(3000);
        const result = UrlSchema.safeParse(longUrl);
        expect(result.success).toBe(false);
      });
    });

    describe('TextContentSchema', () => {
      it('应该验证并清理文本', () => {
        const result = TextContentSchema.safeParse('hello\x00world');
        expect(result.success).toBe(true);
        expect(result.data).toBe('hello world');
      });

      it('应该拒绝空内容', () => {
        const result = TextContentSchema.safeParse('');
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ValidationPatterns', () => {
    it('应该匹配邮箱', () => {
      expect(ValidationPatterns.email.test('test@example.com')).toBe(true);
      expect(ValidationPatterns.email.test('invalid-email')).toBe(false);
    });

    it('应该匹配手机号', () => {
      expect(ValidationPatterns.phone.test('13800138000')).toBe(true);
      expect(ValidationPatterns.phone.test('12345678901')).toBe(false);
    });

    it('应该匹配微信号', () => {
      expect(ValidationPatterns.wechat.test('wxid_abc123')).toBe(true);
      expect(ValidationPatterns.wechat.test('123abc')).toBe(false);
    });

    it('应该匹配小红书链接', () => {
      expect(ValidationPatterns.xiaohongshu.test('https://www.xiaohongshu.com/explore/123')).toBe(true);
      expect(ValidationPatterns.xiaohongshu.test('https://example.com')).toBe(false);
    });

    it('应该匹配微信公众号文章', () => {
      expect(ValidationPatterns.wechatArticle.test('https://mp.weixin.qq.com/s/abc123')).toBe(true);
      expect(ValidationPatterns.wechatArticle.test('https://example.com')).toBe(false);
    });

    it('应该匹配 B站视频', () => {
      expect(ValidationPatterns.bilibili.test('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true);
      expect(ValidationPatterns.bilibili.test('https://example.com')).toBe(false);
    });
  });
});
