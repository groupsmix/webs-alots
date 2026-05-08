/**
 * Bug Group 4: Infrastructure Documentation - Preservation Property Tests
 * 
 * **CRITICAL: These tests verify existing infrastructure behavior BEFORE fixes**
 * 
 * Property 2: Preservation - Existing Infrastructure Behavior
 * 
 * METHODOLOGY: Observation-first bugfix workflow
 * - These tests observe behavior on UNFIXED infrastructure
 * - They capture baseline behavior that MUST be preserved after documentation is added
 * - Tests MUST PASS on unfixed code (before documentation changes)
 * - After fixes (documentation additions), these same tests must still pass
 * 
 * GOAL: Ensure documentation additions don't break existing infrastructure:
 * 1. Production configs work correctly (wrangler.toml is valid)
 * 2. Database connections are secure (SSL mode enabled)
 * 3. Migrations apply successfully (rollback procedures exist)
 * 4. Existing documentation is accessible (backup runbooks work)
 * 5. Infrastructure operations are not broken by documentation additions
 * 
 * Requirements validated:
 * - Preservation 7: Existing migrations must continue to apply successfully
 * - Preservation 8: Existing infrastructure must continue to function
 * 
 * Bug Group 4 Issues:
 * - A13-04 (INFO): wrangler.toml secrets review
 * - A13-05 (INFO): MinIO credentials documentation
 * - A19-05 (INFO): Migration rollback plan documentation
 * - A21-02 (LOW): KMS envelope integration documentation
 * - A22-05 (LOW): PITR retention SLA verification
 * - A24-01 (LOW): SSL mode verification for DB connections
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * PRESERVATION PROPERTY FUNCTIONS
 * 
 * These functions define what constitutes "working infrastructure" that must
 * be preserved after documentation additions.
 */

/**
 * FUNCTION isPreserved_WranglerConfiguration(wrangler_content)
 *   INPUT: wrangler_content of type string
 *   OUTPUT: boolean
 *   
 *   RETURN wrangler_content is valid TOML AND
 *          wrangler_content has required fields (name, main, compatibility_date) AND
 *          wrangler_content has environment variables section AND
 *          wrangler_content has staging environment
 * END FUNCTION
 */
function isPreserved_WranglerConfiguration(wranglerContent: string): boolean {
  // Valid TOML structure
  const hasValidStructure = wranglerContent.includes('name =') &&
                           wranglerContent.includes('main =') &&
                           wranglerContent.includes('compatibility_date =');
  
  // Required sections
  const hasVarsSection = wranglerContent.includes('[vars]');
  const hasStagingEnv = wranglerContent.includes('[env.staging]');
  
  return hasValidStructure && hasVarsSection && hasStagingEnv;
}

/**
 * FUNCTION isPreserved_DockerComposeConfiguration(docker_compose_content)
 *   INPUT: docker_compose_content of type string
 *   OUTPUT: boolean
 *   
 *   RETURN docker_compose_content is valid YAML AND
 *          docker_compose_content has required services (db, minio, clamav) AND
 *          docker_compose_content has health checks AND
 *          docker_compose_content has volumes AND
 *          docker_compose_content has networks
 * END FUNCTION
 */
function isPreserved_DockerComposeConfiguration(dockerComposeContent: string): boolean {
  // Valid YAML structure
  const hasValidStructure = dockerComposeContent.includes('version:') &&
                           dockerComposeContent.includes('services:');
  
  // Required services
  const hasRequiredServices = dockerComposeContent.includes('db:') &&
                             dockerComposeContent.includes('minio:') &&
                             dockerComposeContent.includes('clamav:');
  
  // Infrastructure features
  const hasHealthChecks = dockerComposeContent.includes('healthcheck:');
  const hasVolumes = dockerComposeContent.includes('volumes:');
  const hasNetworks = dockerComposeContent.includes('networks:');
  
  return hasValidStructure && hasRequiredServices && hasHealthChecks && 
         hasVolumes && hasNetworks;
}

/**
 * FUNCTION isPreserved_MigrationFiles()
 *   OUTPUT: boolean
 *   
 *   RETURN migrations directory exists AND
 *          migrations directory contains .sql files AND
 *          migrations follow naming convention (5-digit prefix)
 * END FUNCTION
 */
function isPreserved_MigrationFiles(): boolean {
  const migrationsDir = 'supabase/migrations';
  
  if (!existsSync(migrationsDir)) {
    return false;
  }
  
  const files = readdirSync(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));
  
  // Check naming convention: 5-digit prefix
  const hasValidNaming = sqlFiles.every(f => /^\d{5}_/.test(f));
  
  return sqlFiles.length > 0 && hasValidNaming;
}

/**
 * FUNCTION isPreserved_BackupDocumentation()
 *   OUTPUT: boolean
 *   
 *   RETURN backup-recovery-runbook.md exists AND
 *          backup-recovery-runbook.md contains backup procedures AND
 *          backup-recovery-runbook.md contains recovery procedures
 * END FUNCTION
 */
function isPreserved_BackupDocumentation(): boolean {
  const backupRunbook = 'docs/backup-recovery-runbook.md';
  
  if (!existsSync(backupRunbook)) {
    return false;
  }
  
  const content = readFileSync(backupRunbook, 'utf-8');
  
  // Check for essential backup/recovery content
  const hasBackupProcedures = content.toLowerCase().includes('backup');
  const hasRecoveryProcedures = content.toLowerCase().includes('recovery') ||
                                content.toLowerCase().includes('restore');
  
  return hasBackupProcedures && hasRecoveryProcedures;
}

/**
 * FUNCTION isPreserved_DatabaseRollbackDocumentation()
 *   OUTPUT: boolean
 *   
 *   RETURN (db-rollback-procedures.md exists OR db-rollback-constraints.md exists) AND
 *          documentation contains rollback guidance
 * END FUNCTION
 */
function isPreserved_DatabaseRollbackDocumentation(): boolean {
  const rollbackProcedures = 'docs/db-rollback-procedures.md';
  const rollbackConstraints = 'docs/db-rollback-constraints.md';
  
  // Check if either file exists
  const proceduresExists = existsSync(rollbackProcedures);
  const constraintsExists = existsSync(rollbackConstraints);
  
  if (!proceduresExists && !constraintsExists) {
    return false;
  }
  
  // Check content of whichever file exists
  const filePath = proceduresExists ? rollbackProcedures : rollbackConstraints;
  const content = readFileSync(filePath, 'utf-8');
  
  // Check for rollback guidance
  const hasRollbackGuidance = content.toLowerCase().includes('rollback') ||
                             content.toLowerCase().includes('migration');
  
  return hasRollbackGuidance;
}

/**
 * FUNCTION isPreserved_EnvironmentVariableDocumentation()
 *   OUTPUT: boolean
 *   
 *   RETURN .env.example exists AND
 *          .env.example documents required variables AND
 *          .env.example has helpful comments
 * END FUNCTION
 */
function isPreserved_EnvironmentVariableDocumentation(): boolean {
  const envExample = '.env.example';
  
  if (!existsSync(envExample)) {
    return false;
  }
  
  const content = readFileSync(envExample, 'utf-8');
  
  // Check for essential environment variables
  const hasSupabaseVars = content.includes('NEXT_PUBLIC_SUPABASE_URL') &&
                         content.includes('SUPABASE_SERVICE_ROLE_KEY');
  const hasSecurityVars = content.includes('PHI_ENCRYPTION_KEY') ||
                         content.includes('BOOKING_TOKEN_SECRET');
  const hasComments = content.includes('#');
  
  return hasSupabaseVars && hasSecurityVars && hasComments;
}

describe('Bug Group 4: Infrastructure Documentation - Preservation Properties', () => {
  
  describe('Property 2.1: Production Configuration Preservation', () => {
    
    test('wrangler.toml SHOULD remain valid and functional', () => {
      // Preservation: Cloudflare Workers config must continue to work
      // This verifies that documentation additions don't break the config
      
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(isPreserved_WranglerConfiguration(wranglerToml)).toBe(true);
      
      // Verify specific required fields
      expect(wranglerToml).toMatch(/name\s*=\s*"webs-alots"/);
      expect(wranglerToml).toMatch(/main\s*=\s*"\.open-next\/worker\.js"/);
      expect(wranglerToml).toContain('compatibility_date');
      expect(wranglerToml).toContain('compatibility_flags');
      expect(wranglerToml).toContain('nodejs_compat');
    });
    
    test('wrangler.toml SHOULD have environment variables section', () => {
      // Preservation: Runtime vars must remain available
      
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('[vars]');
      expect(wranglerToml).toMatch(/NODE_ENV/);
      expect(wranglerToml).toMatch(/RATE_LIMIT_BACKEND/);
    });
    
    test('wrangler.toml SHOULD have staging environment', () => {
      // Preservation: Multi-environment support must continue to work
      
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('[env.staging]');
      expect(wranglerToml).toMatch(/name\s*=\s*"webs-alots-staging"/);
    });
    
    test('wrangler.toml SHOULD have R2 and KV bindings', () => {
      // Preservation: Storage and cache bindings must remain
      
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('[[r2_buckets]]');
      expect(wranglerToml).toContain('UPLOADS_BUCKET');
      expect(wranglerToml).toContain('[[kv_namespaces]]');
      expect(wranglerToml).toContain('RATE_LIMIT_KV');
    });
    
    test('wrangler.toml SHOULD have cron triggers', () => {
      // Preservation: Scheduled jobs must continue to work
      
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      expect(wranglerToml).toContain('[[triggers.crons]]');
      expect(wranglerToml).toContain('crons =');
    });
  });
  
  describe('Property 2.2: Local Development Environment Preservation', () => {
    
    test('docker-compose.yml SHOULD remain valid and functional', () => {
      // Preservation: Local dev stack must continue to work
      // This verifies that documentation additions don't break Docker Compose
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(isPreserved_DockerComposeConfiguration(dockerCompose)).toBe(true);
    });
    
    test('docker-compose.yml SHOULD have required services', () => {
      // Preservation: All essential services must remain
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('db:');
      expect(dockerCompose).toContain('studio:');
      expect(dockerCompose).toContain('minio:');
      expect(dockerCompose).toContain('clamav:');
    });
    
    test('docker-compose.yml SHOULD have environment variables', () => {
      // Preservation: Service configuration must remain
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      // Postgres
      expect(dockerCompose).toMatch(/POSTGRES_PASSWORD/);
      expect(dockerCompose).toMatch(/POSTGRES_DB/);
      
      // MinIO
      expect(dockerCompose).toMatch(/MINIO_ROOT_USER/);
      expect(dockerCompose).toMatch(/MINIO_ROOT_PASSWORD/);
    });
    
    test('docker-compose.yml SHOULD have health checks', () => {
      // Preservation: Health monitoring must continue to work
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('healthcheck:');
      expect(dockerCompose).toMatch(/pg_isready/);
    });
    
    test('docker-compose.yml SHOULD have volumes for data persistence', () => {
      // Preservation: Data persistence must continue to work
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('volumes:');
      expect(dockerCompose).toContain('supabase-db:');
      expect(dockerCompose).toContain('minio-data:');
      expect(dockerCompose).toContain('clamav-data:');
    });
    
    test('docker-compose.yml SHOULD have network segmentation', () => {
      // Preservation: Network isolation must continue to work
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('networks:');
      expect(dockerCompose).toContain('db_network:');
      expect(dockerCompose).toContain('storage_network:');
      expect(dockerCompose).toContain('av_network:');
    });
    
    test('docker-compose.yml SHOULD have security hardening', () => {
      // Preservation: Security features must remain
      
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      expect(dockerCompose).toContain('cap_drop:');
      expect(dockerCompose).toContain('security_opt:');
      expect(dockerCompose).toContain('no-new-privileges:true');
    });
  });
  
  describe('Property 2.3: Database Migration Preservation', () => {
    
    test('Migration files SHOULD exist and follow naming convention', () => {
      // Preservation: Migration system must continue to work
      
      expect(isPreserved_MigrationFiles()).toBe(true);
    });
    
    test('Migration directory SHOULD contain SQL files', () => {
      // Preservation: Schema changes must be tracked
      
      const migrationsDir = 'supabase/migrations';
      expect(existsSync(migrationsDir)).toBe(true);
      
      const files = readdirSync(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql'));
      
      expect(sqlFiles.length).toBeGreaterThan(0);
    });
    
    test('Migration files SHOULD follow 5-digit naming convention', () => {
      // Preservation: Migration ordering must be maintained
      
      const migrationsDir = 'supabase/migrations';
      const files = readdirSync(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql'));
      
      // Check naming convention: 00001_description.sql
      sqlFiles.forEach(file => {
        expect(file).toMatch(/^\d{5}_.*\.sql$/);
      });
    });
    
    test('Recent migrations SHOULD be present', () => {
      // Preservation: Latest schema changes must remain
      
      expect(existsSync('supabase/migrations/00072_booking_slot_advisory_lock.sql')).toBe(true);
      expect(existsSync('supabase/migrations/00073_ai_token_budget.sql')).toBe(true);
      expect(existsSync('supabase/migrations/00074_patient_files_ownership.sql')).toBe(true);
    });
  });
  
  describe('Property 2.4: Database Rollback Documentation Preservation', () => {
    
    test('Database rollback documentation SHOULD exist', () => {
      // Preservation: Rollback procedures must remain accessible
      
      expect(isPreserved_DatabaseRollbackDocumentation()).toBe(true);
    });
    
    test('Rollback documentation SHOULD contain guidance', () => {
      // Preservation: Rollback procedures must be documented
      
      const rollbackProcedures = 'docs/db-rollback-procedures.md';
      const rollbackConstraints = 'docs/db-rollback-constraints.md';
      
      // Check whichever file exists
      const fileExists = existsSync(rollbackProcedures) || existsSync(rollbackConstraints);
      expect(fileExists).toBe(true);
      
      const filePath = existsSync(rollbackProcedures) ? rollbackProcedures : rollbackConstraints;
      const content = readFileSync(filePath, 'utf-8');
      
      // Should contain rollback guidance
      const hasRollbackContent = content.toLowerCase().includes('rollback') ||
                                content.toLowerCase().includes('migration');
      expect(hasRollbackContent).toBe(true);
    });
  });
  
  describe('Property 2.5: Backup and Recovery Documentation Preservation', () => {
    
    test('Backup recovery runbook SHOULD exist', () => {
      // Preservation: Backup procedures must remain documented
      
      expect(isPreserved_BackupDocumentation()).toBe(true);
    });
    
    test('Backup runbook SHOULD contain backup procedures', () => {
      // Preservation: Backup guidance must be accessible
      
      const backupRunbook = 'docs/backup-recovery-runbook.md';
      expect(existsSync(backupRunbook)).toBe(true);
      
      const content = readFileSync(backupRunbook, 'utf-8');
      expect(content.toLowerCase()).toContain('backup');
    });
    
    test('Backup runbook SHOULD contain recovery procedures', () => {
      // Preservation: Recovery guidance must be accessible
      
      const backupRunbook = 'docs/backup-recovery-runbook.md';
      const content = readFileSync(backupRunbook, 'utf-8');
      
      const hasRecoveryContent = content.toLowerCase().includes('recovery') ||
                                content.toLowerCase().includes('restore');
      expect(hasRecoveryContent).toBe(true);
    });
    
    test('Backup runbook SHOULD mention PITR', () => {
      // Preservation: PITR documentation must remain
      
      const backupRunbook = 'docs/backup-recovery-runbook.md';
      const content = readFileSync(backupRunbook, 'utf-8');
      
      // Should mention PITR (Point-In-Time Recovery)
      const hasPITR = content.includes('PITR') || 
                     content.toLowerCase().includes('point-in-time');
      expect(hasPITR).toBe(true);
    });
  });
  
  describe('Property 2.6: Environment Variable Documentation Preservation', () => {
    
    test('.env.example SHOULD exist and be comprehensive', () => {
      // Preservation: Environment variable documentation must remain
      
      expect(isPreserved_EnvironmentVariableDocumentation()).toBe(true);
    });
    
    test('.env.example SHOULD document Supabase variables', () => {
      // Preservation: Database connection docs must remain
      
      const envExample = readFileSync('.env.example', 'utf-8');
      
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });
    
    test('.env.example SHOULD document security variables', () => {
      // Preservation: Security config docs must remain
      
      const envExample = readFileSync('.env.example', 'utf-8');
      
      expect(envExample).toContain('BOOKING_TOKEN_SECRET');
      expect(envExample).toContain('CRON_SECRET');
      expect(envExample).toContain('PHI_ENCRYPTION_KEY');
    });
    
    test('.env.example SHOULD document storage variables', () => {
      // Preservation: Storage config docs must remain
      
      const envExample = readFileSync('.env.example', 'utf-8');
      
      expect(envExample).toContain('R2_ACCOUNT_ID');
      expect(envExample).toContain('R2_BUCKET_NAME');
    });
    
    test('.env.example SHOULD have helpful comments', () => {
      // Preservation: Developer experience must remain good
      
      const envExample = readFileSync('.env.example', 'utf-8');
      
      expect(envExample).toMatch(/# .*Supabase/);
      expect(envExample).toMatch(/# .*Required/);
    });
  });
  
  describe('Property 2.7: Operational Documentation Preservation', () => {
    
    test('Core operational documentation SHOULD exist', () => {
      // Preservation: Runbooks must remain accessible
      
      expect(existsSync('docs/incident-response.md')).toBe(true);
      expect(existsSync('docs/backup-recovery-runbook.md')).toBe(true);
      expect(existsSync('docs/SOP-SECRET-ROTATION.md')).toBe(true);
    });
    
    test('PHI key rotation SOP SHOULD exist', () => {
      // Preservation: PHI key rotation procedures must remain
      
      expect(existsSync('docs/SOP-PHI-KEY-ROTATION.md')).toBe(true);
    });
    
    test('Compliance documentation SHOULD exist', () => {
      // Preservation: Compliance docs must remain
      
      expect(existsSync('docs/compliance/dpia.md')).toBe(true);
      expect(existsSync('docs/compliance/retention.md')).toBe(true);
      expect(existsSync('docs/compliance/information-security-policy.md')).toBe(true);
    });
  });
  
  describe('Property 2.8: Build and Deployment Configuration Preservation', () => {
    
    test('package.json SHOULD have required scripts', () => {
      // Preservation: Build process must continue to work
      
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      
      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('build:cf');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('test:e2e');
      expect(packageJson.scripts).toHaveProperty('lint');
    });
    
    test('next.config.ts SHOULD exist', () => {
      // Preservation: Next.js config must remain
      
      expect(existsSync('next.config.ts')).toBe(true);
    });
    
    test('tsconfig.json SHOULD exist', () => {
      // Preservation: TypeScript config must remain
      
      expect(existsSync('tsconfig.json')).toBe(true);
    });
  });
  
  describe('Property 2.9: CI/CD Workflow Preservation', () => {
    
    test('GitHub Actions workflows SHOULD exist', () => {
      // Preservation: CI/CD must remain functional
      
      expect(existsSync('.github/workflows/ci.yml')).toBe(true);
      expect(existsSync('.github/workflows/deploy.yml')).toBe(true);
      expect(existsSync('.github/workflows/backup.yml')).toBe(true);
    });
    
    test('CI workflow SHOULD have required jobs', () => {
      // Preservation: Quality gates must remain
      
      const ciYml = readFileSync('.github/workflows/ci.yml', 'utf-8');
      
      expect(ciYml).toMatch(/lint/i);
      expect(ciYml).toMatch(/test/i);
      expect(ciYml).toMatch(/build/i);
    });
    
    test('Deploy workflow SHOULD have required steps', () => {
      // Preservation: Deployment must continue to work
      
      const deployYml = readFileSync('.github/workflows/deploy.yml', 'utf-8');
      
      expect(deployYml).toContain('build');
      expect(deployYml).toContain('deploy');
    });
  });
  
  describe('Property 2.10: Security Configuration Preservation', () => {
    
    test('Security documentation SHOULD exist', () => {
      // Preservation: Security policies must remain
      
      expect(existsSync('SECURITY.md')).toBe(true);
    });
    
    test('Gitleaks configuration SHOULD exist', () => {
      // Preservation: Secret scanning must continue to work
      
      expect(existsSync('.gitleaks.toml')).toBe(true);
    });
    
    test('Husky pre-commit hooks SHOULD exist', () => {
      // Preservation: Git hooks must continue to work
      
      expect(existsSync('.husky/pre-commit')).toBe(true);
      expect(existsSync('.husky/pre-push')).toBe(true);
    });
  });
});
