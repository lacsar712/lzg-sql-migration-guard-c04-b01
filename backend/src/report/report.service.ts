import { Injectable } from '@nestjs/common';
import { AnalyzeResult, Finding } from '../common/types';

@Injectable()
export class ReportService {
  toResponse(result: AnalyzeResult, historyId?: string) {
    return {
      id: historyId,
      ok: result.ok,
      dialect: result.dialect,
      sqlSummary: result.sqlSummary,
      findings: result.findings,
      parseError: result.parseError,
      score: result.score,
      passThreshold: result.passThreshold,
      gateEnabled: result.gateEnabled,
      summary: this.summarizeFindings(result.findings),
    };
  }

  summarizeFindings(findings: Finding[]) {
    return {
      total: findings.length,
      error: findings.filter((f) => f.severity === 'error').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    };
  }
}
