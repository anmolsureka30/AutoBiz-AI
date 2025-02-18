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
    fn test_pdf_metadata_extraction() {
        let data = fs::read("tests/fixtures/sample.pdf").unwrap();
        let options = create_test_options();

        let result = PdfProcessor::process(&data, &options).unwrap();
        
        assert_eq!(result.metadata.file_type, "pdf");
        assert!(result.metadata.page_count > 0);
        assert_eq!(result.metadata.file_size, data.len());
    }

    #[test]
    fn test_pdf_text_extraction() {
        let data = fs::read("tests/fixtures/sample.pdf").unwrap();
        let options = create_test_options();

        let result = PdfProcessor::process(&data, &options).unwrap();
        
        assert!(result.text.is_some());
        let text = result.text.unwrap();
        assert!(!text.is_empty());
    }

    #[test]
    fn test_pdf_image_extraction() {
        let data = fs::read("tests/fixtures/sample-with-images.pdf").unwrap();
        let options = create_test_options();

        let result = PdfProcessor::process(&data, &options).unwrap();
        
        assert!(result.images.is_some());
        let images = result.images.unwrap();
        assert!(!images.is_empty());
    }

    #[test]
    fn test_invalid_pdf() {
        let data = vec![1, 2, 3, 4]; // Invalid PDF data
        let options = create_test_options();

        let result = PdfProcessor::process(&data, &options);
        assert!(result.is_err());
    }
} 