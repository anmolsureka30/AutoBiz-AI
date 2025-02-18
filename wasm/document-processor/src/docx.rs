use crate::{DocumentMetadata, ProcessingOptions, ProcessingResult};
use docx::document::ReadDocx;
use std::error::Error;
use std::io::Cursor;
use chrono::Utc;
use zip::ZipArchive;

pub struct DocxProcessor;

impl DocxProcessor {
    pub fn process(data: &[u8], options: &ProcessingOptions) -> Result<ProcessingResult, Box<dyn Error>> {
        let cursor = Cursor::new(data);
        let mut archive = ZipArchive::new(cursor)?;
        let doc = docx::document::Document::from_reader(&mut archive)?;

        let metadata = Self::extract_metadata(&doc, data.len())?;
        let text = if options.extract_text {
            Some(Self::extract_text(&doc)?)
        } else {
            None
        };

        let images = if options.extract_images {
            Some(Self::extract_images(&mut archive)?)
        } else {
            None
        };

        Ok(ProcessingResult {
            metadata,
            text,
            images,
            error: None,
        })
    }

    fn extract_metadata(doc: &docx::document::Document, file_size: usize) -> Result<DocumentMetadata, Box<dyn Error>> {
        let core_props = doc.core_properties();
        
        let created_at = core_props
            .created()
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| Utc::now().to_rfc3339());

        let modified_at = core_props
            .modified()
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| Utc::now().to_rfc3339());

        Ok(DocumentMetadata {
            file_size,
            page_count: Self::estimate_page_count(doc),
            file_type: String::from("docx"),
            created_at,
            last_modified: modified_at,
        })
    }

    fn extract_text(doc: &docx::document::Document) -> Result<String, Box<dyn Error>> {
        let mut text = String::new();

        for paragraph in doc.paragraphs() {
            for run in paragraph.runs() {
                if let Some(content) = run.text() {
                    text.push_str(content);
                }
            }
            text.push('\n');
        }

        Ok(text)
    }

    fn extract_images(archive: &mut ZipArchive<Cursor<&[u8]>>) -> Result<Vec<Vec<u8>>, Box<dyn Error>> {
        let mut images = Vec::new();

        for i in 0..archive.len() {
            let file = archive.by_index(i)?;
            let name = file.name().to_string();

            if name.starts_with("word/media/") {
                let mut buffer = Vec::new();
                std::io::copy(&mut archive.by_index(i)?, &mut buffer)?;
                images.push(buffer);
            }
        }

        Ok(images)
    }

    fn estimate_page_count(doc: &docx::document::Document) -> u32 {
        // Rough estimation based on paragraph count
        // Average 40 lines per page
        let paragraph_count = doc.paragraphs().count();
        ((paragraph_count as f32 / 40.0).ceil() as u32).max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_test_options() -> ProcessingOptions {
        ProcessingOptions {
            extract_text: true,
            extract_images: true,
            perform_ocr: false,
            language: None,
            quality: Some(String::from("high")),
        }
    }

    #[test]
    fn test_docx_metadata_extraction() {
        let data = fs::read("tests/fixtures/sample.docx").unwrap();
        let options = create_test_options();

        let result = DocxProcessor::process(&data, &options).unwrap();
        
        assert_eq!(result.metadata.file_type, "docx");
        assert!(result.metadata.page_count > 0);
        assert_eq!(result.metadata.file_size, data.len());
    }

    #[test]
    fn test_docx_text_extraction() {
        let data = fs::read("tests/fixtures/sample.docx").unwrap();
        let options = create_test_options();

        let result = DocxProcessor::process(&data, &options).unwrap();
        
        assert!(result.text.is_some());
        let text = result.text.unwrap();
        assert!(!text.is_empty());
    }

    #[test]
    fn test_docx_image_extraction() {
        let data = fs::read("tests/fixtures/sample-with-images.docx").unwrap();
        let options = create_test_options();

        let result = DocxProcessor::process(&data, &options).unwrap();
        
        assert!(result.images.is_some());
        let images = result.images.unwrap();
        assert!(!images.is_empty());
    }

    #[test]
    fn test_invalid_docx() {
        let data = vec![1, 2, 3, 4]; // Invalid DOCX data
        let options = create_test_options();

        let result = DocxProcessor::process(&data, &options);
        assert!(result.is_err());
    }
} 