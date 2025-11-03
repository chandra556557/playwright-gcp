# Production Deployment Plan: GitHub Push + Red Hat 8 Deployment

**Target Server**: 161.97.136.165  
**Target Repository**: https://github.com/chandra556557/playwright-gcp  
**Operating System**: Red Hat Enterprise Linux 8

## Overview

This plan covers:
1. Pushing code to GitHub repository
2. Deploying application to Red Hat 8 production server
3. Setting up systemd service for production
4. Configuring database and environment

---

## Phase 1: Push Code to GitHub

### Step 1: Add GitHub Remote

```bash
git remote add playwright-gcp https://github.com/chandra556557/playwright-gcp.git
```

### Step 2: Review and Commit Changes

Current uncommitted changes detected:
- Modified: `playwright-crx-enhanced/backend/src/routes/project.routes.ts`
- Deleted: `playwright-crx-enhanced/backend/src/routes/self-healing.routes.ts`
- Deleted: `playwright-crx-enhanced/backend/tests/selfHealing.test.ts`
- Modified: `playwright-crx-enhanced/frontend/src/components/Dashboard.tsx`
- Deleted: `playwright-db-push`
- Untracked: New files in `python-backend/`, `allure-results/`, new components

**Action Required**: Review these changes and commit them:

```bash
# Review changes
git status
git diff

# Stage all changes (or selectively)
git add .

# Commit with descriptive message
git commit -m "Prepare for production deployment to Red Hat 8"
```

### Step 3: Push to GitHub

```bash
# Push main branch to the new remote
git push playwright-gcp main

# If repository requires different branch name or initial push
git push playwright-gcp main:main --force
```

**Note**: If authentication is required, ensure you have:
- GitHub personal access token, or
- SSH key configured with GitHub account

---

## Phase 2: Red Hat 8 Production Deployment

### Prerequisites

- SSH access to 161.97.136.165
- sudo privileges on Red Hat server
- PostgreSQL installed and running
- Node.js 20+ installed
- Git installed on server

### Step 1: Create Deployment Script

**File**: `scripts/deploy-redhat8.sh`

This script will:
- SSH to the production server
- Clone/pull latest code from GitHub
- Build the application
- Run database migrations
- Restart systemd service
- Verify deployment

### Step 2: Create Systemd Service File

**File**: `scripts/playwright-crx.service`

Service configuration for production:
- Auto-restart on failure
- Environment variables
- Logging configuration
- Dependency on PostgreSQL

### Step 3: Deployment Execution

The deployment script will handle:
1. SSH connection to 161.97.136.165
2. Code deployment from GitHub
3. Application build
4. Database migrations
5. Service restart
6. Health checks

---

## Files to Create

1. **scripts/deploy-redhat8.sh** - Main deployment automation script
2. **scripts/playwright-crx.service** - Systemd service file template
3. **REDHAT8_PRODUCTION_DEPLOYMENT.md** - Detailed deployment guide
4. **DEPLOYMENT_CHECKLIST.md** - Pre-deployment verification checklist

---

## Next Steps

After reviewing this plan, confirm to proceed with:
1. Creating the deployment scripts
2. Setting up GitHub remote (you'll execute git commands)
3. Generating deployment documentation

**Important Notes**:
- Review uncommitted changes before committing
- Verify GitHub repository access/permissions
- Ensure SSH access to Red Hat server is working
- Backup existing production data before deployment

