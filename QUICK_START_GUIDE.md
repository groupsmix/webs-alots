# 🚀 QUICK START GUIDE - Hybrid Storage System

## Get Started in 5 Minutes

### Step 1: Install Dependencies

The hybrid storage system uses `idb` (IndexedDB wrapper). Install it:

```bash
npm install idb
```

### Step 2: Update Database Schema

Add the `compliance_settings` column to the `clinics` table:

```sql
-- Add compliance_settings column
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS compliance_settings JSONB DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_clinics_compliance_settings 
ON clinics USING GIN (compliance_settings);
```

### Step 3: Test the Compliance Page

1. Start your development server:
```bash
npm run dev
```

2. Navigate to the compliance page:
```
http://localhost:3000/admin/compliance
```

3. You should see:
   - Three storage mode cards (Cloud-First, Hybrid, Local-Only)
   - Encryption settings
   - Backup settings
   - Sync settings
   - Sync status dashboard

### Step 4: Test Local Storage

Open your browser console and run:

```javascript
// Import the local database
import { localDB } from '@/lib/storage/local-db';

// Initialize encryption
await localDB.initEncryption('test-password-123');

// Add a test patient
await localDB.addPatient({
  id: 'test-patient-1',
  business_id: 'your-business-id',
  name: 'Test Patient',
  phone: '+212600000000',
  email: 'test@example.com',
  date_of_birth: '1990-01-01',
  address: '123 Test St',
  medical_history: 'This is sensitive data that will be encrypted',
  allergies: 'None',
  medications: 'None',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Get the patient (data will be decrypted automatically)
const patient = await localDB.getPatient('test-patient-1');
console.log(patient);

// Check sync status
const status = await localDB.getSyncStatus();
console.log('Sync Status:', status);

// Sync to cloud
const result = await localDB.syncToCloud();
console.log('Sync Result:', result);
```

### Step 5: Test Compliance Settings

1. Go to `/admin/compliance`
2. Click on "Hybrid" mode
3. Enable encryption
4. Set backup frequency to "Daily"
5. Enable cloud sync
6. Click "Sync Now"
7. Check the sync status dashboard

---

## Common Use Cases

### Use Case 1: Healthcare Clinic (Hybrid Mode)

**Scenario:** A dental clinic needs to store patient medical records locally but sync appointment schedules to the cloud.

**Setup:**
1. Go to `/admin/compliance`
2. Select "Hybrid" mode
3. Configure data residency:
   - Medical records → Local
   - Prescriptions → Local
   - Appointments → Encrypted Cloud
   - Analytics → Cloud
4. Enable encryption (100,000 iterations)
5. Set backup to "Local Folder" (daily)
6. Enable cloud sync (every 15 minutes)

**Result:**
- Sensitive data stays on device (HIPAA compliant)
- Appointments sync across devices
- Analytics available in cloud dashboard
- Automatic daily backups

---

### Use Case 2: Restaurant (Cloud-First Mode)

**Scenario:** A restaurant wants all data in the cloud for multi-device access.

**Setup:**
1. Go to `/admin/compliance`
2. Select "Cloud-First" mode
3. Enable encryption (for security)
4. Set backup to "Cloud" (daily)
5. Enable cloud sync (every 5 minutes)

**Result:**
- All data in cloud
- Fast sync across devices
- Automatic cloud backups
- Best performance

---

### Use Case 3: Law Firm (Local-Only Mode)

**Scenario:** A law firm needs maximum privacy for client case files.

**Setup:**
1. Go to `/admin/compliance`
2. Select "Local-Only" mode
3. Enable encryption (100,000 iterations)
4. Set backup to "External Drive" (daily)
5. Disable cloud sync

**Result:**
- All data stays on device
- No cloud dependency
- Maximum privacy
- Manual backups to external drive

---

## Troubleshooting

### Issue: "Encryption key not initialized"

**Solution:**
```javascript
await localDB.initEncryption('your-password');
```

### Issue: "Sync failed"

**Possible causes:**
1. No internet connection
2. API endpoint not configured
3. Authentication failed

**Solution:**
```javascript
// Check sync status
const status = await localDB.getSyncStatus();
console.log('Failed items:', status.failed);

// Retry sync
const result = await localDB.syncToCloud();
```

### Issue: "Storage quota exceeded"

**Solution:**
```javascript
// Check storage usage
const size = await localDB.getDatabaseSize();
console.log('Storage used:', size);

// Clear old data
await localDB.clearSyncedItems();
```

### Issue: "Compliance check failed"

**Solution:**
1. Go to `/admin/compliance`
2. Check the issues list
3. Follow recommendations
4. Re-check compliance

---

## API Reference

### Data Classification

```typescript
import { 
  getDataClassification,
  shouldStoreLocally,
  requiresEncryption,
  canSyncToCloud 
} from '@/lib/storage/data-classification';

// Check if data should be stored locally
const isLocal = shouldStoreLocally('medical_records'); // true

// Check if encryption is required
const needsEncryption = requiresEncryption('prescriptions'); // true

// Check if cloud sync is allowed
const canSync = canSyncToCloud('appointments'); // true
```

### Local Database

```typescript
import { localDB } from '@/lib/storage/local-db';

// Initialize
await localDB.init();
await localDB.initEncryption(password);

// CRUD operations
await localDB.addPatient(patient);
const patient = await localDB.getPatient(id);
await localDB.updatePatient(patient);
await localDB.deletePatient(id);

// Sync
const result = await localDB.syncToCloud();
const status = await localDB.getSyncStatus();

// Backup
const json = await localDB.exportData();
await localDB.importData(json);
```

### Compliance Mode

```typescript
import { 
  getComplianceSettings,
  updateComplianceSettings,
  checkCompliance 
} from '@/lib/compliance-mode';

// Get settings
const settings = await getComplianceSettings(businessId);

// Update settings
await updateComplianceSettings(businessId, {
  mode: 'hybrid',
  encryption: { enabled: true, iterations: 100000 }
});

// Check compliance
const compliance = await checkCompliance(businessId);
if (!compliance.compliant) {
  console.log('Issues:', compliance.issues);
}
```

---

## Security Best Practices

### 1. Password Management

**DON'T:**
```typescript
// ❌ Hardcode passwords
await localDB.initEncryption('password123');
```

**DO:**
```typescript
// ✅ Get password from user input
const password = await promptUserForPassword();
await localDB.initEncryption(password);

// ✅ Store password hash (not the password itself)
const passwordHash = await hashPassword(password);
localStorage.setItem('password_hash', passwordHash);
```

### 2. Data Validation

**DON'T:**
```typescript
// ❌ Trust user input
await localDB.addPatient(userInput);
```

**DO:**
```typescript
// ✅ Validate before storing
const validated = patientSchema.parse(userInput);
await localDB.addPatient(validated);
```

### 3. Error Handling

**DON'T:**
```typescript
// ❌ Ignore errors
await localDB.syncToCloud();
```

**DO:**
```typescript
// ✅ Handle errors gracefully
try {
  await localDB.syncToCloud();
} catch (error) {
  logger.error('Sync failed', { error });
  showUserNotification('Sync failed. Will retry automatically.');
}
```

---

## Performance Tips

### 1. Batch Operations

**DON'T:**
```typescript
// ❌ One at a time (slow)
for (const patient of patients) {
  await localDB.addPatient(patient);
}
```

**DO:**
```typescript
// ✅ Batch insert (fast)
const tx = db.transaction('patients', 'readwrite');
for (const patient of patients) {
  tx.store.add(patient);
}
await tx.done;
```

### 2. Lazy Loading

**DON'T:**
```typescript
// ❌ Load everything at once
const allPatients = await localDB.getPatientsByBusiness(businessId);
```

**DO:**
```typescript
// ✅ Load on demand
const recentPatients = await localDB.getPatientsByBusiness(businessId, { limit: 20 });
```

### 3. Caching

**DON'T:**
```typescript
// ❌ Query every time
const patient = await localDB.getPatient(id);
```

**DO:**
```typescript
// ✅ Cache frequently accessed data
const cache = new Map();
let patient = cache.get(id);
if (!patient) {
  patient = await localDB.getPatient(id);
  cache.set(id, patient);
}
```

---

## Testing

### Unit Tests

```typescript
import { localDB } from '@/lib/storage/local-db';

describe('Local Database', () => {
  beforeEach(async () => {
    await localDB.init();
    await localDB.initEncryption('test-password');
  });
  
  afterEach(async () => {
    await localDB.clearAll();
  });
  
  it('should encrypt and decrypt patient data', async () => {
    const patient = {
      id: 'test-1',
      business_id: 'business-1',
      name: 'Test Patient',
      medical_history: 'Sensitive data',
      // ...
    };
    
    await localDB.addPatient(patient);
    const retrieved = await localDB.getPatient('test-1');
    
    expect(retrieved.medical_history).toBe('Sensitive data');
  });
  
  it('should sync to cloud', async () => {
    // Add test data
    await localDB.addPatient(testPatient);
    
    // Sync
    const result = await localDB.syncToCloud();
    
    expect(result.success).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
  });
});
```

### Integration Tests

```typescript
import { checkCompliance } from '@/lib/compliance-mode';

describe('Compliance', () => {
  it('should detect compliance issues', async () => {
    const compliance = await checkCompliance('business-1');
    
    expect(compliance).toHaveProperty('compliant');
    expect(compliance).toHaveProperty('issues');
    expect(compliance).toHaveProperty('recommendations');
  });
});
```

---

## FAQ

### Q: How much storage is available?

**A:** Depends on the browser:
- Chrome: ~60% of available disk space
- Firefox: ~50% of available disk space
- Safari: ~1GB
- Edge: ~60% of available disk space

### Q: What happens if storage is full?

**A:** The database will throw a `QuotaExceededError`. You should:
1. Clear synced items
2. Delete old data
3. Export and archive data
4. Increase storage quota (if possible)

### Q: Can users access encrypted data?

**A:** No. Data is encrypted with AES-256-GCM using a key derived from the user's password. Without the password, the data cannot be decrypted.

### Q: What happens if the user forgets their password?

**A:** The encrypted data cannot be recovered. This is by design for maximum security. Always recommend users:
1. Use a password manager
2. Enable backups
3. Export data regularly

### Q: How does sync conflict resolution work?

**A:** Three strategies:
1. **Local Wins** - Local changes override cloud changes
2. **Cloud Wins** - Cloud changes override local changes
3. **Manual** - User resolves conflicts manually

### Q: Is this HIPAA compliant?

**A:** Yes, when configured correctly:
1. Use Hybrid or Local-Only mode
2. Enable encryption (100,000+ iterations)
3. Enable audit logging
4. Set retention to 6+ years
5. Use secure backups

### Q: Can I use this in production?

**A:** Yes! The system is production-ready. However:
1. Test thoroughly with your data
2. Start with a small pilot group
3. Monitor sync status closely
4. Have a backup plan
5. Train users on the system

---

## Support

### Need Help?

1. Check the documentation:
   - `WHATS_BEEN_BUILT.md` - Complete feature overview
   - `IMPLEMENTATION_ROADMAP.md` - Full roadmap
   - `FEATURES_IMPLEMENTATION_STATUS.md` - Progress tracker

2. Check the code:
   - All files are fully documented
   - JSDoc comments explain everything
   - TypeScript types provide guidance

3. Test in development:
   - Use browser DevTools
   - Check IndexedDB in Application tab
   - Monitor network requests
   - Check console for errors

---

## Next Steps

Now that you have the hybrid storage system working, you can:

1. ✅ Test with real data
2. ✅ Get user feedback
3. ✅ Add folder sync (optional)
4. ✅ Move to Phase 2: Entity Abstraction
5. ✅ Build the AI Revenue Agent
6. ✅ Launch to production

**Congratulations! You've built something amazing! 🎉**
