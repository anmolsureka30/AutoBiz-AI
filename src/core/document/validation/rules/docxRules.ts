import { ValidationRule } from '../../types';
import { Document, Paragraph } from 'docx';
import JSZip from 'jszip';

export const docxValidationRules: ValidationRule[] = [
  {
    id: 'docx-structure',
    name: 'DOCX Structure Validation',
    description: 'Validates DOCX document structure and content types',
    severity: 'error',
    category: 'format',
    validate: async (file, metadata) => {
      try {
        const zip = new JSZip();
        await zip.loadAsync(file);

        // Check for required Office Open XML files
        const requiredFiles = [
          'word/document.xml',
          'word/_rels/document.xml.rels',
          '[Content_Types].xml',
        ];

        const hasRequiredFiles = requiredFiles.every(file => zip.files[file]);

        return {
          valid: hasRequiredFiles,
          rule: 'docx-structure',
          details: hasRequiredFiles ? undefined : 'Missing required DOCX structure files',
        };
      } catch (error) {
        return {
          valid: false,
          rule: 'docx-structure',
          details: 'Failed to parse DOCX document',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'docx-macros',
    name: 'DOCX Macro Detection',
    description: 'Detects and validates macro content in DOCX',
    severity: 'warning',
    category: 'security',
    validate: async (file, metadata) => {
      try {
        const zip = new JSZip();
        await zip.loadAsync(file);

        // Check for VBA macros
        const hasMacros = Object.keys(zip.files).some(filename => 
          filename.startsWith('word/vbaProject') || 
          filename.endsWith('.bin') || 
          filename.includes('vbaData')
        );

        return {
          valid: !hasMacros,
          rule: 'docx-macros',
          details: hasMacros ? 'Document contains macros' : undefined,
        };
      } catch (error) {
        return {
          valid: true,
          rule: 'docx-macros',
          details: 'Failed to check for macros',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'docx-external-references',
    name: 'DOCX External References Check',
    description: 'Checks for external references in DOCX',
    severity: 'warning',
    category: 'security',
    validate: async (file, metadata) => {
      try {
        const zip = new JSZip();
        await zip.loadAsync(file);

        const hasExternalRefs = await checkForExternalReferences(zip);

        return {
          valid: !hasExternalRefs,
          rule: 'docx-external-references',
          details: hasExternalRefs ? 'Document contains external references' : undefined,
        };
      } catch (error) {
        return {
          valid: true,
          rule: 'docx-external-references',
          details: 'Failed to check for external references',
          error: error as Error,
        };
      }
    },
  },
];

async function checkForExternalReferences(zip: JSZip): Promise<boolean> {
  try {
    // Check relationships file for external references
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (!relsFile) return false;

    const content = await relsFile.async('text');
    return content.includes('Target="http') || 
           content.includes('Target="https') || 
           content.includes('TargetMode="External"');
  } catch {
    return false;
  }
} 