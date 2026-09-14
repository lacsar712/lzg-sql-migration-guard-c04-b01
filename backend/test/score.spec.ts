import { RuleEngineService } from '../src/rule-engine/rule-engine.service';
import { ParserService } from '../src/parser/parser.service';
import {
  computeScore,
  DEFAULT_SCORE_POLICY,
  evaluateOk,
  loadScorePolicyFromEnv,
} from '../src/common/score';
import { Finding } from '../src/common/types';

function createEngine() {
  const engine = new RuleEngineService(new ParserService());
  engine.onModuleInit();
  return engine;
}

function finding(severity: Finding['severity']): Finding {
  return { ruleId: 'test_rule', severity, message: 'm' };
}

const WARNING_ONLY_SQL =
  'ALTER TABLE users ADD COLUMN phone VARCHAR(32) NOT NULL;';

describe('risk score', () => {
  it('computeScore weights findings by severity', () => {
    const findings = [
      finding('error'),
      finding('warning'),
      finding('warning'),
      finding('info'),
    ];
    // 100 - 40 - 10 - 10 - 2 = 38
    expect(computeScore(findings, DEFAULT_SCORE_POLICY.weights)).toBe(38);
  });

  it('computeScore floors at 0', () => {
    const findings = Array.from({ length: 5 }, () => finding('error'));
    expect(computeScore(findings, DEFAULT_SCORE_POLICY.weights)).toBe(0);
  });

  it('clean SQL scores 100 and passes', () => {
    const engine = createEngine();
    const r = engine.analyze('SELECT * FROM users;', 'postgresql');
    expect(r.score).toBe(100);
    expect(r.ok).toBe(true);
  });

  it('warning-only SQL keeps ok=true by default (legacy-compatible)', () => {
    const engine = createEngine();
    const r = engine.analyze(WARNING_ONLY_SQL, 'postgresql');
    expect(r.score).toBe(90);
    expect(r.ok).toBe(true);
    expect(r.gateEnabled).toBe(false);
    expect(r.passThreshold).toBe(70);
  });

  it('gate enabled: warning-only SQL below threshold fails', () => {
    const engine = createEngine();
    engine.setScorePolicy({ gateEnabled: true, passThreshold: 95 });
    const r = engine.analyze(WARNING_ONLY_SQL, 'postgresql');
    expect(r.score).toBe(90);
    expect(r.ok).toBe(false);
  });

  it('gate enabled: score at the threshold still passes', () => {
    const engine = createEngine();
    engine.setScorePolicy({ gateEnabled: true, passThreshold: 90 });
    const r = engine.analyze(WARNING_ONLY_SQL, 'postgresql');
    expect(r.score).toBe(90);
    expect(r.ok).toBe(true);
  });

  it('error findings fail regardless of gate switch', () => {
    const engine = createEngine();
    const r = engine.analyze('DROP TABLE users;', 'postgresql');
    expect(r.ok).toBe(false);
    expect(r.score).toBe(60);
  });

  it('parse error yields a score and ok=false', () => {
    const engine = createEngine();
    const r = engine.analyze('THIS IS NOT VALID SQL !!!', 'postgresql');
    expect(r.ok).toBe(false);
    expect(r.score).toBe(60);
    expect(r.parseError).toBeTruthy();
  });

  it('loads policy from env with overrides', () => {
    const policy = loadScorePolicyFromEnv({
      RISK_GATE_ENABLED: 'true',
      RISK_PASS_THRESHOLD: '80',
      RISK_WEIGHT_WARNING: '25',
    } as NodeJS.ProcessEnv);
    expect(policy.gateEnabled).toBe(true);
    expect(policy.passThreshold).toBe(80);
    expect(policy.weights.warning).toBe(25);
    expect(policy.weights.error).toBe(40);
    expect(policy.weights.info).toBe(2);
  });

  it('env defaults keep the gate disabled', () => {
    const policy = loadScorePolicyFromEnv({} as NodeJS.ProcessEnv);
    expect(policy).toEqual(DEFAULT_SCORE_POLICY);
  });

  it('evaluateOk: error always fails; gate compares score to threshold', () => {
    expect(evaluateOk(true, 100, DEFAULT_SCORE_POLICY)).toBe(false);
    expect(evaluateOk(false, 10, DEFAULT_SCORE_POLICY)).toBe(true);
    const gated = { ...DEFAULT_SCORE_POLICY, gateEnabled: true };
    expect(evaluateOk(false, 69, gated)).toBe(false);
    expect(evaluateOk(false, 70, gated)).toBe(true);
  });
});
