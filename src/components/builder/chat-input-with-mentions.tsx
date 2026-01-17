"use client";

import React, { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, File, Terminal, BookOpen } from "lucide-react";
import { FilePickerDialog } from "./file-picker-dialog";

interface ChatInputWithMentionsProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  files: Record<string, string>;
  onFilesMention: (files: string[]) => void;
  onTerminalMention: () => void;
  onDocsMention: (query: string) => void;
}

export function ChatInputWithMentions({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled = false,
  files,
  onFilesMention,
  onTerminalMention,
  onDocsMention,
}: ChatInputWithMentionsProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [_autocompletePosition, _setAutocompletePosition] = useState({
    x: 0,
    y: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionOptions = [
    { label: "@Files", icon: File, description: "Reference project files" },
    {
      label: "@Terminal",
      icon: Terminal,
      description: "Include console output",
    },
    { label: "@Docs", icon: BookOpen, description: "Search documentation" },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check if user typed @ to trigger autocomplete
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1 && cursorPosition - lastAtSymbol <= 10) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
      if (!textAfterAt.includes(" ")) {
        setShowAutocomplete(true);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const insertMention = (mention: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const newValue =
        textBeforeCursor.slice(0, lastAtSymbol) +
        mention +
        " " +
        textAfterCursor;
      onChange(newValue);
    }

    setShowAutocomplete(false);

    // Handle mention-specific actions
    if (mention === "@Files") {
      setShowFilePicker(true);
    } else if (mention === "@Terminal") {
      onTerminalMention();
    } else if (mention === "@Docs") {
      // Could open a docs search dialog
      const query = prompt("Enter library name:");
      if (query) {
        onDocsMention(query);
      }
    }
  };

  const handleFilesSelected = (selectedFiles: string[]) => {
    onFilesMention(selectedFiles);
    setShowFilePicker(false);
  };

  return (
    <>
      <div className="border-t p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              placeholder="Type a message... Use @ for mentions (Shift+Enter for new line)"
              className="min-h-[60px] max-h-[200px] resize-none"
              disabled={disabled}
              data-testid="chat-input-with-mentions"
            />

            {showAutocomplete && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border rounded-lg shadow-lg z-50">
                <div className="p-2 space-y-1">
                  {mentionOptions.map((option) => (
                    <button
                      key={option.label}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                      onClick={() => insertMention(option.label)}
                    >
                      <option.icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-sm">
                          {option.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            size="icon"
            data-testid="send-button"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <FilePickerDialog
        open={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        files={files}
        onSelect={handleFilesSelected}
      />
    </>
  );
}
