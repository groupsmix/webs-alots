import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';

/**
 * Phase 2: Infrastructure Security Hardening Bug Condition Exploration Tests
 * 
 * Property 1: Bug Condition - Infrastructure Security Hardening Gaps
 * 
 * CRITICAL: These tests MUST FAIL on unfixed infrastructure
 * - Failure confirms the security gaps exist
 * - DO NOT fix the tests or infrastructure when they fail
 * - These tests encode the expected secure behavior
 * - They will validate the fixes when they pass after implementation
 * 
 * GOAL: Surface counterexamples demonstrating security gaps across 11 categories:
 * 1. IaC Security (Docker, wrangler.toml, Supabase config)
 * 2. CI/CD Security (GitHub Actions, Semgrep, tokens)
 * 3. Cloud IAM (MFA, token scoping)
 * 4. Public Endpoints (WAF, rate limiting)
 * 5. Storage Security (R2 versioning, object-lock)
 * 6. Secret Management (plaintext, rotation)
 * 7. Network Segmentation (egress filtering)
 * 8. Monitoring (observability, alerting)
 * 9. Observability Privacy (PII redaction, Sentry)
 * 10. Cost Control (CPU limits, billing alarms)
 * 11. Cron Jobs (IaC schedules, idempotency)
 */

test.describe('Phase 2: Infrastructure Security Bug Condition Exploration', () => {
  
  test.describe('1. IaC Security (A31)', () => {
    
    test('Docker services SHOULD be bound to 127.0.0.1, not 0.0.0.0', () => {
      // Bug Condition: Docker ports bound to 0.0.0.0 expose services to any network interface
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      // Expected: All port bindings should use 127.0.0.1 prefix
      // Current (buggy): Ports are bound to 0.0.0.0 by default
      
      // Check Postgres port
      expect(dockerCompose).toContain('127.0.0.1:54322:5432');
      
      // Check Studio port
      expect(dockerCompose).toContain('127.0.0.1:54323');
      
      // Check MinIO ports
      expect(dockerCompose).toContain('127.0.0.1:9000:9000');
      expect(dockerCompose).toContain('127.0.0.1:9001:9001');
      
      // Verify no 0.0.0.0 bindings exist
      expect(dockerCompose).not.toMatch(/^\s+- "54322:5432"/m);
      expect(dockerCompose).not.toMatch(/^\s+- "54323:/m);
      expect(dockerCompose).not.toMatch(/^\s+- "9000:9000"/m);
      expect(dockerCompose).not.toMatch(/^\s+- "9001:9001"/m);
    });
    
    test('Docker images SHOULD be pinned to SHA256 digests, not floating tags', () => {
      // Bug Condition: Floating tags allow tag mutation attacks
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      // Expected: Images should use @sha256:... digests
      // Current (buggy): Images use floating tags like :15.8.1.145, :20240101, :latest
      
      // Check for SHA256 digest pinning
      expect(dockerCompose).toMatch(/supabase\/postgres@sha256:[a-f0-9]{64}/);
      expect(dockerCompose).toMatch(/supabase\/studio@sha256:[a-f0-9]{64}/);
      expect(dockerCompose).toMatch(/minio\/minio@sha256:[a-f0-9]{64}/);
      
      // Verify no floating tags
      expect(dockerCompose).not.toContain('supabase/postgres:');
      expect(dockerCompose).not.toContain('supabase/studio:');
      expect(dockerCompose).not.toContain('minio/minio:latest');
    });
    
    test('Docker credentials SHOULD use environment variables, not hard-coded values', () => {
      // Bug Condition: Hard-coded credentials committed to repository
      const dockerCompose = readFileSync('docker-compose.yml', 'utf-8');
      
      // Expected: Credentials should use ${VAR} syntax
      // Current (buggy): Hard-coded postgres/minioadmin credentials
      
      expect(dockerCompose).toContain('${POSTGRES_PASSWORD}');
      expect(dockerCompose).toContain('${MINIO_ROOT_USER}');
      expect(dockerCompose).toContain('${MINIO_ROOT_PASSWORD}');
      
      // Verify no hard-coded credentials
      expect(dockerCompose).not.toContain('POSTGRES_PASSWORD: postgres');
      expect(dockerCompose).not.toContain('MINIO_ROOT_USER: minioadmin');
      expect(dockerCompose).not.toContain('MINIO_ROOT_PASSWORD: minioadmin');
    });
    
    test('wrangler.toml SHOULD have KV/R2 bindings uncommented', () => {
      // Bug Condition: Bindings commented out force production config to live in dashboard
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      // Expected: Bindings should be active (not commented)
      // Current (buggy): [[kv_namespaces]] and [[r2_buckets]] are commented out
      
      expect(wranglerToml).toMatch(/^\[\[kv_namespaces\]\]/m);
      expect(wranglerToml).toMatch(/^\[\[r2_buckets\]\]/m);
      
      // Verify not commented
      expect(wranglerToml).not.toMatch(/^#\s*\[\[kv_namespaces\]\]/m);
      expect(wranglerToml).not.toMatch(/^#\s*\[\[r2_buckets\]\]/m);
    });
    
    test('wrangler.toml SHOULD have CPU limits set', () => {
      // Bug Condition: No CPU ceiling allows unbounded cost
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      // Expected: cpu_ms should be set to 50
      // Current (buggy): cpu_ms is commented out
      
      expect(wranglerToml).toMatch(/^cpu_ms\s*=\s*50/m);
      expect(wranglerToml).not.toMatch(/^#\s*cpu_ms/m);
    });
    
    test('wrangler.toml SHOULD have observability enabled', () => {
      // Bug Condition: Observability disabled prevents Workers Logs collection
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      // Expected: [observability] block should be active
      // Current (buggy): observability is commented out
      
      expect(wranglerToml).toMatch(/^\[observability\]/m);
      expect(wranglerToml).toMatch(/^enabled\s*=\s*true/m);
      
      // Verify not commented
      expect(wranglerToml).not.toMatch(/^#\s*\[observability\]/m);
    });
    
    test('wrangler.toml SHOULD have cron schedules declared', () => {
      // Bug Condition: Cron schedules only in dashboard cause configuration drift
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      // Expected: [[triggers]].crons should be declared
      // Current (buggy): No cron schedules in IaC
      
      expect(wranglerToml).toMatch(/\[\[triggers\]\]/);
      expect(wranglerToml).toMatch(/crons\s*=\s*\[/);
      
      // Check for specific schedules
      expect(wranglerToml).toContain('"0 */6 * * *"'); // r2-sync
      expect(wranglerToml).toContain('"0 9 * * *"');   // reminders
      expect(wranglerToml).toContain('"0 0 * * *"');   // billing
    });
    
    test('supabase/config.toml SHOULD exist with security configuration', () => {
      // Bug Condition: Missing config leaves encryption, JWT, MFA unconfigured
      
      // Expected: supabase/config.toml should exist
      // Current (buggy): File is absent
      
      expect(existsSync('supabase/config.toml')).toBe(true);
      
      if (existsSync('supabase/config.toml')) {
        const config = readFileSync('supabase/config.toml', 'utf-8');
        
        // Verify security settings
        expect(config).toContain('[auth]');
        expect(config).toMatch(/jwt_expiry\s*=\s*3600/); // 1 hour
        expect(config).toMatch(/enable_mfa\s*=\s*true/);
        expect(config).toContain('[email]');
        expect(config).toMatch(/rate_limit\s*=\s*10/); // 10/hour
      }
    });
  });
  
  test.describe('2. CI/CD Security (A34)', () => {
    
    test('GitHub Actions SHOULD be pinned to full commit SHAs', () => {
      // Bug Condition: Floating tags create supply chain risk
      const ciYml = readFileSync('.github/workflows/ci.yml', 'utf-8');
      const deployYml = readFileSync('.github/workflows/deploy.yml', 'utf-8');
      
      // Expected: Actions should use @<40-char-sha>
      // Current (buggy): Actions use @v4, @v6, @v7 floating tags
      
      // Check ci.yml
      expect(ciYml).not.toMatch(/uses:.*@v\d+/);
      expect(ciYml).toMatch(/uses:.*@[a-f0-9]{40}/);
      
      // Check deploy.yml
      expect(deployYml).not.toMatch(/uses:.*@v\d+/);
      expect(deployYml).toMatch(/uses:.*@[a-f0-9]{40}/);
    });
    
    test('Semgrep SHOULD fail on security findings, not continue-on-error', () => {
      // Bug Condition: Soft-fail causes security findings to be silently dropped
      const ciYml = readFileSync('.github/workflows/ci.yml', 'utf-8');
      
      // Expected: Semgrep step should not have continue-on-error
      // Current (buggy): continue-on-error: true and || true
      
      const semgrepSection = ciYml.match(/semgrep[\s\S]*?(?=\n\s*-\s*name:|$)/i);
      if (semgrepSection) {
        expect(semgrepSection[0]).not.toContain('continue-on-error: true');
        expect(semgrepSection[0]).not.toContain('|| true');
      }
    });
    
    test('Deployment SHOULD use environment-scoped Cloudflare tokens', () => {
      // Bug Condition: Single token for prod+staging increases blast radius
      const deployYml = readFileSync('.github/workflows/deploy.yml', 'utf-8');
      
      // Expected: Separate CLOUDFLARE_API_TOKEN_PROD and _STAGING
      // Current (buggy): Single CLOUDFLARE_API_TOKEN
      
      expect(deployYml).toContain('CLOUDFLARE_API_TOKEN_PROD');
      expect(deployYml).toContain('CLOUDFLARE_API_TOKEN_STAGING');
      
      // Verify not using single token
      const singleTokenUsage = deployYml.match(/CLOUDFLARE_API_TOKEN(?!_PROD|_STAGING)/g);
      expect(singleTokenUsage).toBeNull();
    });
  });
  
  test.describe('3. Cloud IAM (A35)', () => {
    
    test('IAM policy documentation SHOULD exist', () => {
      // Bug Condition: No documented token scoping, IP restrictions, expiry
      
      // Expected: docs/iam-policy.md should exist with scoping details
      // Current (buggy): No IAM policy documentation
      
      expect(existsSync('docs/iam-policy.md')).toBe(true);
      
      if (existsSync('docs/iam-policy.md')) {
        const policy = readFileSync('docs/iam-policy.md', 'utf-8');
        
        expect(policy).toContain('R2 tokens');
        expect(policy).toContain('Cloudflare API tokens');
        expect(policy).toContain('SUPABASE_SERVICE_ROLE_KEY');
        expect(policy).toContain('MFA');
        expect(policy).toContain('90-day expiry');
      }
    });
    
    test('Impersonation route SHOULD require MFA', () => {
      // Bug Condition: No MFA step-up before impersonation
      
      if (existsSync('src/app/api/admin/impersonate/route.ts')) {
        const route = readFileSync('src/app/api/admin/impersonate/route.ts', 'utf-8');
        
        // Expected: requireMfa() check before granting token
        // Current (buggy): No MFA requirement
        
        expect(route).toContain('requireMfa');
      }
    });
  });
  
  test.describe('4. Public Endpoint Security (A36)', () => {
    
    test('wrangler.toml SHOULD have routes uncommented', () => {
      // Bug Condition: Routes commented out force TLS config to dashboard
      const wranglerToml = readFileSync('wrangler.toml', 'utf-8');
      
      // Expected: routes should be active
      // Current (buggy): routes are commented out
      
      expect(wranglerToml).toMatch(/^routes\s*=\s*\[/m);
      expect(wranglerToml).not.toMatch(/^#\s*routes/m);
    });
    
    test('middleware SHOULD have global rate-limit fallback', () => {
      // Bug Condition: Missing fallback allows rate-limit bypass
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      // Expected: rateLimitRules.set("/*", ...)
      // Current (buggy): No global fallback
      
      expect(middleware).toMatch(/rateLimitRules\.set\s*\(\s*["']\/\*["']/);
    });
    
    test('middleware SHOULD validate IP extraction against trusted proxies', () => {
      // Bug Condition: Trusting headers without validation enables IP spoofing
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      // Expected: TRUSTED_PROXIES constant with Cloudflare IP ranges
      // Current (buggy): No proxy validation
      
      expect(middleware).toContain('TRUSTED_PROXIES');
      expect(middleware).toMatch(/CF-Connecting-IP/);
    });
  });
  
  test.describe('5. Storage Security (A37)', () => {
    
    test('r2-lifecycle.json SHOULD have comprehensive lifecycle rules', () => {
      // Bug Condition: Only one rule (abort multipart), no expiration/versioning
      const lifecycle = JSON.parse(readFileSync('r2-lifecycle.json', 'utf-8'));
      
      // Expected: Multiple rules for expiration, versioning, NCV
      // Current (buggy): Only abort-incomplete-multipart rule
      
      expect(lifecycle.rules.length).toBeGreaterThan(1);
      
      const ruleIds = lifecycle.rules.map((r: any) => r.id);
      expect(ruleIds).toContain('expire-backups-90d');
      expect(ruleIds).toContain('expire-noncurrent-versions-30d');
      expect(ruleIds).toContain('delete-noncurrent-versions-7d');
    });
    
    test('R2 security documentation SHOULD exist', () => {
      // Bug Condition: No documented versioning, object-lock, access logging
      
      // Expected: docs/r2-security.md with comprehensive config
      // Current (buggy): No R2 security documentation
      
      expect(existsSync('docs/r2-security.md')).toBe(true);
      
      if (existsSync('docs/r2-security.md')) {
        const doc = readFileSync('docs/r2-security.md', 'utf-8');
        
        expect(doc).toContain('versioning');
        expect(doc).toContain('object-lock');
        expect(doc).toContain('WORM');
        expect(doc).toContain('access logging');
        expect(doc).toContain('antivirus');
        expect(doc).toContain('public-access block');
      }
    });
  });
  
  test.describe('6. Secret Management (A38)', () => {
    
    test('.env.example SHOULD use Vault/KMS references, not plaintext', () => {
      // Bug Condition: Plaintext secrets in documentation
      const envExample = readFileSync('.env.example', 'utf-8');
      
      // Expected: vault:// or kms:// references
      // Current (buggy): Plaintext secret values
      
      expect(envExample).toMatch(/vault:\/\//);
      expect(envExample).toMatch(/SUPABASE_SERVICE_ROLE_KEY=vault:\/\//);
      
      // Verify no plaintext JWT tokens
      expect(envExample).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
    });
    
    test('SOP-SECRET-ROTATION.md SHOULD document automated rotation', () => {
      // Bug Condition: No rotation cadence enforcement
      
      if (existsSync('docs/SOP-SECRET-ROTATION.md')) {
        const sop = readFileSync('docs/SOP-SECRET-ROTATION.md', 'utf-8');
        
        // Expected: Automated workflow with 90-day cadence
        // Current (buggy): Only manual SOPs
        
        expect(sop).toContain('automated');
        expect(sop).toContain('90-day');
        expect(sop).toContain('break-glass');
        expect(sop).toContain('kill-switch');
      }
    });
  });
  
  test.describe('7. Network Segmentation (A39)', () => {
    
    test('middleware SHOULD have egress filtering allowlist', () => {
      // Bug Condition: No egress filtering allows fetch() to arbitrary hosts
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      // Expected: ALLOWED_HOSTS constant with approved domains
      // Current (buggy): No egress filtering
      
      expect(middleware).toContain('ALLOWED_HOSTS');
      expect(middleware).toMatch(/api\.openai\.com/);
      expect(middleware).toMatch(/api\.stripe\.com/);
      expect(middleware).toMatch(/graph\.facebook\.com/);
    });
    
    test('CMI webhook SHOULD have IP allowlist', () => {
      // Bug Condition: No source-IP validation for payment callbacks
      
      if (existsSync('src/app/api/webhooks/cmi/route.ts')) {
        const route = readFileSync('src/app/api/webhooks/cmi/route.ts', 'utf-8');
        
        // Expected: CMI_IP_RANGES constant with allowlist
        // Current (buggy): No IP filtering
        
        expect(route).toContain('CMI_IP_RANGES');
        expect(route).toMatch(/196\.200\./); // CMI IP range
      }
    });
  });
  
  test.describe('8. Monitoring & Observability (A40)', () => {
    
    test('Alerting configuration SHOULD exist', () => {
      // Bug Condition: No alerting code in repository
      
      // Expected: docs/alerting-config.yml with Cloudflare Alerts API config
      // Current (buggy): No alerting configuration
      
      expect(existsSync('docs/alerting-config.yml')).toBe(true);
      
      if (existsSync('docs/alerting-config.yml')) {
        const config = readFileSync('docs/alerting-config.yml', 'utf-8');
        
        expect(config).toContain('error rate');
        expect(config).toContain('latency');
        expect(config).toContain('billing anomaly');
      }
    });
    
    test('Chaos tests SHOULD exist', () => {
      // Bug Condition: No chaos test artifacts
      
      // Expected: e2e/chaos-tests.spec.ts
      // Current (buggy): No chaos tests
      
      expect(existsSync('e2e/chaos-tests.spec.ts')).toBe(true);
    });
    
    test('Health check SHOULD verify Supabase, R2, and tenant routing', () => {
      // Bug Condition: Health check only verifies basic ok:true
      const healthRoute = readFileSync('src/app/api/health/route.ts', 'utf-8');
      
      // Expected: Checks for Supabase, R2, tenant routing
      // Current (buggy): Only returns ok:true
      
      expect(healthRoute).toMatch(/supabase|database/i);
      expect(healthRoute).toMatch(/r2|storage/i);
      expect(healthRoute).toMatch(/tenant|subdomain/i);
    });
  });
  
  test.describe('9. Observability Privacy (A41)', () => {
    
    test('logger SHOULD redact PII fields', () => {
      // Bug Condition: No PII redaction allows emails, phones, names in logs
      const logger = readFileSync('src/lib/logger.ts', 'utf-8');
      
      // Expected: redactPhi() strips hostname, email, phone, name, r2Key
      // Current (buggy): No PII redaction
      
      expect(logger).toContain('redactPhi');
      expect(logger).toMatch(/hostname|email|phone|name|r2Key/);
    });
    
    test('Sentry SHOULD have beforeSend filter', () => {
      // Bug Condition: No beforeSend allows PHI in request bodies
      const sentryServer = readFileSync('sentry.server.config.ts', 'utf-8');
      const sentryClient = readFileSync('sentry.client.config.ts', 'utf-8');
      const sentryEdge = readFileSync('sentry.edge.config.ts', 'utf-8');
      
      // Expected: beforeSend: (event) => stripPhi(event)
      // Current (buggy): No beforeSend filter
      
      expect(sentryServer).toContain('beforeSend');
      expect(sentryClient).toContain('beforeSend');
      expect(sentryEdge).toContain('beforeSend');
      
      expect(sentryServer).toMatch(/stripPhi|redact/i);
    });
    
    test('Sentry PHI filter SHOULD exist', () => {
      // Bug Condition: No stripPhi() implementation
      
      // Expected: src/lib/sentry-phi-filter.ts
      // Current (buggy): No PHI filter module
      
      expect(existsSync('src/lib/sentry-phi-filter.ts')).toBe(true);
    });
    
    test('Log retention policy SHOULD be documented', () => {
      // Bug Condition: No log retention policy in code
      
      // Expected: docs/log-retention.md
      // Current (buggy): No retention policy
      
      expect(existsSync('docs/log-retention.md')).toBe(true);
      
      if (existsSync('docs/log-retention.md')) {
        const policy = readFileSync('docs/log-retention.md', 'utf-8');
        
        expect(policy).toContain('Sentry: 30 days');
        expect(policy).toContain('Workers Logs: 7 days');
        expect(policy).toContain('Audit logs: 7 years');
      }
    });
  });
  
  test.describe('10. Cost Control (A42)', () => {
    
    test('Billing alarms SHOULD be configured', () => {
      // Bug Condition: No billing anomaly alarm
      
      // Expected: docs/billing-alarms.yml
      // Current (buggy): No billing alarms
      
      expect(existsSync('docs/billing-alarms.yml')).toBe(true);
      
      if (existsSync('docs/billing-alarms.yml')) {
        const alarms = readFileSync('docs/billing-alarms.yml', 'utf-8');
        
        expect(alarms).toContain('cost > 2x baseline');
        expect(alarms).toContain('CPU usage > 80%');
        expect(alarms).toContain('KV read/write > 90%');
      }
    });
    
    test('AI budget SHOULD limit concurrent requests per clinic', () => {
      // Bug Condition: No per-clinic concurrent LLM call limit
      const aiBudget = readFileSync('src/lib/ai-budget.ts', 'utf-8');
      
      // Expected: checkConcurrentAiRequests() function
      // Current (buggy): No concurrent request limiting
      
      expect(aiBudget).toContain('checkConcurrentAiRequests');
      expect(aiBudget).toMatch(/max.*5.*concurrent/i);
    });
    
    test('middleware SHOULD have per-user and per-API-key rate limits', () => {
      // Bug Condition: No per-user/per-API-key limits at edge
      const middleware = readFileSync('src/middleware.ts', 'utf-8');
      
      // Expected: rateLimitByUser and rateLimitByApiKey
      // Current (buggy): Only per-IP rate limiting
      
      expect(middleware).toMatch(/rateLimitByUser|per.*user.*rate/i);
      expect(middleware).toMatch(/rateLimitByApiKey|per.*api.*key.*rate/i);
    });
  });
  
  test.describe('11. Cron Job Management (A43)', () => {
    
    test('Cron routes SHOULD have idempotency locks', () => {
      // Bug Condition: No idempotency prevents duplicate execution
      
      if (existsSync('src/app/api/cron/route.ts')) {
        const cronRoute = readFileSync('src/app/api/cron/route.ts', 'utf-8');
        
        // Expected: KV-based lock check before execution
        // Current (buggy): No idempotency mechanism
        
        expect(cronRoute).toMatch(/kv\.get.*lock/i);
        expect(cronRoute).toMatch(/idempotent|lock/i);
      }
    });
    
    test('Cron routes SHOULD have DLQ for failed runs', () => {
      // Bug Condition: No DLQ/retry queue for missed runs
      
      if (existsSync('src/app/api/cron/route.ts')) {
        const cronRoute = readFileSync('src/app/api/cron/route.ts', 'utf-8');
        
        // Expected: DLQ tracking in KV with retry logic
        // Current (buggy): No DLQ
        
        expect(cronRoute).toMatch(/dlq|dead.*letter|retry/i);
        expect(cronRoute).toMatch(/exponential.*backoff|retry.*3/i);
      }
    });
  });
});
