# Requirements Document

## Introduction

The AI Builder IDE is a browser-based, AI-native Integrated Development Environment that enables users to prompt AI models (Claude/Gemini) to generate full-stack web applications, preview them live in real-time, and deploy them to production. The system leverages Sandpack/Nodebox for in-browser Node.js runtime simulation, providing a complete development environment without requiring local setup.

## Glossary

- **Sandpack**: The core runtime engine (@codesandbox/sandpack-react) that provides WebContainer/Nodebox capabilities
- **WebContainer**: Browser-based Node.js runtime that simulates a full development server
- **Builder_Mode**: Split-pane interface showing chat, code editor, and live preview simultaneously
- **Chat_Mode**: Full-screen chat interface with code hidden, focused on AI conversation
- **Checkpoint**: A snapshot of the entire file system state at a specific point in time
- **Timeline**: Visual history of all checkpoints with timestamps
- **Context_Mention**: Special @ symbols in chat that reference specific resources (@Files, @Terminal, @Docs)
- **Self_Healing**: Automatic error detection and AI-powered fix generation
- **Monaco_Editor**: The code editor component used for file editing
- **Preview_Iframe**: The embedded browser window showing the live application

## Requirements

### Requirement 1: Dynamic Framework Support

**User Story:** As a developer, I want to create projects using different frameworks and templates, so that I can build the right type of application for my needs.

#### Acceptance Criteria

1. WHEN a user selects React (Vite) template, THE Sandpack_Wrapper SHALL initialize with template="vite-react" and provide fast HMR
2. WHEN a user selects Next.js template, THE Sandpack_Wrapper SHALL initialize with template="nextjs" and support App Router structure with /app/page.tsx and /app/layout.tsx
3. WHEN a user selects Node.js template, THE Sandpack_Wrapper SHALL initialize with template="node" for backend scripts
4. WHEN a user selects Static template, THE Sandpack_Wrapper SHALL initialize with template="static" for pure HTML/CSS projects
5. THE Sandpack_Wrapper SHALL accept a template prop that determines the framework configuration

### Requirement 2: Server Process Control

**User Story:** As a developer, I want manual control over the development server, so that I can manage server state and recover from stuck processes.

#### Acceptance Criteria

1. WHEN a user clicks the Start button, THE System SHALL boot the WebContainer and update the status indicator to yellow then green
2. WHEN a user clicks the Stop button, THE System SHALL terminate the running process and update the status indicator to red
3. WHEN a user clicks the Restart button, THE System SHALL kill the current process and reinitialize the WebContainer
4. THE UI_Header SHALL display a status indicator that shows green for running, yellow for booting, and red for stopped
5. WHEN the WebContainer state changes, THE System SHALL update the status indicator within 500ms

### Requirement 3: Project History and Checkpoints

**User Story:** As a developer, I want to track changes to my project over time, so that I can review progress and revert to previous states if needed.

#### Acceptance Criteria

1. WHEN the AI completes writing a batch of files, THE System SHALL create a checkpoint by pushing a snapshot of the files object to the historyStack
2. THE Timeline_Sidebar SHALL display all checkpoints with timestamps in chronological order
3. WHEN a user clicks a checkpoint timestamp, THE System SHALL restore the files object to that snapshot state
4. THE System SHALL maintain the complete historyStack in React state throughout the session
5. WHEN a checkpoint is created, THE Timeline SHALL update to show the new entry with a descriptive label

### Requirement 4: Rollback with Visual Diff

**User Story:** As a developer, I want to see what changed between versions before rolling back, so that I can make informed decisions about reverting changes.

#### Acceptance Criteria

1. WHEN a user selects a previous checkpoint, THE System SHALL display a side-by-side comparison of current files versus checkpoint files
2. THE Diff_View SHALL highlight additions in green and deletions in red
3. WHEN a user confirms the rollback, THE System SHALL restore all files to the selected checkpoint state
4. WHEN a user cancels the rollback, THE System SHALL maintain the current file state
5. THE Diff_View SHALL show file-by-file comparisons for all modified files

### Requirement 5: Context-Aware File Mentions

**User Story:** As a developer, I want to reference specific files in my chat with the AI, so that the AI has full context about the code I'm discussing.

#### Acceptance Criteria

1. WHEN a user types @Files in the chat input, THE System SHALL open a file picker dialog
2. WHEN a user selects files from the picker, THE System SHALL read the full content of each selected file
3. WHEN the chat message is sent, THE System SHALL include the complete file contents in the AI context
4. THE File_Picker SHALL display all files in the current project with their paths
5. THE System SHALL support selecting multiple files in a single @Files mention

### Requirement 6: Context-Aware Terminal Mentions

**User Story:** As a developer, I want to share console errors with the AI, so that it can help me debug issues.

#### Acceptance Criteria

1. WHEN a user types @Terminal in the chat input, THE System SHALL capture the last 50 lines from the Sandpack console
2. WHEN the chat message is sent, THE System SHALL include the captured console logs in the AI context
3. THE System SHALL preserve ANSI color codes and formatting from the terminal output
4. WHEN no console output exists, THE System SHALL inform the user that the terminal is empty
5. THE Terminal_Capture SHALL include both stdout and stderr streams

### Requirement 7: Context-Aware Documentation Mentions

**User Story:** As a developer, I want to reference official documentation in my chat, so that the AI provides answers based on authoritative sources.

#### Acceptance Criteria

1. WHEN a user types @Docs in the chat input, THE System SHALL trigger a documentation search interface
2. WHEN a user specifies a library name, THE System SHALL fetch relevant documentation sections
3. WHEN the chat message is sent, THE System SHALL include the documentation content in the AI context
4. THE System SHALL support documentation for Tailwind, React, Next.js, and other common libraries
5. WHEN documentation cannot be found, THE System SHALL notify the user and proceed without it

### Requirement 8: Automatic Error Detection and Self-Healing

**User Story:** As a developer, I want the system to detect crashes and offer automatic fixes, so that I can quickly recover from errors.

#### Acceptance Criteria

1. WHEN a fatal error occurs in the Sandpack console, THE System SHALL capture the error message and stack trace
2. WHEN an error is detected, THE System SHALL display a "Fix Error" button over the preview window
3. WHEN a user clicks "Fix Error", THE System SHALL send the error message and relevant code to the AI with a fix request
4. THE System SHALL monitor the SandpackConsole for red/fatal errors continuously
5. WHEN the AI provides a fix, THE System SHALL apply the code changes and restart the preview

### Requirement 9: Missing Asset Generation

**User Story:** As a developer, I want placeholder images to be automatically generated when missing, so that my preview doesn't break due to missing assets.

#### Acceptance Criteria

1. WHEN a file reference is missing in the preview, THE System SHALL detect the 404 error
2. WHEN an image file is missing, THE System SHALL trigger a lightweight AI model to generate a placeholder SVG
3. THE System SHALL write the generated asset to the virtual file system
4. THE Preview_Iframe SHALL automatically reload to display the new asset
5. THE Generated_Asset SHALL match the dimensions and context suggested by the code

### Requirement 10: Layout Mode Switching

**User Story:** As a developer, I want to switch between chat-focused and code-focused layouts, so that I can optimize my workspace for different tasks.

#### Acceptance Criteria

1. WHEN a user clicks the mode toggle in the header, THE System SHALL switch between Chat_Mode and Builder_Mode
2. WHEN in Chat_Mode, THE System SHALL display a large chat interface with code hidden
3. WHEN in Builder_Mode, THE System SHALL display a three-pane layout with condensed chat, Monaco_Editor, and Preview_Iframe
4. THE System SHALL preserve the current project state when switching modes
5. THE Mode_Toggle SHALL indicate the current active mode visually

### Requirement 11: Smart Library Configuration

**User Story:** As a developer, I want to preset my preferred UI library, so that the AI automatically uses it without me specifying it each time.

#### Acceptance Criteria

1. WHEN a user opens the settings dropdown, THE System SHALL display UI library options including Shadcn UI, DaisyUI, Material UI, and Pure Tailwind
2. WHEN a user selects a library preference, THE System SHALL update the AI system prompt to include that preference
3. WHEN Shadcn UI is selected and the AI generates components, THE System SHALL automatically install radix-ui dependencies
4. WHEN Shadcn UI is selected, THE System SHALL create a components/ui directory structure without explicit user request
5. THE Library_Preference SHALL persist across sessions in browser storage

### Requirement 12: Mobile Device Preview

**User Story:** As a developer, I want to test my application on my physical mobile device, so that I can verify responsive behavior and touch interactions.

#### Acceptance Criteria

1. WHEN a user clicks the "Test on Device" button, THE System SHALL generate a QR code
2. THE QR_Code SHALL encode the Sandpack bundler URL for the current preview
3. WHEN a user scans the QR code with a mobile device, THE Device SHALL open the live preview in a browser
4. THE Mobile_Preview SHALL reflect real-time changes as the user edits code
5. THE QR_Code_Dialog SHALL remain visible until the user dismisses it

### Requirement 13: Source Code Export

**User Story:** As a developer, I want to download my project as a zip file, so that I can run it locally or share it with others.

#### Acceptance Criteria

1. WHEN a user clicks "Export Zip", THE System SHALL bundle all virtual files using jszip
2. THE System SHALL auto-generate a README.md file with installation and run instructions
3. THE Zip_File SHALL include package.json with all dependencies
4. THE Zip_File SHALL include all source files with correct directory structure
5. WHEN the zip is created, THE System SHALL trigger a browser download

### Requirement 14: One-Click Deployment

**User Story:** As a developer, I want to deploy my application to a live URL with one click, so that I can share it with users immediately.

#### Acceptance Criteria

1. WHEN a user clicks "Deploy Live", THE System SHALL export the files object to JSON
2. THE System SHALL POST the project data to a serverless deployment function
3. THE Deployment_Function SHALL trigger a deployment via Netlify or Vercel API
4. WHEN deployment completes, THE System SHALL display the live URL to the user
5. THE System SHALL show deployment progress with status updates

### Requirement 15: Code Editor Integration

**User Story:** As a developer, I want to edit code directly in a professional editor, so that I have syntax highlighting, autocomplete, and other IDE features.

#### Acceptance Criteria

1. THE Builder_Mode SHALL display Monaco_Editor for code editing
2. THE Monaco_Editor SHALL provide syntax highlighting for JavaScript, TypeScript, CSS, HTML, and JSON
3. WHEN a user edits a file, THE Preview_Iframe SHALL update within 2 seconds via HMR
4. THE Monaco_Editor SHALL support multi-file editing with tabs
5. THE Monaco_Editor SHALL provide IntelliSense autocomplete for imported libraries

### Requirement 16: Live Preview Synchronization

**User Story:** As a developer, I want to see my changes reflected immediately in the preview, so that I can iterate quickly.

#### Acceptance Criteria

1. WHEN a file is modified, THE Sandpack SHALL trigger HMR to update the Preview_Iframe
2. THE Preview_Iframe SHALL preserve application state during HMR updates when possible
3. WHEN HMR fails, THE System SHALL perform a full reload of the Preview_Iframe
4. THE Preview_Iframe SHALL display loading indicators during updates
5. WHEN the preview updates, THE System SHALL maintain scroll position when appropriate

### Requirement 17: AI Chat Interface

**User Story:** As a developer, I want to have natural conversations with the AI about my project, so that I can build applications through dialogue.

#### Acceptance Criteria

1. THE Chat_Interface SHALL accept text input with support for multiline messages
2. WHEN a user sends a message, THE System SHALL display it in the chat history immediately
3. WHEN the AI responds, THE System SHALL stream the response token-by-token for real-time feedback
4. THE Chat_Interface SHALL support context mentions (@Files, @Terminal, @Docs) with autocomplete
5. THE Chat_History SHALL persist across page refreshes using browser storage

### Requirement 18: File System Management

**User Story:** As a developer, I want to create, edit, and delete files in my project, so that I can organize my code structure.

#### Acceptance Criteria

1. WHEN the AI creates a new file, THE System SHALL add it to the virtual file system and update the file tree
2. WHEN the AI modifies a file, THE System SHALL update the file content in the virtual file system
3. WHEN a user deletes a file through the UI, THE System SHALL remove it from the virtual file system
4. THE File_Tree SHALL display all files and folders in a hierarchical structure
5. THE System SHALL support nested directories up to 10 levels deep
