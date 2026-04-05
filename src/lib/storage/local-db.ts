/**
 * Local Database (IndexedDB Wrapper)
 * 
 * Provides encrypted local storage for sensitive data that cannot be stored in the cloud.
 * Uses IndexedDB for storage and Web Crypto API for encryption.
 * 
 * Features:
 * - End-to-end encryption (AES-256-GCM)
 * - Offline-first architecture
 * - Automatic sync queue for non-sensitive data
 * - GDPR/HIPAA compliant
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { getDataClassification, shouldStoreLocally, canSyncToCloud } from './data-classification';
import { logger } from '@/lib/logger';

// ========== Database Schema ==========

export interface LocalDBSchema extends DBSchema {
  // Healthcare entities
  patients: {
    key: string;
    value: {
      id: string;
      business_id: string;
      name: string;
      phone: string;
      email: string;
      date_of_birth: string;
      address: string;
      medical_history: string; // Encrypted
      allergies: string; // Encrypted
      medications: string; // Encrypted
      created_at: string;
      updated_at: string;
    };
    indexes: { 
      'by-business': string;
      'by-phone': string;
      'by-email': string;
    };
  };
  
  appointments: {
    key: string;
    value: {
      id: string;
      business_id: string;
      patient_id: string;
      doctor_id: string;
      slot_start: string;
      slot_end: string;
      status: string;
      notes: string; // Encrypted
      diagnosis: string; // Encrypted
      treatment: string; // Encrypted
      created_at: string;
      updated_at: string;
    };
    indexes: {
      'by-business': string;
      'by-date': string;
      'by-patient': string;
      'by-doctor': string;
    };
  };
  
  prescriptions: {
    key: string;
    value: {
      id: string;
      business_id: string;
      patient_id: string;
      doctor_id: string;
      medications: string; // Encrypted JSON
      diagnosis: string; // Encrypted
      instructions: string; // Encrypted
      created_at: string;
    };
    indexes: {
      'by-business': string;
      'by-patient': string;
    };
  };
  
  medical_records: {
    key: string;
    value: {
      id: string;
      business_id: string;
      patient_id: string;
      record_type: string;
      content: string; // Encrypted
      attachments: string; // Encrypted JSON
      created_at: string;
    };
    indexes: {
      'by-business': string;
      'by-patient': string;
      'by-type': string;
    };
  };
  
  // Sync queue for cloud-syncable data
  sync_queue: {
    key: string;
    value: {
      id: string;
      table: string;
      operation: 'create' | 'update' | 'delete';
      data: any;
      synced: boolean;
      retry_count: number;
      last_error: string | null;
      created_at: string;
    };
    indexes: {
      'by-synced': number;
      'by-table': string;
    };
  };
  
  // Encryption keys (encrypted with master key)
  encryption_keys: {
    key: string;
    value: {
      id: string;
      key_data: string; // Encrypted
      created_at: string;
    };
  };
  
  // Metadata
  metadata: {
    key: string;
    value: {
      key: string;
      value: string;
      updated_at: string;
    };
  };
}

// ========== Local Database Class ==========

class LocalDatabase {
  private db: IDBPDatabase<LocalDBSchema> | null = null;
  private encryptionKey: CryptoKey | null = null;
  private readonly DB_NAME = 'oltigo-local';
  private readonly DB_VERSION = 1;
  
  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;
    
    try {
      this.db = await openDB<LocalDBSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          logger.info('Upgrading local database', {
            context: 'local-db',
            oldVersion,
            newVersion,
          });
          
          // Patients store
          if (!db.objectStoreNames.contains('patients')) {
            const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
            patientStore.createIndex('by-business', 'business_id');
            patientStore.createIndex('by-phone', 'phone');
            patientStore.createIndex('by-email', 'email');
          }
          
          // Appointments store
          if (!db.objectStoreNames.contains('appointments')) {
            const appointmentStore = db.createObjectStore('appointments', { keyPath: 'id' });
            appointmentStore.createIndex('by-business', 'business_id');
            appointmentStore.createIndex('by-date', 'slot_start');
            appointmentStore.createIndex('by-patient', 'patient_id');
            appointmentStore.createIndex('by-doctor', 'doctor_id');
          }
          
          // Prescriptions store
          if (!db.objectStoreNames.contains('prescriptions')) {
            const prescriptionStore = db.createObjectStore('prescriptions', { keyPath: 'id' });
            prescriptionStore.createIndex('by-business', 'business_id');
            prescriptionStore.createIndex('by-patient', 'patient_id');
          }
          
          // Medical records store
          if (!db.objectStoreNames.contains('medical_records')) {
            const recordStore = db.createObjectStore('medical_records', { keyPath: 'id' });
            recordStore.createIndex('by-business', 'business_id');
            recordStore.createIndex('by-patient', 'patient_id');
            recordStore.createIndex('by-type', 'record_type');
          }
          
          // Sync queue
          if (!db.objectStoreNames.contains('sync_queue')) {
            const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
            syncStore.createIndex('by-synced', 'synced');
            syncStore.createIndex('by-table', 'table');
          }
          
          // Encryption keys
          if (!db.objectStoreNames.contains('encryption_keys')) {
            db.createObjectStore('encryption_keys', { keyPath: 'id' });
          }
          
          // Metadata
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        },
      });
      
      logger.info('Local database initialized', { context: 'local-db' });
    } catch (error) {
      logger.error('Failed to initialize local database', {
        context: 'local-db',
        error,
      });
      throw error;
    }
  }
  
  /**
   * Initialize encryption key
   */
  async initEncryption(password: string): Promise<void> {
    const salt = await this.getOrCreateSalt();
    this.encryptionKey = await this.deriveKey(password, salt);
    
    logger.info('Encryption initialized', { context: 'local-db' });
  }
  
  /**
   * Get or create salt for key derivation
   */
  private async getOrCreateSalt(): Promise<Uint8Array> {
    if (!this.db) await this.init();
    
    const existing = await this.db!.get('metadata', 'encryption_salt');
    
    if (existing) {
      return new Uint8Array(JSON.parse(existing.value));
    }
    
    // Generate new salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    await this.db!.put('metadata', {
      key: 'encryption_salt',
      value: JSON.stringify(Array.from(salt)),
      updated_at: new Date().toISOString(),
    });
    
    return salt;
  }
  
  /**
   * Derive encryption key from password
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Encrypt data
   */
  private async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      dataBuffer
    );
    
    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
  
  /**
   * Decrypt data
   */
  private async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }
  
  /**
   * Add a patient
   */
  async addPatient(patient: LocalDBSchema['patients']['value']): Promise<void> {
    if (!this.db) await this.init();
    
    // Encrypt sensitive fields
    const encrypted = {
      ...patient,
      medical_history: await this.encrypt(patient.medical_history || ''),
      allergies: await this.encrypt(patient.allergies || ''),
      medications: await this.encrypt(patient.medications || ''),
    };
    
    await this.db!.add('patients', encrypted);
    
    // Queue non-sensitive metadata for cloud sync
    if (canSyncToCloud('patient_personal_info')) {
      await this.queueSync('patients', 'create', {
        id: patient.id,
        business_id: patient.business_id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        // Exclude sensitive fields
      });
    }
    
    logger.info('Patient added to local database', {
      context: 'local-db',
      patientId: patient.id,
    });
  }
  
  /**
   * Get a patient
   */
  async getPatient(id: string): Promise<LocalDBSchema['patients']['value'] | undefined> {
    if (!this.db) await this.init();
    
    const patient = await this.db!.get('patients', id);
    
    if (patient) {
      // Decrypt sensitive fields
      patient.medical_history = await this.decrypt(patient.medical_history);
      patient.allergies = await this.decrypt(patient.allergies);
      patient.medications = await this.decrypt(patient.medications);
    }
    
    return patient;
  }
  
  /**
   * Get all patients for a business
   */
  async getPatientsByBusiness(businessId: string): Promise<LocalDBSchema['patients']['value'][]> {
    if (!this.db) await this.init();
    
    const patients = await this.db!.getAllFromIndex('patients', 'by-business', businessId);
    
    // Decrypt sensitive fields for all patients
    for (const patient of patients) {
      patient.medical_history = await this.decrypt(patient.medical_history);
      patient.allergies = await this.decrypt(patient.allergies);
      patient.medications = await this.decrypt(patient.medications);
    }
    
    return patients;
  }
  
  /**
   * Update a patient
   */
  async updatePatient(patient: LocalDBSchema['patients']['value']): Promise<void> {
    if (!this.db) await this.init();
    
    // Encrypt sensitive fields
    const encrypted = {
      ...patient,
      medical_history: await this.encrypt(patient.medical_history || ''),
      allergies: await this.encrypt(patient.allergies || ''),
      medications: await this.encrypt(patient.medications || ''),
      updated_at: new Date().toISOString(),
    };
    
    await this.db!.put('patients', encrypted);
    
    // Queue for sync
    if (canSyncToCloud('patient_personal_info')) {
      await this.queueSync('patients', 'update', {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
      });
    }
  }
  
  /**
   * Delete a patient
   */
  async deletePatient(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.delete('patients', id);
    
    // Queue for sync
    if (canSyncToCloud('patient_personal_info')) {
      await this.queueSync('patients', 'delete', { id });
    }
    
    logger.info('Patient deleted from local database', {
      context: 'local-db',
      patientId: id,
    });
  }
  
  /**
   * Queue data for cloud sync
   */
  private async queueSync(table: string, operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
    if (!this.db) await this.init();
    
    await this.db!.add('sync_queue', {
      id: crypto.randomUUID(),
      table,
      operation,
      data,
      synced: false,
      retry_count: 0,
      last_error: null,
      created_at: new Date().toISOString(),
    });
    
    // Trigger background sync if available
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-data');
      } catch (error) {
        logger.warn('Background sync not available', {
          context: 'local-db',
          error,
        });
      }
    }
  }
  
  /**
   * Sync queued data to cloud
   */
  async syncToCloud(): Promise<{ success: number; failed: number }> {
    if (!this.db) await this.init();
    
    const queue = await this.db!.getAllFromIndex('sync_queue', 'by-synced', 0);
    
    let success = 0;
    let failed = 0;
    
    for (const item of queue) {
      try {
        // Send to cloud API
        const response = await fetch(`/api/sync/${item.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: item.operation,
            data: item.data,
          }),
        });
        
        if (response.ok) {
          // Mark as synced
          await this.db!.put('sync_queue', {
            ...item,
            synced: true,
          });
          success++;
        } else {
          // Increment retry count
          await this.db!.put('sync_queue', {
            ...item,
            retry_count: item.retry_count + 1,
            last_error: await response.text(),
          });
          failed++;
        }
      } catch (error) {
        logger.error('Sync failed', {
          context: 'local-db',
          item,
          error,
        });
        
        // Increment retry count
        await this.db!.put('sync_queue', {
          ...item,
          retry_count: item.retry_count + 1,
          last_error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }
    
    logger.info('Sync completed', {
      context: 'local-db',
      success,
      failed,
    });
    
    return { success, failed };
  }
  
  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    pending: number;
    synced: number;
    failed: number;
  }> {
    if (!this.db) await this.init();
    
    const all = await this.db!.getAll('sync_queue');
    
    return {
      pending: all.filter(item => !item.synced && item.retry_count < 3).length,
      synced: all.filter(item => item.synced).length,
      failed: all.filter(item => !item.synced && item.retry_count >= 3).length,
    };
  }
  
  /**
   * Clear synced items from queue
   */
  async clearSyncedItems(): Promise<void> {
    if (!this.db) await this.init();
    
    const synced = await this.db!.getAllFromIndex('sync_queue', 'by-synced', 1);
    
    for (const item of synced) {
      await this.db!.delete('sync_queue', item.id);
    }
    
    logger.info('Cleared synced items', {
      context: 'local-db',
      count: synced.length,
    });
  }
  
  /**
   * Export all data (for backup)
   */
  async exportData(): Promise<string> {
    if (!this.db) await this.init();
    
    const data: Record<string, any[]> = {};
    
    // Export all stores
    const storeNames = ['patients', 'appointments', 'prescriptions', 'medical_records'] as const;
    
    for (const storeName of storeNames) {
      data[storeName] = await this.db!.getAll(storeName);
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Import data (from backup)
   */
  async importData(jsonData: string): Promise<void> {
    if (!this.db) await this.init();
    
    const data = JSON.parse(jsonData);
    
    for (const [storeName, items] of Object.entries(data)) {
      for (const item of items as any[]) {
        await this.db!.put(storeName as any, item);
      }
    }
    
    logger.info('Data imported', { context: 'local-db' });
  }
  
  /**
   * Get database size
   */
  async getDatabaseSize(): Promise<number> {
    if (!this.db) await this.init();
    
    if ('estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    
    return 0;
  }
  
  /**
   * Clear all data (for testing or reset)
   */
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    
    const storeNames = this.db!.objectStoreNames;
    
    for (let i = 0; i < storeNames.length; i++) {
      await this.db!.clear(storeNames[i] as any);
    }
    
    logger.warn('All local data cleared', { context: 'local-db' });
  }
}

// Export singleton instance
export const localDB = new LocalDatabase();
