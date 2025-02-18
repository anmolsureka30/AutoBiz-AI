use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

mod pdf;
mod docx;
mod image;

use pdf::PdfProcessor;
use docx::DocxProcessor;
use image::ImageProcessor;

#[derive(Serialize, Deserialize)]
pub struct DocumentMetadata {
    file_size: usize,
    page_count: u32,
    file_type: String,
    created_at: String,
    last_modified: String,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessingOptions {
    extract_text: bool,
    extract_images: bool,
    perform_ocr: bool,
    language: Option<String>,
    quality: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessingResult {
    metadata: DocumentMetadata,
    text: Option<String>,
    images: Option<Vec<Vec<u8>>>,
    error: Option<String>,
}

#[wasm_bindgen]
pub struct DocumentProcessor {
    memory: Vec<u8>,
}

#[wasm_bindgen]
impl DocumentProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        Self {
            memory: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn malloc(&mut self, size: usize) -> *mut u8 {
        self.memory.resize(size, 0);
        self.memory.as_mut_ptr()
    }

    #[wasm_bindgen]
    pub fn free(&mut self) {
        self.memory.clear();
    }

    #[wasm_bindgen]
    pub fn process_document(
        &mut self,
        data_ptr: *const u8,
        data_len: usize,
        options_ptr: *const u8,
        options_len: usize,
    ) -> *mut u8 {
        let result = std::panic::catch_unwind(|| {
            // Read input data
            let document_data = unsafe {
                std::slice::from_raw_parts(data_ptr, data_len)
            };

            let options_data = unsafe {
                std::slice::from_raw_parts(options_ptr, options_len)
            };

            // Parse options
            let options: ProcessingOptions = serde_json::from_slice(options_data)
                .expect("Failed to parse options");

            // Process document based on type
            let result = match self.detect_file_type(document_data) {
                "pdf" => self.process_pdf(document_data, &options),
                "docx" => self.process_docx(document_data, &options),
                "image" => self.process_image(document_data, &options),
                _ => Err("Unsupported file type".into()),
            };

            // Create result
            let processing_result = match result {
                Ok(result) => result,
                Err(err) => ProcessingResult {
                    metadata: DocumentMetadata {
                        file_size: document_data.len(),
                        page_count: 0,
                        file_type: String::from("unknown"),
                        created_at: chrono::Utc::now().to_rfc3339(),
                        last_modified: chrono::Utc::now().to_rfc3339(),
                    },
                    text: None,
                    images: None,
                    error: Some(err.to_string()),
                },
            };

            // Serialize result
            let result_json = serde_json::to_vec(&processing_result)
                .expect("Failed to serialize result");

            // Allocate memory for result
            let result_ptr = self.malloc(result_json.len());
            unsafe {
                std::ptr::copy_nonoverlapping(
                    result_json.as_ptr(),
                    result_ptr,
                    result_json.len(),
                );
            }

            result_ptr
        });

        match result {
            Ok(ptr) => ptr,
            Err(_) => {
                let error_result = ProcessingResult {
                    metadata: DocumentMetadata {
                        file_size: 0,
                        page_count: 0,
                        file_type: String::from("unknown"),
                        created_at: chrono::Utc::now().to_rfc3339(),
                        last_modified: chrono::Utc::now().to_rfc3339(),
                    },
                    text: None,
                    images: None,
                    error: Some(String::from("Internal processing error")),
                };

                let error_json = serde_json::to_vec(&error_result)
                    .expect("Failed to serialize error");

                let error_ptr = self.malloc(error_json.len());
                unsafe {
                    std::ptr::copy_nonoverlapping(
                        error_json.as_ptr(),
                        error_ptr,
                        error_json.len(),
                    );
                }
                error_ptr
            }
        }
    }

    // Private helper methods
    fn detect_file_type(&self, data: &[u8]) -> &str {
        if data.starts_with(b"%PDF") {
            "pdf"
        } else if data.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
            "docx"
        } else if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
            "image"
        } else {
            "unknown"
        }
    }

    fn process_pdf(&self, data: &[u8], options: &ProcessingOptions) -> Result<ProcessingResult, Box<dyn std::error::Error>> {
        PdfProcessor::process(data, options)
    }

    fn process_docx(&self, data: &[u8], options: &ProcessingOptions) -> Result<ProcessingResult, Box<dyn std::error::Error>> {
        DocxProcessor::process(data, options)
    }

    fn process_image(&self, data: &[u8], options: &ProcessingOptions) -> Result<ProcessingResult, Box<dyn std::error::Error>> {
        ImageProcessor::process(data, options)
    }
} 