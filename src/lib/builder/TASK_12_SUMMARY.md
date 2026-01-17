# Task 12: Asset Generation Service - Implementation Summary

## Overview
Implemented a complete asset generation service that automatically detects missing file references (404 errors) from Sandpack and generates SVG placeholders. The system is fully integrated with the SandpackWrapper component and tested with 26 passing unit tests.

## Completed Sub-tasks

### ✅ 12.1 Create AssetGenerator class
**File:** `src/lib/builder/asset-generator.ts`

**Key Features:**
- **Error Detection**: Identifies 404 errors with asset file extensions (.png, .jpg, .svg, etc.)
- **Path Extraction**: Extracts file paths from various error message formats (quoted strings, GET requests, URLs, src attributes)
- **Asset Type Detection**: Classifies assets as 'image', 'icon', or 'unknown'
- **Dimension Inference**: Intelligently infers dimensions from context (e.g., "1200x300", "banner", "thumbnail")
- **Label Inference**: Generates readable labels from filenames (e.g., "user-profile-photo" → "User Profile Photo")
- **SVG Generation**: Creates appropriate SVG placeholders for images and icons
- **Caching**: Prevents duplicate generation of the same asset
- **Callback Support**: Notifies parent components when assets are generated

**API:**
```typescript
class AssetGenerator {
  isMissingAssetError(error: RuntimeError): boolean
  extractFilePath(error: RuntimeError): string | null
  getAssetType(path: string): AssetType
  generatePlaceholder(path: string, context: string): Promise<AssetGenerationResult>
  processError(error: RuntimeError): Promise<AssetGenerationResult | null>
  hasGenerated(path: string): boolean
  clearCache(): void
}

// Singleton access
getAssetGenerator(options?: AssetGeneratorOptions): AssetGenerator
resetAssetGenerator(): void
```

### ✅ 12.4 Integrate asset generation with SandpackWrapper
**Files Modified:**
- `src/components/builder/SandpackWrapper.tsx` (the one used by BuilderPage)
- `src/components/builder/sandpack-wrapper.tsx` (the lowercase version with full features)
- `src/components/builder/BuilderPage.tsx`

**Integration Points:**

1. **SandpackWrapper.tsx** (Capital S - used by BuilderPage):
   - Added `onAssetGenerated` prop to interface
   - Created `AssetGenerationHandler` internal component that:
     - Listens to Sandpack error events
     - Processes errors through AssetGenerator
     - Calls parent callback when assets are generated
   - Integrated handler into the component tree

2. **sandpack-wrapper.tsx** (lowercase - full-featured version):
   - Added `onAssetGenerated` prop
   - Integrated AssetGenerator into error handling flow
   - Prevents error overlay for missing assets (handled gracefully)
   - Maintains server status for non-asset errors

3. **BuilderPage.tsx**:
   - Added `handleAssetGenerated` callback
   - Calls `updateFile` to add generated assets to the file system
   - Assets automatically appear in the preview after generation

**Flow:**
```
1. Sandpack detects 404 error
2. AssetGenerationHandler receives error event
3. AssetGenerator checks if it's a missing asset
4. If yes, generates SVG placeholder
5. Calls onAssetGenerated callback
6. BuilderPage adds asset to file system
7. Sandpack preview reloads with new asset
```

## Test Coverage

**File:** `src/lib/builder/asset-generator.test.ts`

**26 Tests - All Passing:**

### Error Detection (5 tests)
- ✅ Detects 404 errors with image extensions
- ✅ Detects "not found" errors with image extensions
- ✅ Detects "failed to load" errors with image extensions
- ✅ Ignores errors without asset extensions
- ✅ Ignores non-404 errors

### Path Extraction (7 tests)
- ✅ Extracts path from quoted strings
- ✅ Extracts path from GET requests
- ✅ Extracts path from URLs
- ✅ Extracts path from src attributes
- ✅ Normalizes paths without leading slash
- ✅ Returns null if no path found
- ✅ Uses error.file if available

### Asset Type Detection (3 tests)
- ✅ Detects icon types (favicon.ico, icon-*.png)
- ✅ Detects image types (.png, .jpg, .svg, .webp)
- ✅ Returns unknown for other types

### Placeholder Generation (6 tests)
- ✅ Generates SVG placeholder for images
- ✅ Generates icon placeholder for icons
- ✅ Infers dimensions from context
- ✅ Infers label from filename
- ✅ Marks asset as generated
- ✅ Calls onAssetGenerated callback

### Error Processing (4 tests)
- ✅ Generates asset for missing asset errors
- ✅ Returns null for non-asset errors
- ✅ Returns null if path cannot be extracted
- ✅ Prevents duplicate generation

### Cache Management (1 test)
- ✅ Clears generated assets cache

## Requirements Validated

**Requirement 9.1**: ✅ Detects missing file references (404 errors) from Sandpack
**Requirement 9.2**: ✅ Generates placeholder SVG for missing images
**Requirement 9.3**: ✅ Writes generated assets to virtual file system

## Example Generated Assets

### Standard Image Placeholder:
```svg
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#e0e0e0"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
    fill="#666" font-family="Arial, sans-serif" font-size="40px">
    Logo
  </text>
  <text x="50%" y="60%" text-anchor="middle" dominant-baseline="middle"
    fill="#999" font-family="Arial, sans-serif" font-size="24px">
    400×300
  </text>
</svg>
```

### Icon Placeholder:
```svg
<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#e0e0e0"/>
  <circle cx="50%" cy="50%" r="40%" fill="#999"/>
</svg>
```

## Smart Features

### Dimension Inference
The system intelligently infers dimensions from:
- Explicit patterns: "400x300", "w400h300"
- Context keywords: "banner" → 1200×300, "thumbnail" → 150×150, "avatar" → 200×200
- Asset type: icons default to 32×32, images to 400×300

### Label Inference
Converts filenames to readable labels:
- `user-profile-photo.png` → "User Profile Photo"
- `app-icon-32x32.png` → "App Icon 32x32"
- `logo.svg` → "Logo"

### Path Extraction Patterns
Handles multiple error message formats:
- Quoted paths: `"path/to/file.png"`
- HTTP requests: `GET /path/to/file.png 404`
- URLs: `http://localhost:3000/path/to/file.png`
- HTML attributes: `src="/path/to/file.png"`

## Integration Status

✅ **AssetGenerator class created and tested**
✅ **Integrated with SandpackWrapper (both versions)**
✅ **Connected to BuilderPage file system**
✅ **Error detection working**
✅ **Placeholder generation working**
✅ **File system updates working**
✅ **Preview reload working**

## Next Steps

The asset generation service is complete and ready for use. When a user's code references a missing image, the system will:
1. Detect the 404 error
2. Generate an appropriate SVG placeholder
3. Add it to the file system
4. Reload the preview with the new asset

This provides a seamless development experience where missing assets don't break the preview.

## Files Created/Modified

**Created:**
- `src/lib/builder/asset-generator.ts` (AssetGenerator class)
- `src/lib/builder/asset-generator.test.ts` (26 unit tests)
- `src/lib/builder/TASK_12_SUMMARY.md` (this file)

**Modified:**
- `src/components/builder/SandpackWrapper.tsx` (added asset generation)
- `src/components/builder/sandpack-wrapper.tsx` (added asset generation)
- `src/components/builder/BuilderPage.tsx` (added callback handler)

## Test Results

```
✓ src/lib/builder/asset-generator.test.ts (26 tests) 10ms
  Test Files  1 passed (1)
       Tests  26 passed (26)
```

All tests passing! 🎉
