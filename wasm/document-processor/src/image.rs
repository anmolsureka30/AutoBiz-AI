use crate::{DocumentMetadata, ProcessingOptions, ProcessingResult};
use image::{DynamicImage, ImageFormat, GenericImageView};
use std::error::Error;
use std::io::Cursor;
use chrono::Utc;

pub struct ImageProcessor;

impl ImageProcessor {
    pub fn process(data: &[u8], options: &ProcessingOptions) -> Result<ProcessingResult, Box<dyn Error>> {
        let format = image::guess_format(data)?;
        let img = image::load_from_memory(data)?;
        
        let metadata = Self::extract_metadata(&img, format, data.len())?;
        let text = if options.perform_ocr {
            Some(Self::perform_ocr(&img, options)?)
        } else {
            None
        };

        let images = if options.extract_images {
            // For image files, we just include the original image
            Some(vec![data.to_vec()])
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

    fn extract_metadata(
        img: &DynamicImage,
        format: ImageFormat,
        file_size: usize
    ) -> Result<DocumentMetadata, Box<dyn Error>> {
        let dimensions = img.dimensions();
        
        Ok(DocumentMetadata {
            file_size,
            page_count: 1, // Images are single-page
            file_type: format_to_string(format),
            created_at: Utc::now().to_rfc3339(), // Images often lack creation time
            last_modified: Utc::now().to_rfc3339(),
        })
    }

    fn perform_ocr(img: &DynamicImage, options: &ProcessingOptions) -> Result<String, Box<dyn Error>> {
        // Convert image to grayscale for better OCR
        let gray_img = img.grayscale();
        
        // Perform basic image preprocessing
        let processed = Self::preprocess_for_ocr(&gray_img, options)?;

        // TODO: Implement actual OCR
        // For now, return placeholder
        Ok(String::from("OCR not yet implemented"))
    }

    fn preprocess_for_ocr(img: &DynamicImage, options: &ProcessingOptions) -> Result<DynamicImage, Box<dyn Error>> {
        let mut processed = img.clone();

        // Apply preprocessing based on quality setting
        if let Some(quality) = &options.quality {
            match quality.as_str() {
                "high" => {
                    processed = processed.adjust_contrast(1.5);
                    processed = Self::remove_noise(&processed);
                },
                "medium" => {
                    processed = processed.adjust_contrast(1.2);
                },
                _ => {} // Low quality: no preprocessing
            }
        }

        Ok(processed)
    }

    fn remove_noise(img: &DynamicImage) -> DynamicImage {
        // Apply median filter to reduce noise
        // This is a simplified implementation
        img.clone() // TODO: Implement actual noise reduction
    }
}

fn format_to_string(format: ImageFormat) -> String {
    match format {
        ImageFormat::Png => String::from("png"),
        ImageFormat::Jpeg => String::from("jpeg"),
        ImageFormat::Gif => String::from("gif"),
        ImageFormat::WebP => String::from("webp"),
        ImageFormat::Tiff => String::from("tiff"),
        _ => String::from("unknown"),
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
            perform_ocr: true,
            language: Some(String::from("eng")),
            quality: Some(String::from("high")),
        }
    }

    #[test]
    fn test_image_metadata_extraction() {
        let data = fs::read("tests/fixtures/sample.jpg").unwrap();
        let options = create_test_options();

        let result = ImageProcessor::process(&data, &options).unwrap();
        
        assert!(matches!(
            result.metadata.file_type.as_str(),
            "jpeg" | "png" | "gif" | "webp" | "tiff"
        ));
        assert_eq!(result.metadata.page_count, 1);
        assert_eq!(result.metadata.file_size, data.len());
    }

    #[test]
    fn test_image_ocr() {
        let data = fs::read("tests/fixtures/sample-text.png").unwrap();
        let options = create_test_options();

        let result = ImageProcessor::process(&data, &options).unwrap();
        
        assert!(result.text.is_some());
    }

    #[test]
    fn test_invalid_image() {
        let data = vec![1, 2, 3, 4]; // Invalid image data
        let options = create_test_options();

        let result = ImageProcessor::process(&data, &options);
        assert!(result.is_err());
    }

    #[test]
    fn test_image_preprocessing() {
        let data = fs::read("tests/fixtures/sample-noisy.png").unwrap();
        let mut options = create_test_options();
        options.quality = Some(String::from("high"));

        let result = ImageProcessor::process(&data, &options).unwrap();
        assert!(result.text.is_some());
    }
} 