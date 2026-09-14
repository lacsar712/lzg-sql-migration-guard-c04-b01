import { Finding } from './types';

export interface SeverityWeights {
  error: number;
  warning: number;
  info: number;
}

export interface ScorePolicy {
  /**
   * 阈值门禁开关。关闭（默认）时 ok 判定与旧版一致：仅当存在
   * severity=error 的 finding 时 ok=false；开启后 score 低于
   * passThreshold 时 ok 也为 false（即使只有 warning）。
   */
  gateEnabled: boolean;
  /** 通过阈值（0-100）：score 低于该值视为未通过（仅门禁启用时生效） */
  passThreshold: number;
  /** 各 severity 的扣分权重 */
  weights: SeverityWeights;
}

export const DEFAULT_SCORE_POLICY: ScorePolicy = {
  gateEnabled: false,
  passThreshold: 70,
  weights: { error: 40, warning: 10, info: 2 },
};

/**
 * 风险分：满分 100，按 severity 加权扣分，下限 0。
 * score = max(0, 100 - error*We - warning*Ww - info*Wi)
 */
export function computeScore(
  findings: Finding[],
  weights: SeverityWeights,
): number {
  const penalty = findings.reduce(
    (sum, f) => sum + (weights[f.severity] ?? 0),
    0,
  );
  return Math.max(0, 100 - penalty);
}

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** 从环境变量加载计分策略（缺省值见 DEFAULT_SCORE_POLICY） */
export function loadScorePolicyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ScorePolicy {
  return {
    gateEnabled: toBoolean(
      env.RISK_GATE_ENABLED,
      DEFAULT_SCORE_POLICY.gateEnabled,
    ),
    passThreshold: toNumber(
      env.RISK_PASS_THRESHOLD,
      DEFAULT_SCORE_POLICY.passThreshold,
    ),
    weights: {
      error: toNumber(env.RISK_WEIGHT_ERROR, DEFAULT_SCORE_POLICY.weights.error),
      warning: toNumber(
        env.RISK_WEIGHT_WARNING,
        DEFAULT_SCORE_POLICY.weights.warning,
      ),
      info: toNumber(env.RISK_WEIGHT_INFO, DEFAULT_SCORE_POLICY.weights.info),
    },
  };
}

/**
 * ok 判定：存在 error 一律不通过；门禁启用时 score 低于阈值也不通过。
 * 门禁关闭时行为与旧版完全一致（仅看是否有 error）。
 */
export function evaluateOk(
  hasError: boolean,
  score: number,
  policy: ScorePolicy,
): boolean {
  if (hasError) return false;
  if (policy.gateEnabled && score < policy.passThreshold) return false;
  return true;
}
