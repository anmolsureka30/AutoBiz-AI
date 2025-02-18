import { ValidationRule } from '../../types';
import { pdfValidationRules } from './pdfRules';
import { docxValidationRules } from './docxRules';
import { csvValidationRules } from './csvRules';
import { commonValidationRules } from './commonRules';

export const defaultValidationRules: ValidationRule[] = [
  ...commonValidationRules,
  ...pdfValidationRules,
  ...docxValidationRules,
  ...csvValidationRules,
]; 