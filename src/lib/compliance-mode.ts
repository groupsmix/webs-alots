/**
 * Compliance Mode Management
 * 
 * Manages storage mode settings for businesses based on their compliance requirements.
 * Supports three modes: Cloud-First, Hybrid, and Local-Only.
 */

import { createTenantClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';

export type ComplianceMode = 'cloud-first' | 'hybrid' | 'local-only';

export interface ComplianceSettings {
  mode: ComplianceMode;
  
  /** Data residency rules per entity type */
  dataResidency: {
    [entityType: string]: 'local' | 'encrypted-cloud' | 'cloud';
  };
  
  /** Encryption settings */
  encryption: {
    enabled: boolean;
    algorithm: 'AES-256-GCM';
    keyDerivation: 'PBKDF2';
    iterations: number;
  };
  
  /** Backup settings */
  backup: {
    enabled: boolean;
    location: 'cloud' | 'local-folder' | 'external-drive';
    frequency: 'daily' | 'weekly' | 'monthly';
    retention: number; // days
    autoBackup: boolean;
  };
  
  /** Audit settings */
  audit: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'detailed';
    retention: number; // days
  };
  
  /** Sync settings */
  sync: {
    enabled: boolean;
    autoSync: boolean;
    syncInterval: number; // minutes
    conflictResolution: 'local-wins' | 'cloud-wins' | 'manual';
  };
}

/**
 * Default compliance settings by mode
 */
export const DEFAULT_COMPLIANCE_SETTINGS: Record<ComplianceMode, ComplianceSettings> = {
  'cloud-first': {
    mode: 'cloud-first',
    dataResidency: {
      patients: 'cloud',
      appointments: 'cloud',
      prescriptions: 'cloud',
      medical_records: 'cloud',
      analytics: 'cloud',
      branding: 'cloud',
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
    },
    backup: {
      enabled: true,
      location: 'cloud',
      frequency: 'daily',
      retention: 30,
      autoBackup: true,
    },
    audit: {
      enabled: true,
      logLevel: 'standard',
      retention: 90,
    },
    sync: {
      enabled: true,
      autoSync: true,
      syncInterval: 5,
      conflictResolution: 'cloud-wins',
    },
  },
  
  'hybrid': {
    mode: 'hybrid',
    dataResidency: {
      patients: 'local',
      appointments: 'encrypted-cloud',
      prescriptions: 'local',
      medical_records: 'local',
      lab_results: 'local',
      analytics: 'cloud',
      branding: 'cloud',
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
    },
    backup: {
      enabled: true,
      location: 'local-folder',
      frequency: 'daily',
      retention: 90,
      autoBackup: true,
    },
    audit: {
      enabled: true,
      logLevel: 'detailed',
      retention: 365,
    },
    sync: {
      enabled: true,
      autoSync: true,
      syncInterval: 15,
      conflictResolution: 'local-wins',
    },
  },
  
  'local-only': {
    mode: 'local-only',
    dataResidency: {
      patients: 'local',
      appointments: 'local',
      prescriptions: 'local',
      medical_records: 'local',
      lab_results: 'local',
      analytics: 'local',
      branding: 'local',
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
    },
    backup: {
      enabled: true,
      location: 'local-folder',
      frequency: 'daily',
      retention: 365,
      autoBackup: true,
    },
    audit: {
      enabled: true,
      logLevel: 'detailed',
      retention: 3650, // 10 years
    },
    sync: {
      enabled: false,
      autoSync: false,
      syncInterval: 0,
      conflictResolution: 'manual',
    },
  },
};

/**
 * Recommended compliance mode by niche
 */
export const RECOMMENDED_COMPLIANCE_MODE: Record<string, ComplianceMode> = {
  healthcare: 'hybrid',
  dental: 'hybrid',
  medical: 'hybrid',
  clinic: 'hybrid',
  hospital: 'local-only',
  legal: 'local-only',
  financial: 'local-only',
  accounting: 'hybrid',
  restaurant: 'cloud-first',
  fitness: 'cloud-first',
  salon: 'cloud-first',
  spa: 'cloud-first',
  retail: 'cloud-first',
};

/**
 * Get compliance settings for a business
 */
export async function getComplianceSettings(businessId: string): Promise<ComplianceSettings> {
  try {
    const supabase = await createTenantClient(businessId);
    
    const { data, error } = await supabase
      .from('clinics')
      .select('compliance_settings')
      .eq('id', businessId)
      .single();
    
    if (error) {
      logger.error('Failed to get compliance settings', {
        context: 'compliance-mode',
        businessId,
        error,
      });
      
      // Return default hybrid mode
      return DEFAULT_COMPLIANCE_SETTINGS['hybrid'];
    }
    
    // Merge with defaults
    const settings = data?.compliance_settings as Partial<ComplianceSettings> | null;
    const mode = settings?.mode || 'hybrid';
    
    return {
      ...DEFAULT_COMPLIANCE_SETTINGS[mode],
      ...settings,
    };
  } catch (error) {
    logger.error('Error getting compliance settings', {
      context: 'compliance-mode',
      businessId,
      error,
    });
    
    return DEFAULT_COMPLIANCE_SETTINGS['hybrid'];
  }
}

/**
 * Update compliance settings for a business
 */
export async function updateComplianceSettings(
  businessId: string,
  settings: Partial<ComplianceSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createTenantClient(businessId);
    
    // Get current settings
    const current = await getComplianceSettings(businessId);
    
    // Merge with new settings
    const updated = {
      ...current,
      ...settings,
    };
    
    // Validate settings
    const validation = validateComplianceSettings(updated);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Update in database
    const { error } = await supabase
      .from('clinics')
      .update({ compliance_settings: updated })
      .eq('id', businessId);
    
    if (error) {
      logger.error('Failed to update compliance settings', {
        context: 'compliance-mode',
        businessId,
        error,
      });
      
      return { success: false, error: 'Failed to update settings' };
    }
    
    logger.info('Compliance settings updated', {
      context: 'compliance-mode',
      businessId,
      mode: updated.mode,
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Error updating compliance settings', {
      context: 'compliance-mode',
      businessId,
      error,
    });
    
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Validate compliance settings
 */
function validateComplianceSettings(settings: ComplianceSettings): {
  valid: boolean;
  error?: string;
} {
  // Validate mode
  if (!['cloud-first', 'hybrid', 'local-only'].includes(settings.mode)) {
    return { valid: false, error: 'Invalid compliance mode' };
  }
  
  // Validate encryption iterations
  if (settings.encryption.iterations < 10000) {
    return { valid: false, error: 'Encryption iterations must be at least 10,000' };
  }
  
  // Validate backup retention
  if (settings.backup.retention < 1) {
    return { valid: false, error: 'Backup retention must be at least 1 day' };
  }
  
  // Validate audit retention
  if (settings.audit.retention < 1) {
    return { valid: false, error: 'Audit retention must be at least 1 day' };
  }
  
  // Validate sync interval
  if (settings.sync.enabled && settings.sync.syncInterval < 1) {
    return { valid: false, error: 'Sync interval must be at least 1 minute' };
  }
  
  // Validate local-only mode doesn't have cloud sync enabled
  if (settings.mode === 'local-only' && settings.sync.enabled) {
    return { valid: false, error: 'Local-only mode cannot have cloud sync enabled' };
  }
  
  return { valid: true };
}

/**
 * Get recommended compliance mode for a business type
 */
export function getRecommendedMode(businessType: string): ComplianceMode {
  return RECOMMENDED_COMPLIANCE_MODE[businessType.toLowerCase()] || 'hybrid';
}

/**
 * Check if a business is compliant with regulations
 */
export async function checkCompliance(businessId: string): Promise<{
  compliant: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const settings = await getComplianceSettings(businessId);
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check encryption
  if (!settings.encryption.enabled) {
    issues.push('Encryption is disabled');
    recommendations.push('Enable encryption to protect sensitive data');
  }
  
  // Check backup
  if (!settings.backup.enabled) {
    issues.push('Backups are disabled');
    recommendations.push('Enable automatic backups to prevent data loss');
  }
  
  // Check audit logging
  if (!settings.audit.enabled) {
    issues.push('Audit logging is disabled');
    recommendations.push('Enable audit logging for compliance and security');
  }
  
  // Check audit retention (GDPR requires 6 years for healthcare)
  if (settings.audit.retention < 2190) { // 6 years
    recommendations.push('Consider increasing audit retention to 6 years for GDPR compliance');
  }
  
  // Check backup retention
  if (settings.backup.retention < 30) {
    recommendations.push('Consider increasing backup retention to at least 30 days');
  }
  
  return {
    compliant: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Get compliance status summary
 */
export async function getComplianceStatus(businessId: string): Promise<{
  mode: ComplianceMode;
  compliant: boolean;
  encryptionEnabled: boolean;
  backupEnabled: boolean;
  auditEnabled: boolean;
  lastBackup: string | null;
  storageUsed: number;
  storageLimit: number;
}> {
  const settings = await getComplianceSettings(businessId);
  const compliance = await checkCompliance(businessId);
  
  return {
    mode: settings.mode,
    compliant: compliance.compliant,
    encryptionEnabled: settings.encryption.enabled,
    backupEnabled: settings.backup.enabled,
    auditEnabled: settings.audit.enabled,
    lastBackup: null, // TODO: Get from backup system
    storageUsed: 0, // TODO: Calculate actual usage
    storageLimit: 10 * 1024 * 1024 * 1024, // 10GB default
  };
}
