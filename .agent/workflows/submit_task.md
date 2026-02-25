---
description: Run rigorous audit before allowing task completion
---

# Submit Task Workflow

This workflow MUST be executed before reporting task completion.

## 1. Build and Start (if not running)
Ensure the development server is running.

## 2. Execute External Auditor
// turbo
```bash
node audit/verify_ui.mjs
```

## 3. Check Audit Result
- **If Exit Code 0**: Proceed to generate completion report.
- **If Exit Code 1**: STOP. Read the output log. Analyze the failure. Fix the code. DO NOT submit. Re-run this workflow.

## 4. Generate Completion Report
Only if the audit passed, create the walkthrough artifact documenting:
- What was implemented
- What was tested
- The audit results (must show Exit Code 0)
