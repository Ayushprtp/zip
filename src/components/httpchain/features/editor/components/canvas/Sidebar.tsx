import { useState } from "react";
import {
  Edit2,
  Check,
  X,
  Loader2,
  Plus,
  Clock,
  Workflow,
  ChevronLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/httpchain/components/ui/button";
import { Input } from "@/components/httpchain/components/ui/input";
import { Badge } from "@/components/httpchain/components/ui/badge";
import { ScrollArea } from "@/components/httpchain/components/ui/scroll-area";
import { Separator } from "@/components/httpchain/components/ui/separator";
import { useAppStore } from "@/components/httpchain/store";
import { NodeList } from "./NodeList";

interface SidebarProps {
  onBack: () => void;
}

export function Sidebar({ onBack }: SidebarProps) {
  const workflow = useAppStore((s) => s.workflow);
  const chainUpdatedAt = useAppStore((s) => s.chainUpdatedAt);
  const chainTags = useAppStore((s) => s.chainTags);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateChainName = useAppStore((s) => s.updateChainName);
  const updateChainTags = useAppStore((s) => s.updateChainTags);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  const handleStartEdit = () => {
    setEditName(workflow?.name || "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim() || editName === workflow?.name) {
      setIsEditing(false);
      return;
    }
    await updateChainName(editName.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName("");
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !chainTags) return;
    if (chainTags.includes(newTag.trim())) return;

    const updatedTags = [...chainTags, newTag.trim()];
    await updateChainTags(updatedTags);
    setNewTag("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!chainTags) return;
    const updatedTags = chainTags.filter((tag) => tag !== tagToRemove);
    await updateChainTags(updatedTags);
  };

  if (!workflow) {
    return (
      <div className="h-full w-full bg-card flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card border-r border-sidebar-border flex flex-col">
      {/* Header Section */}
      <div className="p-4 space-y-4">
        {/* Back Button & Name */}
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") handleCancel();
                  }}
                  className="h-8 text-sm font-semibold"
                  autoFocus
                  disabled={isSaving}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-lg font-semibold truncate tracking-tight">
                  {workflow.name}
                </h2>
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={handleStartEdit}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {chainTags &&
            chainTags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs px-2 py-0.5 hover:bg-destructive hover:text-destructive-foreground cursor-pointer transition-colors"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag}
                <X className="h-3 w-3 ml-1 opacity-60" />
              </Badge>
            ))}

          {isAddingTag ? (
            <div className="flex gap-1.5 items-center">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Tag name..."
                className="h-6 w-24 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTag.trim()) handleAddTag();
                  if (e.key === "Escape") {
                    setIsAddingTag(false);
                    setNewTag("");
                  }
                }}
                onBlur={() => {
                  if (!newTag.trim()) setIsAddingTag(false);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleAddTag}
                disabled={isSaving || !newTag.trim()}
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs border-dashed"
              onClick={() => setIsAddingTag(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Tag
            </Button>
          )}
        </div>

        {/* Meta info */}
        {chainUpdatedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Edited{" "}
              {formatDistanceToNow(new Date(chainUpdatedAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* Structure Section Header */}
      <div className="px-4 py-3 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Workflow className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Structure</h3>
            <p className="text-[11px] text-muted-foreground">
              {(workflow?.steps.length || 0) +
                (workflow?.chain_variables.length || 0)}{" "}
              nodes
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-4">
          <NodeList />
        </div>
      </ScrollArea>
    </div>
  );
}
