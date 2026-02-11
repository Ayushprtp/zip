import {
  X,
  Send,
  Filter,
  GitBranch,
  Settings,
  FileText,
  Cookie,
  Hash,
  Braces,
  FormInput,
  Link2,
  Clock,
  ToggleLeft,
  Globe,
  Download,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { ScrollArea } from "@/components/httpchain/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/httpchain/components/ui/tabs";
import { Separator } from "@/components/httpchain/components/ui/separator";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import { StepNameEditor } from "./StepNameEditor";
import { RequestBasicInfo } from "./request/RequestBasicInfo";
import { StepDependencies } from "./request/StepDependencies";
import { TimeoutsRetries } from "./request/TimeoutsRetries";
import { RequestOptions } from "./request/RequestOptions";
import { ProxySettings } from "./request/ProxySettings";
import { HeadersEditor } from "./request/HeadersEditor";
import { CookiesEditor } from "./request/CookiesEditor";
import { ParamsEditor } from "./request/ParamsEditor";
import { JSONBodyEditor } from "./request/JSONBodyEditor";
import { FormDataEditor } from "./request/FormDataEditor";
import { ExtractorsEditor } from "./extractors/ExtractorsEditor";
import { ConditionsEditor } from "./conditions/ConditionsEditor";
import { Card } from "@/components/httpchain/components/ui/card";
import { ImportCurlDialog } from "../../dialogs/ImportCurlDialog";
import { useState } from "react";

interface StepDetailOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function StepDetailOverlay({ open, onClose }: StepDetailOverlayProps) {
  const selectedStepTab = useAppStore((s) => s.selectedStepTab);
  const setSelectedStepTab = useAppStore((s) => s.setSelectedStepTab);
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);

  const step = useActiveStep();
  const [importCurlOpen, setImportCurlOpen] = useState(false);

  // Determine the active tab: use selectedStepTab if set, otherwise default to "request"
  const activeTab = selectedStepTab || "request";

  if (!open || !selectedStepNodeId || !step) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-200">
      <div className="fixed inset-y-4 right-4 w-full max-w-6xl z-50 bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right-1/2 duration-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <StepNameEditor />
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {step.node_id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportCurlOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <Terminal className="h-3.5 w-3.5" />
              Import cURL
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 shrink-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Content with Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setSelectedStepTab}
          className="flex-1 flex min-h-0"
        >
          {/* Vertical First-Level Tabs */}
          <div className="border-r border-border bg-muted/30 w-56 shrink-0 flex flex-col p-3">
            <TabsList className="flex-col h-auto w-full bg-transparent rounded-none border-0 gap-1 items-start justify-start p-0">
              <div className="text-[10px] font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
                Configuration
              </div>
              <TabsTrigger
                value="request"
                className="w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-accent"
              >
                <Send className="h-4 w-4 mr-2.5" />
                Request
              </TabsTrigger>
              <TabsTrigger
                value="extractors"
                className="w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-accent"
              >
                <Filter className="h-4 w-4 mr-2.5" />
                Extractors
                {step?.request.extractors &&
                  step.request.extractors.length > 0 && (
                    <span className="ml-auto text-[10px] bg-primary-foreground/20 px-1.5 py-0.5 rounded-full font-semibold">
                      {step.request.extractors.length}
                    </span>
                  )}
              </TabsTrigger>
              <TabsTrigger
                value="condition"
                className="w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-accent"
              >
                <GitBranch className="h-4 w-4 mr-2.5" />
                Conditions
                {step?.condition && (
                  <span className="ml-auto text-[10px] bg-primary-foreground/20 px-1.5 py-0.5 rounded-full font-semibold">
                    {step.condition.checks.length}
                  </span>
                )}
              </TabsTrigger>

              <Separator className="my-2" />

              <div className="text-[10px] font-semibold text-muted-foreground px-3 py-2 uppercase tracking-wider">
                Output
              </div>
              <TabsTrigger
                value="response"
                className="w-full justify-start rounded-lg px-3 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-accent"
              >
                <Download className="h-4 w-4 mr-2.5" />
                Response
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <ScrollArea className="flex-1 scrollbar-thin">
              <div className="p-8 max-w-4xl mx-auto w-full">
                {/* Request Tab with Nested Horizontal Tabs */}
                <TabsContent value="request" className="mt-0 outline-none">
                  <Tabs defaultValue="general" className="w-full space-y-6">
                    <div className="border-b border-border">
                      <TabsList className="bg-transparent h-auto p-0 w-full justify-start rounded-none gap-1">
                        <TabsTrigger
                          value="general"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-3 py-2.5 text-sm hover:text-foreground/80 transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 mr-2" />
                          General
                        </TabsTrigger>
                        <TabsTrigger
                          value="headers"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-3 py-2.5 text-sm hover:text-foreground/80 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          Headers
                        </TabsTrigger>
                        <TabsTrigger
                          value="cookies"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-3 py-2.5 text-sm hover:text-foreground/80 transition-colors"
                        >
                          <Cookie className="h-3.5 w-3.5 mr-2" />
                          Cookies
                        </TabsTrigger>
                        <TabsTrigger
                          value="params"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-3 py-2.5 text-sm hover:text-foreground/80 transition-colors"
                        >
                          <Hash className="h-3.5 w-3.5 mr-2" />
                          Params
                        </TabsTrigger>
                        <TabsTrigger
                          value="json"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-3 py-2.5 text-sm hover:text-foreground/80 transition-colors"
                        >
                          <Braces className="h-3.5 w-3.5 mr-2" />
                          JSON Body
                        </TabsTrigger>
                        <TabsTrigger
                          value="data"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground px-3 py-2.5 text-sm hover:text-foreground/80 transition-colors"
                        >
                          <FormInput className="h-3.5 w-3.5 mr-2" />
                          Form Data
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="mt-6">
                      <TabsContent
                        value="general"
                        className="mt-0 outline-none"
                      >
                        <Card className="p-6 shadow-sm">
                          <RequestBasicInfo />
                        </Card>

                        <div className="mt-8 space-y-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                              <Link2 className="h-4 w-4 text-primary" />
                              <h3 className="text-sm font-semibold">
                                Step Dependencies
                              </h3>
                            </div>
                            <div className="pl-2">
                              <StepDependencies />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                              <Clock className="h-4 w-4 text-primary" />
                              <h3 className="text-sm font-semibold">
                                Timeouts & Retries
                              </h3>
                            </div>
                            <div className="pl-2">
                              <TimeoutsRetries />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                              <ToggleLeft className="h-4 w-4 text-primary" />
                              <h3 className="text-sm font-semibold">
                                Request Options
                              </h3>
                            </div>
                            <div className="pl-2">
                              <RequestOptions />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-border">
                              <Globe className="h-4 w-4 text-primary" />
                              <h3 className="text-sm font-semibold">
                                Proxy Settings
                              </h3>
                            </div>
                            <div className="pl-2">
                              <ProxySettings />
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent
                        value="headers"
                        className="mt-0 outline-none"
                      >
                        <Card className="p-6 shadow-sm">
                          <HeadersEditor />
                        </Card>
                      </TabsContent>

                      <TabsContent
                        value="cookies"
                        className="mt-0 outline-none"
                      >
                        <Card className="p-6 shadow-sm">
                          <CookiesEditor />
                        </Card>
                      </TabsContent>

                      <TabsContent value="params" className="mt-0 outline-none">
                        <Card className="p-6 shadow-sm">
                          <ParamsEditor />
                        </Card>
                      </TabsContent>

                      <TabsContent value="json" className="mt-0 outline-none">
                        <Card className="p-6 shadow-sm">
                          <JSONBodyEditor />
                        </Card>
                      </TabsContent>

                      <TabsContent value="data" className="mt-0 outline-none">
                        <Card className="p-6 shadow-sm">
                          <FormDataEditor />
                        </Card>
                      </TabsContent>
                    </div>
                  </Tabs>
                </TabsContent>

                {/* Extractors Tab */}
                <TabsContent value="extractors" className="mt-0 outline-none">
                  <Card className="p-6 shadow-sm">
                    <ExtractorsEditor />
                  </Card>
                </TabsContent>

                {/* Condition Tab */}
                <TabsContent value="condition" className="mt-0 outline-none">
                  <Card className="p-6 shadow-sm">
                    <ConditionsEditor />
                  </Card>
                </TabsContent>

                {/* Response Tab */}
                <TabsContent value="response" className="mt-0 outline-none">
                  <Card className="flex items-center justify-center p-12 border-2 border-dashed border-border shadow-sm">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="p-3 rounded-full bg-muted">
                        <Download className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-foreground">
                        Response View
                      </p>
                      <p className="text-xs text-center max-w-xs">
                        Response data will be available here after execution.
                      </p>
                    </div>
                  </Card>
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </div>

      {/* Import cURL Dialog */}
      <ImportCurlDialog
        open={importCurlOpen}
        onOpenChange={setImportCurlOpen}
      />
    </div>
  );
}
