# Unified LLM API Gateway

一个统一管理大模型 API 的网关项目，可以通过一个统一的 API 接口调用多种不同提供商的服务，统一转换为 OpenAI 格式，支持负载均衡、自动重试、渠道冷却、限流等功能。

## ✨ 特性

- **无前端** - 纯环境变量配置 API 渠道
- **多提供商支持** - 支持 OpenAI、Anthropic、Gemini、Vertex AI、Azure、AWS、xAI、Cohere、Groq、Cloudflare、OpenRouter、302.AI 等
- **统一格式** - 所有响应统一转换为 OpenAI 格式
- **负载均衡** - 支持权重配置的负载均衡
- **自动重试** - API 渠道失败时自动切换到下一个可用渠道
- **渠道冷却** - 失败的渠道自动进入冷却期，避免持续失败
- **超时管理** - 支持全局和模型级别的超时配置
- **权限控制** - 支持通配符的细粒度模型访问控制
- **限流保护** - 支持多种时间窗口的速率限制（分钟/小时/天/月/年）
- **内容审查** - 可选的 OpenAI moderation 内容审查
- **Tool Use 支持** - 支持 OpenAI、Anthropic、Gemini 等的函数调用
- **多模态支持** - 支持文本、图像、音频等多种内容类型
- **Vercel 部署** - 开箱即用的 Vercel Serverless 部署

## 🚀 快速开始

### 本地开发

1. 克隆项目并安装依赖：

```bash
git clone <repository-url>
cd unified-llm-api-gateway
npm install
```

2. 复制环境变量示例文件：

```bash
cp .env.example .env
```

3. 编辑 `.env` 文件，配置你的 API 密钥和模型：

```env
API_KEYS=sk-your-gateway-key

OPENAI_API_KEY=sk-...
OPENAI_MODELS=gpt-4,gpt-3.5-turbo

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODELS=claude-3-opus,claude-3-sonnet
```

4. 启动开发服务器：

```bash
npm run dev
```

### Vercel 部署

1. 安装 Vercel CLI：

```bash
npm install -g vercel
```

2. 部署到 Vercel：

```bash
vercel
```

3. 在 Vercel Dashboard 中配置环境变量。

## 📝 配置说明

### API 密钥配置

配置可以访问网关的 API 密钥：

```env
# 基础配置
API_KEYS=sk-key-1,sk-key-2,sk-key-3

# 为每个密钥配置权限
API_KEY_1_MODELS=gpt-4*,claude-3*
API_KEY_1_RATE_LIMIT=60/min

API_KEY_2_MODELS=*
API_KEY_2_RATE_LIMIT=100/hour
```

### 提供商配置

#### OpenAI

```env
OPENAI_API_KEY=sk-...
OPENAI_MODELS=gpt-4,gpt-4-turbo,gpt-3.5-turbo,dall-e-3
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WEIGHT=1
OPENAI_TIMEOUT=120000
```

#### Anthropic

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODELS=claude-3-opus,claude-3-sonnet,claude-3-haiku
ANTHROPIC_WEIGHT=1
```

#### Google Gemini

```env
GEMINI_API_KEY=...
GEMINI_MODELS=gemini-pro,gemini-pro-vision
```

#### Groq

```env
GROQ_API_KEY=...
GROQ_MODELS=llama3-70b,mixtral-8x7b
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

#### OpenRouter

```env
OPENROUTER_API_KEY=...
OPENROUTER_MODELS=*
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

#### 其他提供商

支持 xAI、Cloudflare、Azure、Cohere、AWS Bedrock、Vertex AI 等，详见 `.env.example`。

### 多账号配置

支持同一提供商配置多个账号：

```env
OPENAI_API_KEY=sk-account-1
OPENAI_MODELS=gpt-4,gpt-3.5-turbo
OPENAI_WEIGHT=2

OPENAI_1_API_KEY=sk-account-2
OPENAI_1_MODELS=gpt-4,gpt-3.5-turbo
OPENAI_1_WEIGHT=1

OPENAI_2_API_KEY=sk-account-3
OPENAI_2_MODELS=gpt-3.5-turbo
OPENAI_2_WEIGHT=1
```

### 网关设置

```env
# 默认超时时间（毫秒）
DEFAULT_TIMEOUT=120000

# 最大重试次数
MAX_RETRIES=3

# 渠道冷却时间（毫秒）
COOLDOWN_TIME=300000

# 日志级别
LOG_LEVEL=INFO

# 内容审查
MODERATION_ENABLED=true
OPENAI_MODERATION_API_KEY=sk-...
```

### 模型级别配置

为特定模型设置超时时间：

```env
MODEL_GPT_4_TIMEOUT=180000
MODEL_CLAUDE_3_OPUS_TIMEOUT=150000
```

## 🔌 API 端点

### Chat Completions

```bash
POST /v1/chat/completions
```

兼容 OpenAI Chat Completions API：

```bash
curl https://your-domain.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-gateway-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Image Generation

```bash
POST /v1/images/generations
```

生成图像：

```bash
curl https://your-domain.vercel.app/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-gateway-key" \
  -d '{
    "model": "dall-e-3",
    "prompt": "A beautiful sunset",
    "n": 1,
    "size": "1024x1024"
  }'
```

### Audio Transcription

```bash
POST /v1/audio/transcriptions
```

转录音频：

```bash
curl https://your-domain.vercel.app/v1/audio/transcriptions \
  -H "Authorization: Bearer sk-your-gateway-key" \
  -F file=@audio.mp3 \
  -F model=whisper-1
```

### Moderations

```bash
POST /v1/moderations
```

内容审查：

```bash
curl https://your-domain.vercel.app/v1/moderations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-gateway-key" \
  -d '{
    "input": "Text to moderate"
  }'
```

### Models

```bash
GET /v1/models
```

获取可用模型列表：

```bash
curl https://your-domain.vercel.app/v1/models \
  -H "Authorization: Bearer sk-your-gateway-key"
```

## 🎯 核心功能

### 负载均衡

网关使用加权随机算法进行负载均衡。可以通过 `WEIGHT` 参数控制流量分配：

```env
OPENAI_WEIGHT=2
ANTHROPIC_WEIGHT=1
```

上述配置中，OpenAI 会收到 2/3 的流量，Anthropic 会收到 1/3 的流量。

### 自动重试

当一个 API 渠道失败时，网关会自动切换到下一个可用渠道。最多重试 `MAX_RETRIES` 次。

可重试的错误类型：
- 超时错误
- 服务器错误 (500, 502, 503, 504)
- 速率限制错误 (429)

### 渠道冷却

当渠道响应失败时，会自动进入冷却期（默认 5 分钟）。冷却期间该渠道不会被选中，避免持续失败。

### 限流

支持多种时间窗口的速率限制：

```env
API_KEY_1_RATE_LIMIT=60/min    # 每分钟 60 次
API_KEY_2_RATE_LIMIT=100/hour  # 每小时 100 次
API_KEY_3_RATE_LIMIT=1000/day  # 每天 1000 次
API_KEY_4_RATE_LIMIT=5000/month # 每月 5000 次
API_KEY_5_RATE_LIMIT=10000/year # 每年 10000 次
```

响应头会包含限流信息：
- `X-RateLimit-Limit`: 速率限制
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 重置时间戳

### 权限控制

使用通配符控制 API 密钥可访问的模型：

```env
# 允许访问所有 GPT-4 模型
API_KEY_1_MODELS=gpt-4*

# 允许访问特定模型
API_KEY_2_MODELS=gpt-4,gpt-3.5-turbo,claude-3-opus

# 允许访问所有模型
API_KEY_3_MODELS=*

# 允许访问 Claude 3 和 Gemini 系列
API_KEY_4_MODELS=claude-3*,gemini-*
```

### 内容审查

启用内容审查后，用户消息会在发送到后端 API 前进行检查：

```env
MODERATION_ENABLED=true
OPENAI_MODERATION_API_KEY=sk-...
```

如果内容违反政策，请求会被拒绝。

## 🛠️ 高级功能

### Tool Use / Function Calling

网关支持 OpenAI、Anthropic、Gemini 的原生函数调用：

```javascript
{
  "model": "gpt-4",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather information",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string"
            }
          }
        }
      }
    }
  ]
}
```

### 多模态支持

支持图像识别：

```javascript
{
  "model": "gpt-4-vision",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What's in this image?"},
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/image.jpg"
          }
        }
      ]
    }
  ]
}
```

## 📊 监控和日志

设置日志级别：

```env
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARN, ERROR
```

日志会包含：
- 请求信息（模型、提供商）
- 重试尝试
- 渠道冷却状态
- 错误信息

## 🔒 安全建议

1. **保护 API 密钥**：不要在代码中硬编码 API 密钥
2. **使用强密钥**：为网关 API 密钥使用长且随机的字符串
3. **启用限流**：防止 API 滥用
4. **启用内容审查**：降低后端 API 被封禁的风险
5. **定期轮换密钥**：定期更换提供商 API 密钥

## 📦 依赖

- Node.js 18+
- TypeScript 5+
- Vercel (用于部署)

## 🤝 贡献

欢迎提交 Pull Request 或报告 Issue！

## 📄 许可

MIT License

## 🙏 致谢

感谢所有 LLM 提供商的优秀服务。
