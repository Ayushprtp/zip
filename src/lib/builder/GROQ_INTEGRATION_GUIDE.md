# Groq Integration Guide for AI Builder

## Overview

The AI Builder now uses **Groq** as the default AI provider, offering ultra-fast inference speeds (up to 750 tokens/second) with powerful open-source models.

## Why Groq?

- **Speed**: Up to 10x faster than traditional cloud AI providers
- **Cost-Effective**: Competitive pricing with generous free tier
- **Quality**: Latest Llama 4 and Llama 3.3 models
- **Reliability**: Production-ready infrastructure

## Available Models

### Production Models (Recommended)

#### Llama 3.3 70B Versatile (Default)
- **Model ID**: `llama-3.3-70b-versatile`
- **Speed**: 280 tokens/sec
- **Best For**: General-purpose code generation, chat, reasoning
- **Context**: 131K tokens
- **Price**: $0.59/$0.79 per 1M tokens

#### Llama 3.1 8B Instant
- **Model ID**: `llama-3.1-8b-instant`
- **Speed**: 560 tokens/sec
- **Best For**: Fast responses, simple tasks
- **Context**: 131K tokens
- **Price**: $0.05/$0.08 per 1M tokens

#### GPT OSS 120B
- **Model ID**: `gpt-oss-120b`
- **Speed**: 500 tokens/sec
- **Best For**: Complex reasoning, advanced code generation
- **Context**: 131K tokens
- **Price**: $0.15/$0.60 per 1M tokens

### Preview Models (Latest Features)

#### Llama 4 Scout (Recommended for Code)
- **Model ID**: `llama-4-scout`
- **Speed**: 750 tokens/sec
- **Best For**: Code generation, summarization, reasoning
- **Context**: 131K tokens
- **Price**: $0.11/$0.34 per 1M tokens

#### Llama 4 Maverick
- **Model ID**: `llama-4-maverick`
- **Speed**: 600 tokens/sec
- **Best For**: Chat, creative tasks, multilingual
- **Context**: 131K tokens
- **Price**: $0.20/$0.60 per 1M tokens

#### Qwen3 32B
- **Model ID**: `qwen3-32b`
- **Speed**: 400 tokens/sec
- **Best For**: Multilingual code, Chinese language support
- **Context**: 131K tokens
- **Price**: $0.29/$0.59 per 1M tokens

### AI Systems

#### Compound
- **Model ID**: `compound`
- **Speed**: 450 tokens/sec
- **Best For**: Complex queries with web search and code execution
- **Features**: Built-in tools, web search, code execution

#### Compound Mini
- **Model ID**: `compound-mini`
- **Speed**: 450 tokens/sec
- **Best For**: Lighter version of Compound

## Usage in Builder

### Default Configuration

The builder automatically uses Groq with Llama 3.3 70B:

```typescript
import { createBuilderAIService } from '@/lib/builder/ai-service-factory';

// Uses default: Groq Llama 3.3 70B
const aiService = createBuilderAIService();
```

### Specialized Services

#### For Code Generation
```typescript
import { createCodeGenerationService } from '@/lib/builder/ai-service-factory';

// Uses Llama 4 Scout (optimized for code)
const codeService = createCodeGenerationService();
```

#### For Chat/Assistant
```typescript
import { createChatService } from '@/lib/builder/ai-service-factory';

// Uses Llama 4 Maverick (better for conversation)
const chatService = createChatService();
```

#### For Fast Responses
```typescript
import { createFastResponseService } from '@/lib/builder/ai-service-factory';

// Uses Llama 3.1 8B (fastest)
const fastService = createFastResponseService();
```

#### Custom Model Selection
```typescript
import { createCustomAIService } from '@/lib/builder/ai-service-factory';

// Use any available model
const customService = createCustomAIService('groq', 'qwen3-32b');
```

### Direct AI Service Usage

```typescript
import { AIService } from '@/lib/builder/ai-service';

const aiService = new AIService({
  provider: 'groq',
  modelName: 'llama-3.3-70b-versatile',
});

await aiService.generateCode({
  prompt: 'Create a React component for a todo list',
  context: [],
  onToken: (token) => console.log(token),
  onComplete: (response) => console.log('Done:', response),
});
```

## Environment Configuration

### Required Environment Variables

```bash
# Groq API Key (required)
GROQ_API_KEY=gsk_your_api_key_here

# Groq Base URL (optional, defaults to official endpoint)
GROQ_BASE_URL=https://api.groq.com/openai/v1

# Default model (optional)
E2E_DEFAULT_MODEL=groq/llama-3.3-70b-versatile
```

### Getting Your API Key

1. Visit [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Add it to your `.env` file

## Model Selection Guide

### Choose Based on Your Needs

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| General code generation | Llama 3.3 70B | Best balance of speed and quality |
| Fast prototyping | Llama 3.1 8B | Fastest responses |
| Complex algorithms | GPT OSS 120B | Best reasoning capabilities |
| Code-focused tasks | Llama 4 Scout | Optimized for code |
| Chat/conversation | Llama 4 Maverick | Better conversational abilities |
| Multilingual projects | Qwen3 32B | Excellent multilingual support |
| Research/web queries | Compound | Built-in web search |

## Performance Tips

### 1. Use Streaming for Better UX
```typescript
await aiService.generateCode({
  prompt: 'Your prompt',
  context: [],
  onToken: (token) => {
    // Update UI incrementally
    updateUI(token);
  },
});
```

### 2. Choose the Right Model
- Use faster models (8B) for simple tasks
- Use larger models (70B+) for complex reasoning
- Use specialized models (Scout) for code generation

### 3. Optimize Context
- Only include relevant files in context
- Trim large files to essential parts
- Use mentions strategically

### 4. Handle Errors Gracefully
```typescript
await aiService.generateCode({
  prompt: 'Your prompt',
  context: [],
  onError: (error) => {
    console.error('Generation failed:', error);
    // Fallback or retry logic
  },
});
```

## Rate Limits (Developer Plan)

| Model | Tokens Per Minute | Requests Per Minute |
|-------|------------------|---------------------|
| Llama 3.3 70B | 300K | 1K |
| Llama 3.1 8B | 250K | 1K |
| Llama 4 Scout | 300K | 1K |
| Llama 4 Maverick | 300K | 1K |
| GPT OSS 120B | 250K | 1K |
| Qwen3 32B | 300K | 1K |

## Troubleshooting

### API Key Issues
```
Error: Invalid API key
```
**Solution**: Verify your `GROQ_API_KEY` in `.env` file

### Rate Limit Errors
```
Error: Rate limit exceeded
```
**Solution**: 
- Implement exponential backoff
- Upgrade to paid plan
- Use faster models to reduce token usage

### Model Not Found
```
Error: Unknown model
```
**Solution**: Check model ID matches available models list

### Slow Responses
**Solution**:
- Switch to faster model (8B or Scout)
- Reduce context size
- Check network connection

## Migration from Other Providers

### From Claude
```typescript
// Before
const service = new AIService({
  model: 'claude',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// After
const service = new AIService({
  provider: 'groq',
  modelName: 'llama-3.3-70b-versatile',
});
```

### From Gemini
```typescript
// Before
const service = new AIService({
  model: 'gemini',
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// After
const service = new AIService({
  provider: 'groq',
  modelName: 'llama-3.3-70b-versatile',
});
```

## Best Practices

1. **Start with Default**: Use the default Llama 3.3 70B for most tasks
2. **Profile Performance**: Test different models for your specific use case
3. **Monitor Costs**: Track token usage in Groq console
4. **Handle Failures**: Always implement error handling and retries
5. **Cache Results**: Cache common responses to reduce API calls
6. **Use Streaming**: Always stream responses for better UX
7. **Optimize Prompts**: Clear, specific prompts get better results

## Additional Resources

- [Groq Documentation](https://console.groq.com/docs)
- [Groq Models List](https://console.groq.com/docs/models)
- [Groq Pricing](https://groq.com/pricing)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)

## Support

For issues or questions:
- Check Groq status: [status.groq.com](https://status.groq.com)
- Groq Discord: [discord.gg/groq](https://discord.gg/groq)
- GitHub Issues: Report builder-specific issues
