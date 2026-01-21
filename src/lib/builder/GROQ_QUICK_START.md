# Groq Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Environment Setup
```bash
# Add to .env
GROQ_API_KEY=your_groq_api_key_here
E2E_DEFAULT_MODEL=groq/llama-3.3-70b-versatile
```

### 2. Import and Use
```typescript
import { createBuilderAIService } from '@/lib/builder/ai-service-factory';

const aiService = createBuilderAIService();
```

### 3. Generate Code
```typescript
await aiService.generateCode({
  prompt: 'Create a React component',
  context: [],
  onToken: (token) => console.log(token),
});
```

## 📊 Model Quick Reference

| Model | Speed | Use When |
|-------|-------|----------|
| `llama-3.3-70b-versatile` | 280 t/s | **Default** - General purpose |
| `llama-4-scout` | 750 t/s | Code generation |
| `llama-4-maverick` | 600 t/s | Chat/creative |
| `llama-3.1-8b-instant` | 560 t/s | Fast responses |

## 🎯 Common Use Cases

### Default (Balanced)
```typescript
const service = createBuilderAIService();
```

### Code Generation (Fastest)
```typescript
const service = createCodeGenerationService();
```

### Chat/Assistant
```typescript
const service = createChatService();
```

### Quick Responses
```typescript
const service = createFastResponseService();
```

### Custom Model
```typescript
const service = createCustomAIService('groq', 'qwen3-32b');
```

## 💡 Pro Tips

1. **Use streaming** for better UX
2. **Choose the right model** for your task
3. **Monitor token usage** in Groq console
4. **Implement error handling** with retries
5. **Cache common responses** to save costs

## 🔗 Quick Links

- [Get API Key](https://console.groq.com)
- [Full Guide](./GROQ_INTEGRATION_GUIDE.md)
- [Examples](./groq-example.tsx)
- [Groq Docs](https://console.groq.com/docs/models)

## ⚠️ Important

**Regenerate your API keys** if you shared them publicly!
- Groq: https://console.groq.com
- Google AI: https://aistudio.google.com/app/apikey
