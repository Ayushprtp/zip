export const EvaluationStatus = {
  PENDING: "pending",
  SUCCESS: "passed",
  FAILED: "failed",
  ERROR: "error",
} as const;

export type EvaluationStatus =
  (typeof EvaluationStatus)[keyof typeof EvaluationStatus];

export const DeclarativeOperator = {
  EXISTS: "exists",
  NOT_EXISTS: "not_exists",
  EQUALS: "equals",
  NOT_EQUALS: "not_equals",
  CONTAINS: "contains",
  CONTAINS_PATTERN: "contains_pattern",
  NOT_CONTAINS: "not_contains",
  NOT_CONTAINS_PATTERN: "not_contains_pattern",
  IS_GREATER_THAN: "is_greater_than",
  IS_LESS_THAN: "is_less_than",
} as const;

export type DeclarativeOperator =
  (typeof DeclarativeOperator)[keyof typeof DeclarativeOperator];

export const ExtractorType = {
  JSONPATHARRAY: "jsonpatharray",
  REGEX: "regex",
  DECLARATIVE_CHECK: "declarative_check",
  FUNCTION: "function",
} as const;

export type ExtractorType = (typeof ExtractorType)[keyof typeof ExtractorType];

export const ConditionOperator = {
  AND: "and",
  OR: "or",
} as const;

export type ConditionOperator =
  (typeof ConditionOperator)[keyof typeof ConditionOperator];

export const StepExecutionStatus = {
  PENDING: "pending",
  WAITING_DEPENDENCIES: "waiting_dependencies",
  DEADLOCKED: "deadlocked",
  SKIPPED_CONDITION_NOT_MET: "skipped_condition_not_met",
  EXECUTING: "executing",
  COMPLETED_SUCCESS: "completed_success",
  COMPLETED_WITH_REQUEST_ERROR: "completed_with_request_error",
} as const;

export type StepExecutionStatus =
  (typeof StepExecutionStatus)[keyof typeof StepExecutionStatus];

export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

// Default headers for new steps
export const DEFAULT_REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

// Utility function to generate UUIDs
export function generateUUID(): string {
  return crypto.randomUUID();
}

export interface DeclarativeCheck {
  path: string[];
  operator: DeclarativeOperator;
  value?: any;
  variable_name?: string;
}

export interface RegexExtractor {
  path: string[];
  pattern: string;
  find_all: boolean;
}

export interface FunctionExtractorCode {
  python?: string;
  go?: string;
  js?: string;
  rust?: string;
  c?: string;
  cpp?: string;
}

export interface FunctionExtractor {
  registered_function_name?: string;
  code?: FunctionExtractorCode;
}

export interface Extractor {
  extractor_key: string;
  extractor_type: ExtractorType;
  declarative_check_extractor?: DeclarativeCheck;
  jsonpatharray_extractor?: string[];
  regex_extractor?: RegexExtractor;
  function_extractor?: FunctionExtractor;

  _extraction_status?: EvaluationStatus;
}

export interface HTTPRequest {
  request_name: string;
  request_url: string;
  request_method: HTTPMethod;
  request_http_proxy?: string | null;
  request_https_proxy?: string | null;
  request_headers?: Record<string, string> | null;
  request_cookies?: Record<string, string> | null;
  request_data?: Record<string, any> | string | null;
  request_json?: Record<string, any> | null;
  request_params?: Record<string, string> | null;
  request_connect_timeout?: number | null;
  request_read_timeout?: number | null;
  request_follow_redirects?: boolean | null;
  request_retries?: number | null;
  request_retry_delay?: number | null;
  randomize_headers?: boolean | null;
  extractors?: Extractor[] | null;

  // Private buffer fields for disabled items (UI-only, not sent in request)
  _headers_buffer?: Record<string, string> | null;
  _cookies_buffer?: Record<string, string> | null;
  _params_buffer?: Record<string, string> | null;

  _response?: HTTPResponse | null;
}

export interface HTTPResponse {
  status_code: number;
  response_url: string;
  response_headers: Record<string, string>;
  response_time: number;
  response_cookies: Record<string, string>;
  failed: boolean;
  failure_reason?: string;
  json_body?: Record<string, any>;
  text_body?: string;
  html_body?: string;
  json_ld_data?: Record<string, any>[];
  application_json_data?: Record<string, any>[];
  meta_tags_data?: Record<string, any>;
}

export interface ConditionalLogic {
  operator: ConditionOperator;
  checks: DeclarativeCheck[];

  _condition_status?: EvaluationStatus;
}

export interface Step {
  node_id: string;
  name: string;
  request: HTTPRequest;
  depends_on_variables?: string[] | null;
  condition?: ConditionalLogic | null;
}

export interface HttpChain {
  version: number;
  name: string;
  chain_variables: string[];
  steps: Step[];
}

export function createEmptyStep(): Step {
  return {
    node_id: generateUUID(),
    name: "Unnamed Step",
    request: {
      request_name: "Unnamed Request",
      request_method: "GET",
      request_url: "",
      request_headers: { ...DEFAULT_REQUEST_HEADERS },
      request_cookies: null,
      request_data: null,
      request_json: null,
      request_params: null,
      request_connect_timeout: 10000,
      request_read_timeout: 10000,
      request_follow_redirects: true,
      request_retries: 3,
      request_retry_delay: 1000,
      randomize_headers: false,
      extractors: null,
      _headers_buffer: null,
      _cookies_buffer: null,
      _params_buffer: null,
      _response: null,
    },
    depends_on_variables: null,
    condition: null,
  };
}
