# AI Builder Auto-Save System

## Overview

The AI Builder now includes a comprehensive auto-save system that automatically persists file changes to the database in the background. This ensures that all work is preserved without requiring manual saves.

## Architecture

### Components

1. **useAutoSave Hook** (`use-auto-save.ts`)
   - Monitors file changes in the BuilderStore
   - Debounces save operations (default: 1000ms)
   - Handles background API calls to persist files
   - Provides save status indicators

2. **useProjectSync Hook** (`use-project-sync.ts`)
   - Bridges ProjectContext and BuilderStore
   - Integrates auto-save with the project state
   - Provides manual save trigger
   - Reports connection status

3. **BuilderThreadPage Integration**
   - Displays real-time save status
   - Shows visual indicators (Saving, Pending, Saved)
   - Forces save before export/deploy operations

4. **SandpackWrapper Integration**
   - Syncs Sandpack file changes to ProjectContext
   - Automatically triggers auto-save pipeline
   - No manual intervention required

## Features

### Automatic Background Saving

- **Debounced Saves**: Changes are batched and saved after 1 second of inactivity
- **Parallel Saves**: Multiple files can be saved simultaneously
- **Error Handling**: Failed saves are logged and can be retried
- **Unmount Protection**: Pending changes are saved when component unmounts

### Save Status Indicators

The UI displays the current save state:

- 🔵 **Saving...** - Files are currently being saved to the database
- 🟡 **Pending...** - Changes detected, waiting for debounce period
- 🟢 **Saved** - All changes successfully persisted
- ⚫ **Offline** - No active thread connection

### Manual Save Trigger

For critical operations (export, deploy), you can force immediate save:

```typescript
const { saveNow } = useProjectSync();

// Force save all pending changes
await saveNow();
```

## Usage

### In BuilderThreadPage

The auto-save system is automatically enabled when a thread is loaded:

```typescript
const { isSaving, hasPendingSaves, saveNow, isConnected } = useProjectSync({
  autoSaveEnabled: true,
  debounceMs: 1000,
});
```

### Status Display

```tsx
<AutoSaveStatus
  isSaving={isSaving}
  hasPendingSaves={hasPendingSaves}
  isConnected={isConnected}
/>
```

### Before Critical Operations

```typescript
const handleExport = async () => {
  // Ensure all changes are saved first
  await saveNow();
  
  // Proceed with export
  await exportService.exportZip(files, template);
};
```

## Configuration

### Debounce Timing

Adjust the debounce delay (in milliseconds):

```typescript
useProjectSync({
  debounceMs: 2000, // Wait 2 seconds before saving
});
```

### Enable/Disable Auto-Save

```typescript
useProjectSync({
  autoSaveEnabled: false, // Disable auto-save
});
```

### Save Callbacks

```typescript
useAutoSave({
  onSaveStart: () => console.log('Save started'),
  onSaveSuccess: (filePath) => console.log(`Saved: ${filePath}`),
  onSaveError: (filePath, error) => console.error(`Failed: ${filePath}`, error),
});
```

## API Integration

### Save Endpoint

Files are saved via the Builder API:

```
POST /api/builder/threads/[threadId]/files
```

**Request Body:**
```json
{
  "filePath": "/App.jsx",
  "fileContent": "export default function App() { ... }"
}
```

**Response:**
```json
{
  "file": {
    "id": "...",
    "threadId": "...",
    "filePath": "/App.jsx",
    "fileContent": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Upsert Behavior

The API uses upsert logic:
- If file exists: Updates content and timestamp
- If file is new: Creates new file record
- Thread's `updatedAt` is automatically updated

## Data Flow

```
User edits in Sandpack
    ↓
FileChangeListener detects change
    ↓
Updates ProjectContext state
    ↓
useProjectSync syncs to BuilderStore
    ↓
useAutoSave detects change
    ↓
Debounces for 1 second
    ↓
POST to /api/builder/threads/[threadId]/files
    ↓
Database updated
    ↓
UI shows "Saved" status
```

## Performance Considerations

### Debouncing

- Prevents excessive API calls during rapid typing
- Default 1000ms balances responsiveness and efficiency
- Adjustable based on network conditions

### Parallel Saves

- Multiple files can save simultaneously
- Each file has independent debounce timer
- No blocking between different files

### Unmount Safety

- Uses `keepalive: true` for fetch requests
- Ensures saves complete even after navigation
- Prevents data loss on page transitions

## Error Handling

### Network Failures

- Errors are logged to console
- Optional error callbacks for custom handling
- Failed saves remain in pending state
- Can be retried with `forceSaveAll()`

### Authentication Issues

- 401 responses indicate session expired
- User should be redirected to login
- Pending changes preserved in local state

## Testing

### Manual Testing

1. Open a builder thread
2. Edit a file in the code editor
3. Observe status indicator change: Pending → Saving → Saved
4. Refresh page and verify changes persisted
5. Edit multiple files rapidly
6. Verify all changes saved correctly

### Verification

Check database directly:

```sql
SELECT * FROM builder_files 
WHERE thread_id = 'your-thread-id' 
ORDER BY updated_at DESC;
```

## Troubleshooting

### Changes Not Saving

1. Check browser console for errors
2. Verify thread ID is valid
3. Confirm user is authenticated
4. Check network tab for failed requests

### Slow Saves

1. Reduce debounce time for faster saves
2. Check network latency
3. Verify database performance

### Lost Changes

1. Check if auto-save is enabled
2. Verify no JavaScript errors
3. Ensure proper unmount handling
4. Check browser console logs

## Future Enhancements

- [ ] Offline support with local storage
- [ ] Conflict resolution for concurrent edits
- [ ] Save history/versioning
- [ ] Optimistic UI updates
- [ ] Retry logic for failed saves
- [ ] Bandwidth optimization (delta saves)
- [ ] Real-time collaboration support

## Related Files

- `src/lib/builder/use-auto-save.ts` - Core auto-save logic
- `src/lib/builder/use-project-sync.ts` - ProjectContext integration
- `src/components/builder/BuilderThreadPage.tsx` - UI integration
- `src/components/builder/SandpackWrapper.tsx` - File change detection
- `src/app/api/builder/threads/[threadId]/files/route.ts` - Save API endpoint
- `src/stores/builder-store.ts` - State management
- `src/lib/builder/project-context.tsx` - Project state context
