# Error Detection System

This document describes the self-healing error detection system implemented for the AI Builder IDE.

## Overview

The error detection system consists of three main components:

1. **ErrorDetector** - Monitors Sandpack console for errors and classifies them
2. **ErrorOverlay** - Displays errors to users with a "Fix Error" button
3. **AutoFixService** - Generates and applies automatic fixes using AI

## Architecture

```
Sandpack Runtime Error
        ↓
ErrorDetector.processError()
        ↓
ErrorOverlay (displays error)
        ↓
User clicks "Fix Error"
        ↓
AutoFixService.generateFix()
        ↓
AI generates fix
        ↓
Apply fixed files
        ↓
Restart preview
```

## Components

### ErrorDetector

Monitors Sandpack console for fatal errors and classifies them by severity and category.

**Features:**
- Error listener registration system
- Error classification (syntax, reference, type, import, runtime)
- Auto-fixable detection
- Stack trace parsing
- File location extraction

**Usage:**
```typescript
import { getErrorDetector } from '@/lib/builder/error-detector';

const errorDetector = getErrorDetector();

// Listen for errors
const unsubscribe = errorDetector.addErrorListener((error) => {
  console.log('Error detected:', error);
  console.log('Is auto-fixable:', errorDetector.isAutoFixable(error));
  console.log('Category:', errorDetector.getErrorCategory(error));
});

// Process an error
errorDetector.processError({
  type: 'fatal',
  message: 'ReferenceError: foo is not defined',
  stack: 'at /src/app.ts:10:5',
  file: '/src/app.ts',
  line: 10,
  column: 5,
});

// Clean up
unsubscribe();
```

### ErrorOverlay

React component that displays errors over the preview window.

**Features:**
- Displays error message and stack trace
- Shows file location
- "Fix Error" button for auto-fixable errors
- Dismissible overlay
- Automatic error detection integration

**Usage:**
```typescript
import { ErrorOverlay } from '@/components/builder/error-overlay';

function PreviewPanel() {
  const handleFixError = async (error: RuntimeError) => {
    // Generate and apply fix
    const result = await autoFixService.generateFix({
      error,
      files: currentFiles,
      aiService,
    });
    
    if (result.success) {
      // Apply fixed files
      updateFiles(result.fixedFiles);
    }
  };

  return (
    <div className="relative">
      <SandpackPreview />
      <ErrorOverlay 
        onFixError={handleFixError}
        onDismiss={() => console.log('Error dismissed')}
      />
    </div>
  );
}
```

### AutoFixService

Generates automatic fixes for errors using AI.

**Features:**
- Builds error context with relevant code
- Sends fix requests to AI
- Parses fixed files from AI response
- Finds related files (imports)
- Prevents concurrent fix attempts

**Usage:**
```typescript
import { createAutoFixService } from '@/lib/builder/auto-fix-service';
import { AIService } from '@/lib/builder/ai-service';

const aiService = new AIService({
  apiKey: process.env.AI_API_KEY,
  model: 'claude',
});

const autoFixService = createAutoFixService(aiService);

// Generate a fix
const result = await autoFixService.generateFix({
  error: {
    type: 'fatal',
    message: 'ReferenceError: foo is not defined',
    file: '/src/app.ts',
    line: 10,
  },
  files: {
    '/src/app.ts': 'const x = foo;',
  },
  aiService,
  onFixGenerated: (fixedFiles) => {
    console.log('Fix generated:', fixedFiles);
  },
  onFixApplied: () => {
    console.log('Fix applied successfully');
  },
  onError: (error) => {
    console.error('Fix generation failed:', error);
  },
});

if (result.success) {
  // Apply the fixed files
  updateFiles(result.fixedFiles);
  
  // Restart preview
  await serverControl.restart();
}
```

## Integration with SandpackWrapper

The SandpackWrapper component automatically integrates error detection:

```typescript
<SandpackWrapper
  template="vite-react"
  files={files}
  onError={(error) => {
    console.log('Error occurred:', error);
  }}
  onFixError={async (error) => {
    // Handle fix request
    const result = await autoFixService.generateFix({
      error,
      files,
      aiService,
    });
    
    if (result.success) {
      updateFiles(result.fixedFiles);
    }
  }}
  showErrorOverlay={true}
/>
```

## Error Classification

The system classifies errors into the following categories:

### Syntax Errors
- **Auto-fixable:** Yes
- **Examples:** 
  - `SyntaxError: Unexpected token`
  - `SyntaxError: Unexpected identifier`

### Reference Errors
- **Auto-fixable:** Yes
- **Examples:**
  - `ReferenceError: foo is not defined`
  - `ReferenceError: Cannot access 'x' before initialization`

### Type Errors
- **Auto-fixable:** Yes
- **Examples:**
  - `TypeError: foo is not a function`
  - `TypeError: Cannot read property 'x' of undefined`

### Import Errors
- **Auto-fixable:** Yes
- **Examples:**
  - `Error: Cannot find module './missing'`
  - `Error: Failed to resolve import`

### Runtime Errors
- **Auto-fixable:** No (requires manual intervention)
- **Examples:**
  - Network errors
  - Logic errors
  - Infinite loops

### Warnings
- **Auto-fixable:** No
- **Examples:**
  - Deprecated API usage
  - Performance warnings

## Testing

The error detection system includes comprehensive tests:

```bash
# Run integration tests
npm test -- src/lib/builder/error-detection-integration.test.ts --run

# Run all builder tests
npm test -- src/lib/builder --run
```

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 8.1:** Error detection captures fatal errors from Sandpack console
- **Requirement 8.2:** ErrorOverlay displays errors with "Fix Error" button
- **Requirement 8.3:** AutoFixService sends error context to AI for fix generation
- **Requirement 8.5:** System applies fixes and restarts preview

## Future Enhancements

Potential improvements for the error detection system:

1. **Error History:** Track all errors in a session for debugging
2. **Fix Success Rate:** Track which types of errors are successfully fixed
3. **User Feedback:** Allow users to rate fix quality
4. **Learning:** Improve fix generation based on successful fixes
5. **Batch Fixes:** Fix multiple related errors at once
6. **Error Prevention:** Suggest fixes before errors occur (linting)
