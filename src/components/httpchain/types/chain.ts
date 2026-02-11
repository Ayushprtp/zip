export interface ChainMeta {
  id: string;
  name: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ChainFull extends ChainMeta {
  version: number;
  steps: any[];
  chain_variables: string[];
  tags: string[];
}
