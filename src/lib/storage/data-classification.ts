/**
 * Data Classification System
 * 
 * Defines how different types of data should be stored, encrypted, and synced
 * based on sensitivity level and regulatory requirements.
 * 
 * Sensitivity Levels:
 * - PUBLIC: Can be shared publicly (branding, business hours)
 * - INTERNAL: Internal use only (analytics, reports)
 * - CONFIDENTIAL: Sensitive business data (customer info, bookings)
 * - RESTRICTED: Highly sensitive (medical records, financial data)
 */

export type DataSensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';
export type StorageLocation = 'cloud' | 'encrypted-cloud' | 'local' | 'local-encrypted';
export type EncryptionLevel = 'none' | 'transit' | 'at-rest' | 'end-to-end';
export type DeletionPolicy = 'soft' | 'hard' | 'immediate';

export interface DataClassification {
  /** Sensitivity level determines storage and encryption requirements */
  sensitivity: DataSensitivityLevel;
  
  /** Where the data should be stored */
  storage: StorageLocation;
  
  /** Encryption requirements */
  encryption: EncryptionLevel;
  
  /** How long to retain the data (in days, -1 = forever) */
  retentionDays: number;
  
  /** How to handle deletion requests */
  deletionPolicy: DeletionPolicy;
  
  /** Whether this data can be synced to cloud */
  allowCloudSync: boolean;
  
  /** Whether this data can be backed up */
  allowBackup: boolean;
  
  /** Regulatory requirements this data must comply with */
  regulations: string[];
}

/**
 * Data classification rules by table/entity type
 */
export const DATA_CLASSIFICATIONS: Record<string, DataClassification> = {
  // ========== RESTRICTED DATA (Must stay local) ==========
  
  medical_records: {
    sensitivity: 'restricted',
    storage: 'local-encrypted',
    encryption: 'end-to-end',
    retentionDays: 3650, // 10 years
    deletionPolicy: 'immediate',
    allowCloudSync: false,
    allowBackup: true, // Local backup only
    regulations: ['GDPR', 'Morocco Law 09-08', 'HIPAA'],
  },
  
  prescriptions: {
    sensitivity: 'restricted',
    storage: 'local-encrypted',
    encryption: 'end-to-end',
    retentionDays: 3650,
    deletionPolicy: 'immediate',
    allowCloudSync: false,
    allowBackup: true,
    regulations: ['GDPR', 'Morocco Law 09-08', 'HIPAA'],
  },
  
  lab_results: {
    sensitivity: 'restricted',
    storage: 'local-encrypted',
    encryption: 'end-to-end',
    retentionDays: 3650,
    deletionPolicy: 'immediate',
    allowCloudSync: false,
    allowBackup: true,
    regulations: ['GDPR', 'Morocco Law 09-08', 'HIPAA'],
  },
  
  payment_methods: {
    sensitivity: 'restricted',
    storage: 'local-encrypted',
    encryption: 'end-to-end',
    retentionDays: 2555, // 7 years (PCI-DSS)
    deletionPolicy: 'immediate',
    allowCloudSync: false,
    allowBackup: false, // Never backup payment data
    regulations: ['PCI-DSS', 'GDPR'],
  },
  
  // ========== CONFIDENTIAL DATA (Encrypted cloud allowed) ==========
  
  patient_personal_info: {
    sensitivity: 'confidential',
    storage: 'encrypted-cloud',
    encryption: 'at-rest',
    retentionDays: 3650,
    deletionPolicy: 'hard',
    allowCloudSync: true,
    allowBackup: true,
    regulations: ['GDPR', 'Morocco Law 09-08'],
  },
  
  appointments: {
    sensitivity: 'confidential',
    storage: 'encrypted-cloud',
    encryption: 'at-rest',
    retentionDays: 365,
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: ['GDPR'],
  },
  
  customer_data: {
    sensitivity: 'confidential',
    storage: 'encrypted-cloud',
    encryption: 'at-rest',
    retentionDays: 1095, // 3 years
    deletionPolicy: 'hard',
    allowCloudSync: true,
    allowBackup: true,
    regulations: ['GDPR'],
  },
  
  financial_records: {
    sensitivity: 'confidential',
    storage: 'encrypted-cloud',
    encryption: 'at-rest',
    retentionDays: 2555, // 7 years
    deletionPolicy: 'hard',
    allowCloudSync: true,
    allowBackup: true,
    regulations: ['Tax Law', 'GDPR'],
  },
  
  // ========== INTERNAL DATA (Regular cloud storage) ==========
  
  business_analytics: {
    sensitivity: 'internal',
    storage: 'cloud',
    encryption: 'transit',
    retentionDays: 730, // 2 years
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: [],
  },
  
  audit_logs: {
    sensitivity: 'internal',
    storage: 'cloud',
    encryption: 'transit',
    retentionDays: 2555, // 7 years (compliance)
    deletionPolicy: 'hard',
    allowCloudSync: true,
    allowBackup: true,
    regulations: ['GDPR', 'SOC 2'],
  },
  
  notifications: {
    sensitivity: 'internal',
    storage: 'cloud',
    encryption: 'transit',
    retentionDays: 90,
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: false,
    regulations: [],
  },
  
  // ========== PUBLIC DATA (No restrictions) ==========
  
  business_branding: {
    sensitivity: 'public',
    storage: 'cloud',
    encryption: 'none',
    retentionDays: -1, // Forever
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: [],
  },
  
  business_hours: {
    sensitivity: 'public',
    storage: 'cloud',
    encryption: 'none',
    retentionDays: -1,
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: [],
  },
  
  services: {
    sensitivity: 'public',
    storage: 'cloud',
    encryption: 'none',
    retentionDays: -1,
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: [],
  },
  
  reviews: {
    sensitivity: 'public',
    storage: 'cloud',
    encryption: 'none',
    retentionDays: -1,
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: [],
  },
};

/**
 * Get data classification for a specific table/entity
 */
export function getDataClassification(tableName: string): DataClassification {
  return DATA_CLASSIFICATIONS[tableName] || {
    // Default: treat as confidential if not specified
    sensitivity: 'confidential',
    storage: 'encrypted-cloud',
    encryption: 'at-rest',
    retentionDays: 365,
    deletionPolicy: 'soft',
    allowCloudSync: true,
    allowBackup: true,
    regulations: ['GDPR'],
  };
}

/**
 * Check if data should be stored locally
 */
export function shouldStoreLocally(tableName: string): boolean {
  const classification = getDataClassification(tableName);
  return classification.storage === 'local' || classification.storage === 'local-encrypted';
}

/**
 * Check if data requires encryption
 */
export function requiresEncryption(tableName: string): boolean {
  const classification = getDataClassification(tableName);
  return classification.encryption !== 'none';
}

/**
 * Check if data can be synced to cloud
 */
export function canSyncToCloud(tableName: string): boolean {
  const classification = getDataClassification(tableName);
  return classification.allowCloudSync;
}

/**
 * Get retention period for data
 */
export function getRetentionDays(tableName: string): number {
  const classification = getDataClassification(tableName);
  return classification.retentionDays;
}

/**
 * Check if data is expired and should be deleted
 */
export function isDataExpired(tableName: string, createdAt: Date): boolean {
  const retentionDays = getRetentionDays(tableName);
  
  // -1 means keep forever
  if (retentionDays === -1) return false;
  
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + retentionDays);
  
  return new Date() > expiryDate;
}

/**
 * Niche-specific data classifications
 * Different niches have different compliance requirements
 */
export const NICHE_DATA_CLASSIFICATIONS: Record<string, Record<string, Partial<DataClassification>>> = {
  healthcare: {
    // Healthcare has strictest requirements
    patient_data: {
      sensitivity: 'restricted',
      storage: 'local-encrypted',
      regulations: ['GDPR', 'Morocco Law 09-08', 'HIPAA'],
    },
  },
  
  restaurant: {
    // Restaurants have minimal compliance requirements
    customer_data: {
      sensitivity: 'confidential',
      storage: 'cloud',
      regulations: ['GDPR'],
    },
    orders: {
      sensitivity: 'internal',
      storage: 'cloud',
      regulations: [],
    },
  },
  
  fitness: {
    // Fitness has moderate requirements
    member_data: {
      sensitivity: 'confidential',
      storage: 'encrypted-cloud',
      regulations: ['GDPR'],
    },
    health_metrics: {
      sensitivity: 'confidential',
      storage: 'encrypted-cloud',
      regulations: ['GDPR'],
    },
  },
  
  legal: {
    // Legal has strict attorney-client privilege
    case_files: {
      sensitivity: 'restricted',
      storage: 'local-encrypted',
      regulations: ['Attorney-Client Privilege', 'GDPR'],
    },
  },
  
  financial: {
    // Financial has strict PCI-DSS requirements
    transactions: {
      sensitivity: 'restricted',
      storage: 'local-encrypted',
      regulations: ['PCI-DSS', 'GDPR'],
    },
  },
};

/**
 * Get niche-specific data classification
 */
export function getNicheDataClassification(
  niche: string,
  tableName: string
): DataClassification {
  const nicheClassifications = NICHE_DATA_CLASSIFICATIONS[niche];
  const nicheOverride = nicheClassifications?.[tableName];
  const baseClassification = getDataClassification(tableName);
  
  if (nicheOverride) {
    return { ...baseClassification, ...nicheOverride };
  }
  
  return baseClassification;
}
