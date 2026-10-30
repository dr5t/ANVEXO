import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GitHubInvestigationReport, StoredInvestigationSummary } from './types.js';

export class GitHubHistoryStore {
  private baseDir: string;

  constructor(repoRoot: string = process.cwd()) {
    this.baseDir = path.join(repoRoot, '.anvexo', 'github-investigations');
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch {}
    }
  }

  saveReport(report: GitHubInvestigationReport): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      const filePath = path.join(this.baseDir, `${report.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    } catch (err) {
      // In read-only or restricted environments, fail gracefully
      console.warn('Could not persist investigation report to disk:', err);
    }
  }

  getReport(id: string): GitHubInvestigationReport | null {
    const cleanId = path.basename(id).replace(/\.json$/, '');
    const filePath = path.join(this.baseDir, `${cleanId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as GitHubInvestigationReport;
    } catch {
      return null;
    }
  }

  listRecent(): StoredInvestigationSummary[] {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }
    try {
      const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.json'));
      const list: StoredInvestigationSummary[] = [];

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(this.baseDir, file), 'utf-8');
          const report = JSON.parse(content) as GitHubInvestigationReport;
          list.push({
            id: report.id,
            owner: report.repository.owner,
            repo: report.repository.repo,
            url: report.repository.originalUrl,
            isMock: report.isMock,
            status: 'completed',
            overallStatus: report.finalConclusion?.overallStatus,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            starsCount: report.metadata?.starsCount,
            primaryLanguage: report.metadata?.primaryLanguage,
            findingsCount: report.securityFindings?.length || 0,
            contributorsCount: report.contributors?.length || 0,
          });
        } catch {
          continue;
        }
      }

      return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    } catch {
      return [];
    }
  }

  deleteReport(id: string): boolean {
    const cleanId = path.basename(id).replace(/\.json$/, '');
    const filePath = path.join(this.baseDir, `${cleanId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
