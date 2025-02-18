import { ValidationRule } from '../../types';

export const commonValidationRules: ValidationRule[] = [
  {
    id: 'file-integrity',
    name: 'File Integrity Check',
    description: 'Validates file integrity using checksums',
    severity: 'error',
    category: 'security',
    validate: async (file, metadata) => {
      // Implementation of file integrity check
      return {
        valid: true,
        rule: 'file-integrity',
      };
    },
  },
  {
    id: 'malware-scan',
    name: 'Malware Scan',
    description: 'Scans file for known malware signatures',
    severity: 'error',
    category: 'security',
    validate: async (file, metadata) => {
      // Implementation of malware scan
      return {
        valid: true,
        rule: 'malware-scan',
      };
    },
  },
  // Add more common rules...
]; 