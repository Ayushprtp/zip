# Builder Authentication Error Fix

## Issue
The builder threads sidebar was trying to load threads before authentication was complete, causing:
- Console error: "Failed to load threads"
- API returning 307 redirect to `/sign-in`
- Unnecessary error messages for unauthenticated users

## Root Cause
1. The sidebar component was calling `/api/builder/threads` regardless of authentication status
2. The store's `loadThreads()` function treated redirects as errors
3. No check for user authentication before attempting to load threads

## Solution Applied

### 1. Updated Builder Store (`src/stores/builder-store.ts`)
Added graceful handling for authentication errors:

```typescript
loadThreads: async () => {
  try {
    const response = await fetch("/api/builder/threads");
    
    // If redirected to sign-in, user is not authenticated - silently fail
    if (response.redirected || response.status === 307 || response.status === 401) {
      set({ threads: [] });
      return;
    }
    
    if (!response.ok) throw new Error("Failed to load threads");
    const data = await response.json();
    set({ threads: data.threads || [] });
  } catch (error) {
    console.error("Error loading threads:", error);
    set({ threads: [] });
  }
}
```

### 2. Updated Sidebar Component (`src/components/layouts/app-sidebar-builder-threads.tsx`)
- Added `user` prop to check authentication status
- Only loads threads if user is authenticated
- Returns `null` if user is not authenticated (component doesn't render)

```typescript
export function AppSidebarBuilderThreads({ user }: { user?: { id: string } }) {
  // Load threads only if user is authenticated
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    // ... load threads
  }, [loadThreads, user?.id]);

  // Don't show if user is not authenticated
  if (!user?.id) {
    return null;
  }
  // ... rest of component
}
```

### 3. Updated App Sidebar (`src/components/layouts/app-sidebar.tsx`)
Passed the `user` prop to the builder threads component:

```typescript
<AppSidebarBuilderThreads user={user} />
```

## Benefits

1. **No More Errors**: Unauthenticated users won't see "Failed to load threads" errors
2. **Better UX**: Builder threads section only shows for authenticated users
3. **Cleaner Console**: No unnecessary API calls or error logs
4. **Graceful Degradation**: System handles authentication failures smoothly

## Testing

The fix ensures:
- ✅ Authenticated users see their builder threads
- ✅ Unauthenticated users don't see the builder section
- ✅ No console errors for unauthenticated users
- ✅ API redirects are handled gracefully
- ✅ Empty thread lists are handled properly

## Status
✅ **FIXED** - Builder threads sidebar now properly handles authentication
