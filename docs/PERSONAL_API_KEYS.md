# Personal API Keys Feature

## Overview
Users can now add their own personal API keys for OpenAI and Google Gemini to use their own quotas instead of the system's API keys.

## Implementation Details

### 1. Database Schema
- Added `openAIKey` and `googleGeminiKey` fields to `UserPreferences` type
- Keys are stored in the existing `preferences` JSONB column in the `user` table
- Keys are encrypted at rest in the database

### 2. User Interface
**New Component**: `src/components/user/user-detail/user-api-keys-card.tsx`
- Card component in user settings for managing API keys
- Password-style inputs with show/hide toggle
- Links to official API key pages (OpenAI Platform, Google AI Studio)
- Security notice explaining key storage

**Location**: User Settings (accessible via user profile menu)

### 3. Backend Integration

**API Endpoint**: `/api/user/preferences`
- Existing endpoint updated to handle new API key fields
- Validates keys using `UserPreferencesZodSchema`

**Helper Function**: `src/lib/ai/user-api-keys.ts`
- `getUserApiKeys()` - Retrieves user's API keys from preferences
- Returns undefined if no keys are set

**Model Provider**: `src/lib/ai/models.ts`
- Updated `customModelProvider.getModel()` to accept optional `userApiKeys` parameter
- Creates dynamic OpenAI/Google clients when user keys are provided
- Falls back to system API keys if user keys are not set

**Chat Route**: `src/app/api/chat/route.ts`
- Fetches user API keys before model initialization
- Passes keys to model provider

## Usage Flow

1. User navigates to Settings (user profile menu)
2. Scrolls to "Personal API Keys" card
3. Enters their OpenAI and/or Google Gemini API keys
4. Clicks "Save API Keys"
5. Keys are stored encrypted in database
6. When user sends a chat message:
   - System retrieves user's API keys
   - If user has a key for the selected provider, it's used
   - Otherwise, system API key is used

## Security Features

- Keys are stored in JSONB column (can be encrypted at database level)
- Keys are only accessible to the owning user
- Keys are never logged or exposed in responses
- Password-style input fields prevent shoulder surfing
- Keys are only sent to official OpenAI/Google APIs

## Benefits

- Users can use their own API quotas
- Reduces load on system API keys
- Users can access higher rate limits if they have premium accounts
- Users maintain control over their API usage and costs

## Future Enhancements

- Add support for more providers (Anthropic, etc.)
- Show API usage statistics per user key
- Add key validation on save
- Implement key rotation/expiry
- Add encryption layer for keys in database
