use crate::{DocumentMetadata, ProcessingOptions, ProcessingResult};
use pdf::{file::File as PdfFile, object::*};
use std::error::Error;
use std::io::Cursor;

pub struct PdfProcessor;

impl PdfProcessor {
    pub fn process(data: &[u8], options: &ProcessingOptions) -> Result<ProcessingResult, Box<dyn Error>> {
        let cursor = Cursor::new(data);
        let pdf = PdfFile::from_data(cursor)?;

        let metadata = Self::extract_metadata(&pdf, data.len())?;
        let text = if options.extract_text {
            Some(Self::extract_text(&pdf)?)
        } else {
            None
        };

        let images = if options.extract_images {
            Some(Self::extract_images(&pdf)?)
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

    fn extract_metadata(pdf: &PdfFile, file_size: usize) -> Result<DocumentMetadata, Box<dyn Error>> {
        let info = pdf.trailer.info_dict.as_ref()
            .ok_or("No PDF metadata found")?;

        let creation_date = info.get("CreationDate")
            .and_then(|obj| obj.as_string())
            .map(|s| s.to_string())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

        let mod_date = info.get("ModDate")
            .and_then(|obj| obj.as_string())
            .map(|s| s.to_string())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

        Ok(DocumentMetadata {
            file_size,
            page_count: pdf.page_count() as u32,
            file_type: String::from("pdf"),
            created_at: creation_date,
            last_modified: mod_date,
        })
    }

    fn extract_text(pdf: &PdfFile) -> Result<String, Box<dyn Error>> {
        let mut text = String::new();

        for page_number in 0..pdf.page_count() {
            let page = pdf.get_page(page_number)?;
            let content = page.contents()?;

            for operation in content.operations {
                if let Some(text_obj) = operation.operator.as_text_showing() {
                    if let Some(text_str) = text_obj.as_str() {
                        text.push_str(text_str);
                        text.push(' ');
                    }
                }
            }
            text.push('\n');
        }

        Ok(text)
    }

    fn extract_images(pdf: &PdfFile) -> Result<Vec<Vec<u8>>, Box<dyn Error>> {
        let mut images = Vec::new();

        for page_number in 0..pdf.page_count() {
            let page = pdf.get_page(page_number)?;
            let resources = page.resources()?;

            if let Some(xobjects) = resources.xobjects {
                for (_name, xobject) in xobjects.iter() {
                    if let Ok(image) = xobject.as_image() {
                        let image_data = image.raw_image_data()?;
                        images.push(image_data.to_vec());
                    }
                }
            }
        }

        Ok(images)
    }
} 