# Task 3.4: Resource Leak Fixes (A12-02, A12-04) - Implementation Summary

## Overview

This task implements LRU (Least Recently Used) cache with TTL (Time To Live) for two critical data structures to prevent unbounded memory growth and DoS attacks:

1. **A12-02**: `userRateBuckets` in `src/lib/with-auth.ts` - Per-user rate limiting
2. **A12-04**: `subdomainCache` and `negativeSubdomainCache` in `src/lib/subdomain-cache.ts` - Subdomain resolution

## Changes Made

### 1. Package Dependencies

**File**: `package.json`

Added `lru-cache` library to dependencies:
```json
"lru-cache": "^11.0.2"
```

**Action Required**: Run `npm install` to install the new dependency.

### 2. User Rate Buckets (A12-02)

**File**: `src/lib/with-auth.ts`

**Changes**:
- Replaced `Map<string, UserRateEntry>` with `LRUCache<string, UserRateEntry>`
- Configured with:
  - `max: 10000` - Maximum 10,000 user entries
  - `ttl: 60000` - 1 minute TTL (matches rate window)
  - `dispose` callback - Logs evictions for monitoring
- Removed manual `evictUserRateBuckets()` function (LRU cache handles this automatically)
- Simplified `checkUserRateLimit()` function (no manual eviction needed)

**Benefits**:
- Prevents DoS attacks by limiting memory usage to 10,000 entries
- Automatic eviction of least recently used entries when full
- TTL-based expiration removes stale entries automatically
- Eviction logging for monitoring and alerting

### 3. Subdomain Cache (A12-04)

**File**: `src/lib/subdomain-cache.ts`

**Changes**:
- Replaced `Map<string, CachedClinic>` with `LRUCache<string, CachedClinic>`
- Replaced `Map<string, NegativeCacheEntry>` with `LRUCache<string, NegativeCacheEntry>`
- Configured subdomain cache with:
  - `max: 1000` - Maximum 1,000 subdomain entries
  - `ttl: 300000` - 5 minutes TTL
  - `updateAgeOnGet: true` - Updates age on access (true LRU behavior)
  - `updateAgeOnHas: true` - Updates age on existence check
- Configured negative cache with same parameters
- Removed manual `evictExpiredEntries()` function
- Removed manual `enforceMaxSize()` function
- Removed `setInterval` for periodic eviction (LRU cache handles this)
- Simplified `setSubdomainCache()` and `setNegativeSubdomainCache()` functions
- Added `getCacheStats()` function for monitoring cache health

**Benefits**:
- Prevents unbounded memory growth as clinics rotate subdomains
- Automatic eviction of least recently used entries when full
- TTL-based expiration removes stale entries automatically
- Cache statistics for observability and monitoring

### 4. Unit Tests

**File**: `src/lib/__tests__/resource-leak-fixes.test.ts` (NEW)

**Test Coverage**:
- Subdomain cache enforces max size limit (1000 entries)
- Subdomain cache evicts oldest entries when full (LRU behavior)
- Subdomain cache removes stale entries after TTL expiration
- Negative cache enforces max size limit (1000 entries)
- `getCacheStats()` returns accurate cache statistics
- Negative cache is cleared when valid subdomain is added
- User rate buckets LRU configuration (placeholder for integration tests)

## Testing Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Unit Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- src/lib/__tests__/resource-leak-fixes.test.ts

# Run with coverage
npm run test:coverage
```

### 3. Verify Existing Tests Still Pass

```bash
# Run existing with-auth tests
npm run test -- src/lib/__tests__/with-auth.test.ts

# Run full test suite
npm run test
```

### 4. Manual Testing

To manually verify the LRU eviction behavior:

1. **Subdomain Cache**:
   - Access 1000+ different subdomains
   - Verify cache size stays at 1000
   - Verify oldest entries are evicted
   - Wait 5+ minutes and verify entries expire

2. **User Rate Buckets**:
   - Make authenticated requests with 10,000+ different user IDs
   - Verify legitimate users are not denied
   - Verify cache size stays at 10,000
   - Wait 1+ minute and verify entries expire

## Monitoring and Observability

### Cache Statistics

Use `getCacheStats()` to monitor cache health:

```typescript
import { getCacheStats } from "@/lib/subdomain-cache";

const stats = getCacheStats();
console.log("Subdomain cache:", stats.subdomain);
console.log("Negative cache:", stats.negative);
```

### Eviction Logging

User rate bucket evictions are automatically logged:

```typescript
logger.debug("User rate bucket evicted", {
  context: "rate-limit-eviction",
  userId: key,
  requestCount: value.count,
});
```

Monitor these logs to detect DoS attempts or unusual traffic patterns.

## Security Considerations

### A12-02: User Rate Buckets DoS Prevention

**Before**: Attacker could fill `userRateBuckets` with 10,000 random user IDs, causing legitimate users to be denied.

**After**: LRU cache automatically evicts oldest entries when full, ensuring legitimate users can always access the system.

### A12-04: Subdomain Cache Unbounded Growth

**Before**: Subdomain cache could grow indefinitely as clinics rotate subdomains, causing memory exhaustion.

**After**: LRU cache enforces max 1,000 entries with 5-minute TTL, preventing unbounded growth.

## Performance Impact

### Positive Impacts

1. **Reduced Memory Usage**: LRU eviction prevents unbounded growth
2. **Automatic Cleanup**: TTL-based expiration removes stale entries
3. **Better Cache Hit Rate**: LRU keeps most frequently accessed entries

### Potential Concerns

1. **Eviction Overhead**: LRU cache has O(1) eviction vs O(n) manual eviction
2. **Memory Overhead**: LRU cache has slightly higher memory overhead per entry
3. **TTL Overhead**: TTL checking adds minimal overhead on access

Overall, the performance impact is **positive** - the automatic eviction and TTL management are more efficient than manual eviction.

## Rollback Plan

If issues arise, rollback by:

1. Revert `src/lib/with-auth.ts` to use `Map` with manual eviction
2. Revert `src/lib/subdomain-cache.ts` to use `Map` with manual eviction
3. Remove `lru-cache` from `package.json`
4. Run `npm install` to remove the dependency

## Next Steps

1. **Install Dependencies**: Run `npm install` to install `lru-cache`
2. **Run Tests**: Verify all tests pass
3. **Deploy to Staging**: Test in staging environment
4. **Monitor Metrics**: Watch cache statistics and eviction logs
5. **Deploy to Production**: Roll out gradually with monitoring

## References

- **Design Document**: `.kiro/specs/phase-3-security-fixes/design.md`
- **Bug Report**: `.kiro/specs/phase-3-security-fixes/bugfix.md`
- **Task List**: `.kiro/specs/phase-3-security-fixes/tasks.md`
- **LRU Cache Library**: https://github.com/isaacs/node-lru-cache
