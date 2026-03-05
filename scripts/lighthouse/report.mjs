/**
 * Markdown report generator — produces REPORT.md from Lighthouse results.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { CATEGORIES, DEVICES, CATEGORY_WEIGHTS } from './config.mjs';
import { scoreEmoji, numericScore, formattedDate, log } from './utils.mjs';

const CATEGORY_LABELS = {
  'performance': 'Performance',
  'accessibility': 'Accessibility',
  'best-practices': 'Best Practices',
  'seo': 'SEO',
};

const CWV_AUDITS = [
  { id: 'first-contentful-paint', label: 'FCP' },
  { id: 'largest-contentful-paint', label: 'LCP' },
  { id: 'total-blocking-time', label: 'TBT' },
  { id: 'cumulative-layout-shift', label: 'CLS' },
  { id: 'speed-index', label: 'Speed Index' },
];

/**
 * Generate the full Markdown report and save it.
 */
export async function generateMarkdownReport(results, mode, outputDir) {
  const lines = [];
  const push = (...l) => lines.push(...l);

  const successful = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);

  push(`# Lighthouse Audit Report`);
  push('');
  push(`**Date:** ${formattedDate()}`);
  push(`**Mode:** ${mode === 'prod' ? 'Production (https://www.darkstone.cat)' : 'Local build'}`);
  push(`**Audits:** ${successful.length} passed, ${failed.length} failed, ${results.length} total`);
  push('');

  // --- 0. Action Items ---
  const tasks = generateTasks(results);
  push(...formatTasksSection(tasks));

  // --- 1. Overall Scores ---
  push('## Overall Scores');
  push('');

  for (const device of DEVICES) {
    push(`### ${device.charAt(0).toUpperCase() + device.slice(1)}`);
    push('');
    const header = `| Page | ${CATEGORIES.map((c) => CATEGORY_LABELS[c]).join(' | ')} |`;
    const sep = `| --- | ${CATEGORIES.map(() => '---').join(' | ')} |`;
    push(header);
    push(sep);

    const deviceResults = successful.filter((r) => r.device === device);
    for (const r of deviceResults) {
      const scores = CATEGORIES.map((c) => scoreEmoji(r.scores[c]));
      push(`| ${r.slug} | ${scores.join(' | ')} |`);
    }
    push('');
  }

  // --- 2. Core Web Vitals ---
  push('## Core Web Vitals');
  push('');

  for (const device of DEVICES) {
    push(`### ${device.charAt(0).toUpperCase() + device.slice(1)}`);
    push('');
    const header = `| Page | ${CWV_AUDITS.map((a) => a.label).join(' | ')} |`;
    const sep = `| --- | ${CWV_AUDITS.map(() => '---').join(' | ')} |`;
    push(header);
    push(sep);

    const deviceResults = successful.filter((r) => r.device === device);
    for (const r of deviceResults) {
      const values = CWV_AUDITS.map((a) => {
        const audit = r.lhr.audits[a.id];
        if (!audit) return 'N/A';
        return audit.displayValue || 'N/A';
      });
      push(`| ${r.slug} | ${values.join(' | ')} |`);
    }
    push('');
  }

  // --- 3. Issues by Category ---
  push('## Issues by Category');
  push('');
  push('Audits scoring below 90 (failing or needs improvement):');
  push('');

  for (const cat of CATEGORIES) {
    const issues = collectIssues(successful, cat);
    if (issues.length === 0) continue;

    push(`### ${CATEGORY_LABELS[cat]}`);
    push('');
    push('| Page | Device | Audit | Score | Description |');
    push('| --- | --- | --- | --- | --- |');
    for (const issue of issues) {
      const score = numericScore(issue.score);
      const scoreStr = score !== null ? String(score) : 'N/A';
      push(`| ${issue.slug} | ${issue.device} | ${issue.title} | ${scoreStr} | ${truncate(issue.description, 80)} |`);
    }
    push('');
  }

  // --- 4. Improvement Opportunities ---
  push('## Improvement Opportunities');
  push('');

  const opportunities = collectOpportunities(successful);
  if (opportunities.length > 0) {
    push('| Page | Device | Opportunity | Estimated Savings |');
    push('| --- | --- | --- | --- |');
    for (const opp of opportunities) {
      push(`| ${opp.slug} | ${opp.device} | ${opp.title} | ${opp.savings} |`);
    }
  } else {
    push('No significant opportunities found.');
  }
  push('');

  // --- 5. Diagnostics ---
  push('## Diagnostics');
  push('');

  const DIAG_AUDITS = [
    'dom-size',
    'mainthread-work-breakdown',
    'bootup-time',
    'third-party-summary',
    'total-byte-weight',
  ];

  for (const device of DEVICES) {
    push(`### ${device.charAt(0).toUpperCase() + device.slice(1)}`);
    push('');

    const deviceResults = successful.filter((r) => r.device === device);
    for (const r of deviceResults) {
      const diags = DIAG_AUDITS
        .map((id) => r.lhr.audits[id])
        .filter((a) => a && a.displayValue);

      if (diags.length === 0) continue;

      push(`**${r.slug}:**`);
      for (const d of diags) {
        push(`- ${d.title}: ${d.displayValue}`);
      }
      push('');
    }
  }

  // --- 6. Audit Errors ---
  if (failed.length > 0) {
    push('## Audit Errors');
    push('');
    push('| Page | Device | Error |');
    push('| --- | --- | --- |');
    for (const r of failed) {
      push(`| ${r.slug} | ${r.device} | ${truncate(r.error, 100)} |`);
    }
    push('');
  }

  const reportPath = join(outputDir, 'REPORT.md');
  await writeFile(reportPath, lines.join('\n'));
  log(`Report saved to ${reportPath}`);

  await generateTasksFile(tasks, outputDir);

  return reportPath;
}

/**
 * Generate deduplicated, prioritized action items from all results.
 */
function generateTasks(results) {
  const successful = results.filter((r) => !r.error);
  const taskMap = new Map(); // auditId -> task object

  for (const cat of CATEGORIES) {
    for (const r of successful) {
      const category = r.lhr.categories[cat];
      if (!category) continue;

      for (const ref of category.auditRefs) {
        const audit = r.lhr.audits[ref.id];
        if (!audit || audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'informative') continue;
        if (audit.score === null || audit.score >= 0.9) continue;

        const key = ref.id;
        if (!taskMap.has(key)) {
          taskMap.set(key, {
            id: key,
            title: audit.title,
            category: cat,
            worstScore: audit.score,
            pages: new Set(),
            devices: new Set(),
            savingsMs: 0,
            savingsBytes: 0,
          });
        }

        const task = taskMap.get(key);
        task.pages.add(r.slug);
        task.devices.add(r.device);
        if (audit.score < task.worstScore) task.worstScore = audit.score;

        // Accumulate savings
        const details = audit.details;
        if (details?.overallSavingsMs) task.savingsMs += details.overallSavingsMs;
        if (details?.overallSavingsBytes) task.savingsBytes += details.overallSavingsBytes;
      }
    }
  }

  const totalPages = new Set(successful.map((r) => r.slug)).size;

  // Score and sort
  const tasks = [...taskMap.values()].map((task) => {
    const categoryWeight = CATEGORY_WEIGHTS[task.category] || 1;
    const scoreSeverity = (1 - task.worstScore) * 100;
    const affectedPages = task.pages.size;
    task.priority = categoryWeight * 25 + scoreSeverity + affectedPages * 3;
    task.deviceLabel = task.devices.size === 2 ? 'both' : [...task.devices][0];
    task.pagesLabel = task.pages.size >= totalPages ? 'all pages' : [...task.pages].join(', ');

    // Format savings
    const parts = [];
    if (task.savingsMs > 0) parts.push(`${Math.round(task.savingsMs)} ms`);
    if (task.savingsBytes > 0) parts.push(`${Math.round(task.savingsBytes / 1024)} KB`);
    task.savingsLabel = parts.join(' + ') || '';

    return task;
  });

  tasks.sort((a, b) => b.priority - a.priority);
  return tasks;
}

/**
 * Render the Action Items section as markdown lines.
 */
function formatTasksSection(tasks) {
  const lines = [];
  lines.push('## Action Items');
  lines.push('');

  if (tasks.length === 0) {
    lines.push('No action items — all audits passed.');
    lines.push('');
    return lines;
  }

  lines.push(`> ${tasks.length} tasks found — ordered by priority (highest first)`);
  lines.push('');
  lines.push('| # | Priority | Category | Task | Pages | Devices | Score | Savings |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const tag = t.priority >= 80 ? '🔴 High' : t.priority >= 40 ? '🟡 Medium' : '🟢 Low';
    const score = Math.round(t.worstScore * 100);
    lines.push(`| ${i + 1} | ${tag} | ${CATEGORY_LABELS[t.category]} | ${t.title} | ${t.pagesLabel} | ${t.deviceLabel} | ${score} | ${t.savingsLabel} |`);
  }
  lines.push('');
  return lines;
}

/**
 * Write a standalone TASKS.md file.
 */
async function generateTasksFile(tasks, outputDir) {
  const lines = [];
  lines.push('# Lighthouse Action Items');
  lines.push('');
  lines.push(`**Generated:** ${formattedDate()}`);
  lines.push('');
  lines.push(...formatTasksSection(tasks));

  // Add legend
  lines.push('### Priority Legend');
  lines.push('');
  lines.push('- 🔴 **High** — priority score ≥ 80');
  lines.push('- 🟡 **Medium** — priority score ≥ 40');
  lines.push('- 🟢 **Low** — priority score < 40');
  lines.push('');
  lines.push('Priority formula: `categoryWeight × 25 + (1 - worstScore) × 100 + affectedPages × 3`');
  lines.push('');
  lines.push('Category weights: Accessibility (4) > SEO (3) > Performance (2) > Best Practices (1)');

  const tasksPath = join(outputDir, 'TASKS.md');
  await writeFile(tasksPath, lines.join('\n'));
  log(`Tasks saved to ${tasksPath}`);
  return tasksPath;
}

/**
 * Collect failing audits (score < 0.9) for a given category.
 */
function collectIssues(results, category) {
  const issues = [];
  for (const r of results) {
    const cat = r.lhr.categories[category];
    if (!cat) continue;

    for (const ref of cat.auditRefs) {
      const audit = r.lhr.audits[ref.id];
      if (!audit || audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'informative') continue;
      if (audit.score !== null && audit.score < 0.9) {
        issues.push({
          slug: r.slug,
          device: r.device,
          title: audit.title,
          score: audit.score,
          description: stripMarkdown(audit.description),
        });
      }
    }
  }
  return issues;
}

/**
 * Collect opportunity audits with estimated savings.
 */
function collectOpportunities(results) {
  const opps = [];
  for (const r of results) {
    const perf = r.lhr.categories['performance'];
    if (!perf) continue;

    for (const ref of perf.auditRefs) {
      if (ref.group !== 'load-opportunities') continue;
      const audit = r.lhr.audits[ref.id];
      if (!audit || audit.score === null || audit.score >= 0.9) continue;

      const savings = formatSavings(audit);
      if (!savings) continue;

      opps.push({
        slug: r.slug,
        device: r.device,
        title: audit.title,
        savings,
      });
    }
  }
  return opps;
}

function formatSavings(audit) {
  const details = audit.details;
  if (!details) return audit.displayValue || null;

  if (details.overallSavingsMs) {
    return `${Math.round(details.overallSavingsMs)} ms`;
  }
  if (details.overallSavingsBytes) {
    return `${Math.round(details.overallSavingsBytes / 1024)} KB`;
  }
  return audit.displayValue || null;
}

function truncate(str, max) {
  if (!str) return '';
  const clean = str.replace(/\n/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function stripMarkdown(str) {
  if (!str) return '';
  return str.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '');
}
