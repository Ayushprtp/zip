import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  Search,
  Trash2,
  Filter,
  X,
  Clock,
  Link,
  Download,
  Upload,
  ArrowUpDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Badge } from "../../../components/ui/badge";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CreateChainDialog } from "../dialogs/CreateChainDialog";
import { DeleteChainDialog } from "../dialogs/DeleteChainDialog";
import { DeleteAllChainsDialog } from "../dialogs/DeleteAllChainsDialog";
import { useAppStore } from "../../../store";
import { exportAllChains, importChains } from "../../../services/storage";
import { toast } from "../../../lib/toast";

type SortKey = "id" | "name" | "created_at" | "updated_at";
type SortDir = "asc" | "desc";

export function ChainList() {
  const chains = useAppStore((s) => s.chains);
  const chainsLoaded = useAppStore((s) => s.chainsLoaded);
  const loadChains = useAppStore((s) => s.loadChains);
  const createChainAction = useAppStore((s) => s.createChain);
  const deleteChainAction = useAppStore((s) => s.deleteChain);
  const deleteAllChainsAction = useAppStore((s) => s.deleteAllChains);
  const setSelectedChainId = useAppStore((s) => s.setSelectedChainId);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chains on mount
  useEffect(() => {
    if (!chainsLoaded) {
      loadChains();
    }
  }, [chainsLoaded, loadChains]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    const created = await createChainAction(name.trim());
    setIsCreating(false);
    if (created) {
      setSelectedChainId(created.id);
      setShowCreate(false);
      setName("");
    }
  };

  const handleSelect = (id: string) => {
    setSelectedChainId(id);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    await deleteChainAction(id);
    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    await deleteAllChainsAction();
    setIsDeletingAll(false);
    setShowDeleteAll(false);
  };

  const handleExport = () => {
    const json = exportAllChains();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `httpchain-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Export complete", "All chains exported successfully");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importChains(text);
      await loadChains();
      toast.success("Import complete", `${result.imported} chains imported`);
    } catch (_err) {
      toast.error("Import failed", "Invalid backup file");
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const allTags = useMemo(() => {
    if (!chains) return [];
    const tagSet = new Set<string>();
    chains.forEach((chain) => {
      chain.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [chains]);

  const filteredSorted = useMemo(() => {
    if (!chains) return [];
    const filtered = chains.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!String(c.id).includes(q) && !c.name.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (selectedTags.length > 0) {
        if (!c.tags || c.tags.length === 0) return false;
        const hasSelectedTag = selectedTags.some((tag) => c.tags.includes(tag));
        if (!hasSelectedTag) return false;
      }

      return true;
    });
    return filtered.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      return av < bv ? -mult : av > bv ? mult : 0;
    });
  }, [chains, search, sortKey, sortDir, selectedTags]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const clearTagFilters = () => {
    setSelectedTags([]);
  };

  if (!chainsLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Loading chains</p>
            <p className="text-xs text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-8 py-6 border-b">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Chains</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your workflow chains
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Chain
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="text-center space-y-4 max-w-md">
              <div className="flex justify-center">
                <div className="rounded-2xl bg-muted/50 p-6 ring-1 ring-border">
                  <Link className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No chains yet</h3>
                <p className="text-sm text-muted-foreground">
                  Get started by creating your first chain or import an existing
                  backup.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Backup
                </Button>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Chain
                </Button>
              </div>
            </div>
          </div>
        </div>

        <CreateChainDialog
          open={showCreate}
          name={name}
          onNameChange={setName}
          onCreate={handleCreate}
          onCancel={() => setShowCreate(false)}
          isPending={isCreating}
        />
      </>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Chains</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {chains.length} {chains.length === 1 ? "chain" : "chains"} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {chains.length > 0 && (
              <Button
                onClick={() => setShowDeleteAll(true)}
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            )}
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Chain
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chains..."
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {allTags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Tags
                    {selectedTags.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-72 overflow-auto">
                    {allTags.map((tag) => (
                      <DropdownMenuItem
                        key={tag}
                        className="cursor-pointer"
                        onSelect={(e) => {
                          e.preventDefault();
                          toggleTagFilter(tag);
                        }}
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag)}
                          className="mr-2"
                          onCheckedChange={() => toggleTagFilter(tag)}
                        />
                        <span className="flex-1 truncate">{tag}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onSelect={clearTagFilters}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Active filters:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                  <X className="h-3 w-3 ml-1.5" />
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs px-2"
                onClick={clearTagFilters}
              >
                Clear all
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table Content */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-8">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => toggleSort("id")}
                    >
                      ID
                      <ArrowUpDown
                        className={
                          sortKey === "id"
                            ? "ml-2 h-4 w-4 opacity-100"
                            : "ml-2 h-4 w-4 opacity-0"
                        }
                      />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => toggleSort("name")}
                    >
                      Name
                      <ArrowUpDown
                        className={
                          sortKey === "name"
                            ? "ml-2 h-4 w-4 opacity-100"
                            : "ml-2 h-4 w-4 opacity-0"
                        }
                      />
                    </Button>
                  </TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-[180px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => toggleSort("updated_at")}
                    >
                      Last Updated
                      <ArrowUpDown
                        className={
                          sortKey === "updated_at"
                            ? "ml-2 h-4 w-4 opacity-100"
                            : "ml-2 h-4 w-4 opacity-0"
                        }
                      />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[180px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => toggleSort("created_at")}
                    >
                      Created
                      <ArrowUpDown
                        className={
                          sortKey === "created_at"
                            ? "ml-2 h-4 w-4 opacity-100"
                            : "ml-2 h-4 w-4 opacity-0"
                        }
                      />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((chain) => (
                  <TableRow
                    key={chain.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => handleSelect(chain.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {chain.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{chain.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {chain.tags && chain.tags.length > 0 ? (
                          chain.tags.slice(0, 3).map((tag, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px] px-1.5 h-5"
                            >
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No tags
                          </span>
                        )}
                        {chain.tags && chain.tags.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 h-5"
                          >
                            +{chain.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(chain.updated_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(chain.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(chain.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border px-8 py-3 flex items-center justify-between text-xs text-muted-foreground bg-card">
        <div>
          Showing{" "}
          <span className="font-medium text-foreground">
            {filteredSorted.length}
          </span>{" "}
          of{" "}
          <span className="font-medium text-foreground">{chains.length}</span>{" "}
          chains
        </div>
      </div>

      <CreateChainDialog
        open={showCreate}
        name={name}
        onNameChange={setName}
        onCreate={handleCreate}
        onCancel={() => setShowCreate(false)}
        isPending={isCreating}
      />

      <DeleteChainDialog
        chainId={deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        isPending={isDeleting}
      />

      <DeleteAllChainsDialog
        open={showDeleteAll}
        count={chains.length}
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteAll(false)}
        isPending={isDeletingAll}
      />
    </div>
  );
}
