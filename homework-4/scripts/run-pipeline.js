#!/usr/bin/env node
'use strict';

/**
 * Single-command orchestrator for the 4-agent bug pipeline.
 *
 *   npm run pipeline               # run the whole pipeline on batch 001
 *   npm run pipeline -- --dry-run  # print the plan + composed prompts, no calls
 *   BATCH=002 npm run pipeline     # run on a different bug batch
 *
 * For each stage it: reads the agent definition, auto-loads the skill(s) declared
 * in the agent frontmatter, composes a prompt, and invokes the Claude Code CLI
 * (`claude -p`) headless with the agent's model. Stages run strictly in order and
 * the pipeline stops on the first failure.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BATCH = process.env.BATCH || '001';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_DIR = path.join('context', 'bugs', BATCH);

// ---- Pipeline definition (strict order per TASKS.md) -----------------------
const STAGES = [
  {
    name: 'Bug Researcher',
    agent: 'agents/bug-researcher.agent.md',
    task: `Investigate the defects described in ${BATCH_DIR}/bug-context.md against the source in src/. Produce ${BATCH_DIR}/research/codebase-research.md exactly per your agent's output spec.`,
    expect: `${BATCH_DIR}/research/codebase-research.md`,
  },
  {
    name: 'Bug Research Verifier',
    agent: 'agents/research-verifier.agent.md',
    task: `Fact-check ${BATCH_DIR}/research/codebase-research.md against live source. Apply the research-quality-measurement skill and write ${BATCH_DIR}/research/verified-research.md in the skill's required format.`,
    expect: `${BATCH_DIR}/research/verified-research.md`,
  },
  {
    name: 'Bug Planner',
    agent: 'agents/bug-planner.agent.md',
    task: `Using only PASS-verified claims from ${BATCH_DIR}/research/verified-research.md, write ${BATCH_DIR}/implementation-plan.md with exact before/after edits and the test command.`,
    expect: `${BATCH_DIR}/implementation-plan.md`,
  },
  {
    name: 'Bug Fixer',
    agent: 'agents/bug-fixer.agent.md',
    task: `Apply ${BATCH_DIR}/implementation-plan.md to src/ (including the SQL-injection fix), run \`npm test\`, and write ${BATCH_DIR}/fix-summary.md with before/after code and the test result.`,
    expect: `${BATCH_DIR}/fix-summary.md`,
  },
  {
    name: 'Security Verifier',
    agent: 'agents/security-verifier.agent.md',
    task: `Security-review the code changed in ${BATCH_DIR}/fix-summary.md (review only, no edits). Confirm the SQL injection is remediated and write ${BATCH_DIR}/security-report.md with severity-rated findings.`,
    expect: `${BATCH_DIR}/security-report.md`,
  },
  {
    name: 'Unit Test Generator',
    agent: 'agents/unit-test-generator.agent.md',
    task: `Generate FIRST-compliant unit tests for the changed code in ${BATCH_DIR}/fix-summary.md, place them under tests/, run \`npm test\`, and write ${BATCH_DIR}/test-report.md with the run result.`,
    expect: `${BATCH_DIR}/test-report.md`,
  },
];

// ---- Helpers ---------------------------------------------------------------

/** Extract the model id and skill file list from an agent file's frontmatter. */
function parseAgent(agentRelPath) {
  const md = fs.readFileSync(path.join(ROOT, agentRelPath), 'utf8');
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? fmMatch[1] : '';
  const model = (fm.match(/^model:\s*(.+)$/m) || [])[1];
  const skills = [...fm.matchAll(/-\s*(skills\/[^\s]+\.md)/g)].map((m) => m[1]);
  const tools = (fm.match(/^tools:\s*\[(.+)\]/m) || [])[1] || '';
  return {
    md,
    model: model ? model.trim() : 'claude-sonnet-4-6',
    skills,
    tools: tools.split(',').map((t) => t.trim()).filter(Boolean),
  };
}

/** Compose the headless prompt for a stage: agent def + skills + task. */
function buildPrompt(stage, agent) {
  let p = `You are the "${stage.name}" agent in an automated bug-fixing pipeline.\n`;
  p += `Follow your agent definition below exactly. Operate on bug batch ${BATCH}.\n`;
  p += `Do only your stage's job and write only your declared output file(s).\n\n`;
  p += `===== AGENT DEFINITION (${stage.agent}) =====\n${agent.md}\n`;
  for (const skillRel of agent.skills) {
    const skillContent = fs.readFileSync(path.join(ROOT, skillRel), 'utf8');
    p += `\n===== LOADED SKILL (${skillRel}) =====\n${skillContent}\n`;
  }
  p += `\n===== TASK =====\n${stage.task}\n`;
  return p;
}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

// ---- Run -------------------------------------------------------------------

function main() {
  // Ensure the research subdirectory exists so agents can write into it.
  fs.mkdirSync(path.join(ROOT, BATCH_DIR, 'research'), { recursive: true });

  log('='.repeat(70));
  log(`4-Agent Bug Pipeline  |  batch ${BATCH}  |  ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('='.repeat(70));

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const agent = parseAgent(stage.agent);
    const prompt = buildPrompt(stage, agent);

    log(`\n[${i + 1}/${STAGES.length}] ${stage.name}`);
    log(`    model : ${agent.model}`);
    log(`    skills: ${agent.skills.length ? agent.skills.join(', ') : '(none)'}`);
    log(`    tools : ${agent.tools.join(', ')}`);
    log(`    output: ${stage.expect}`);

    if (DRY_RUN) {
      log(`    --- prompt preview (${prompt.length} chars) ---`);
      log(prompt.split('\n').slice(0, 6).map((l) => `    | ${l}`).join('\n'));
      continue;
    }

    const args = [
      '-p',
      '--model', agent.model,
      '--allowedTools', agent.tools.join(' '),
      '--dangerously-skip-permissions',
    ];
    const res = spawnSync('claude', args, {
      cwd: ROOT,
      input: prompt,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: process.platform === 'win32', // resolve claude.cmd on Windows
    });

    if (res.error) {
      log(`\n[ERROR] could not launch the 'claude' CLI: ${res.error.message}`);
      log("Install Claude Code and ensure 'claude' is on your PATH, then retry.");
      process.exit(1);
    }
    if (res.status !== 0) {
      log(`\n[FAIL] ${stage.name} exited with code ${res.status}. Stopping pipeline.`);
      process.exit(res.status || 1);
    }
    if (!fs.existsSync(path.join(ROOT, stage.expect))) {
      log(`\n[FAIL] ${stage.name} did not produce ${stage.expect}. Stopping pipeline.`);
      process.exit(1);
    }
    log(`    ✓ produced ${stage.expect}`);
  }

  log('\n' + '='.repeat(70));
  log(DRY_RUN ? 'Dry run complete.' : 'Pipeline complete — all stages produced their outputs.');
  log('='.repeat(70));
}

main();
