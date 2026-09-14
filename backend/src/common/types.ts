export type Severity = 'error' | 'warning' | 'info';
export type Dialect = 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'transactsql';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  location?: {
    statementIndex: number;
    snippet?: string;
  };
}

export interface RuleDefinition {
  ruleId: string;
  description: string;
  defaultSeverity: Severity;
  dialects?: Dialect[] | '*';
}

export interface PolicyOverride {
  [ruleId: string]: Severity | 'off';
}

export interface AnalyzeRequest {
  dialect: Dialect;
  sql: string;
  policy?: PolicyOverride;
}

export interface AnalyzeResult {
  ok: boolean;
  dialect: Dialect;
  sqlSummary: string;
  findings: Finding[];
  parseError?: string;
  /** 风险分 0-100，按 severity 加权扣分（见 common/score.ts） */
  score: number;
  /** 当前生效的通过阈值（仅门禁启用时参与 ok 判定） */
  passThreshold: number;
  /** 阈值门禁是否启用；false 时 ok 判定与旧版一致（仅看 error） */
  gateEnabled: boolean;
}
