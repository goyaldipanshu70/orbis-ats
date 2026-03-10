export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
  };
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: string[][];
}

export interface Workflow {
  id: number;
  name: string;
  description: string;
  definition_json: WorkflowDefinition;
  status: 'draft' | 'active' | 'archived';
  trigger_type: string;
  trigger_config: Record<string, any>;
  runs_count: number;
  last_run_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: number;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  trigger_type: string;
  input_data: Record<string, any> | null;
  output_data: Record<string, any> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string;
  node_runs?: WorkflowNodeRun[];
}

export interface WorkflowNodeRun {
  id: number;
  run_id: number;
  node_id: string;
  node_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input_data: Record<string, any> | null;
  output_data: Record<string, any> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
}

export interface ScrapedLead {
  id: number;
  workflow_run_id: number;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  headline: string | null;
  location: string | null;
  skills: string[] | null;
  experience_years: number | null;
  source: string;
  source_url: string | null;
  score: number | null;
  score_breakdown: Record<string, number> | null;
  created_at: string;
}

export interface NodeTypeInfo {
  type: string;
  category: 'trigger' | 'search' | 'ai' | 'processing' | 'action' | 'conditional';
  display_name: string;
  description: string;
  config_schema: Record<string, any>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  definition_json: WorkflowDefinition;
}
