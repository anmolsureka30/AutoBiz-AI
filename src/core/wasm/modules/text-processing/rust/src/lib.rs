use wasm_bindgen::prelude::*;
use unicode_segmentation::UnicodeSegmentation;
use unicode_normalization::UnicodeNormalization;
use regex::Regex;
use lazy_static::lazy_static;
use serde::{Serialize, Deserialize};
use std::mem;

#[derive(Serialize, Deserialize)]
pub struct TextChunk {
    text: String,
    start: usize,
    end: usize,
    metadata: ChunkMetadata,
}

#[derive(Serialize, Deserialize)]
pub struct ChunkMetadata {
    language: Option<String>,
    confidence: f64,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessingConfig {
    chunk_size: usize,
    overlap: usize,
    preserve_whitespace: bool,
    preserve_newlines: bool,
    trim_chunks: bool,
}

lazy_static! {
    static ref SENTENCE_BOUNDARY: Regex = Regex::new(r"[.!?]+\s+").unwrap();
    static ref PARAGRAPH_BOUNDARY: Regex = Regex::new(r"\n\s*\n").unwrap();
}

#[wasm_bindgen]
pub struct TextProcessor {
    memory: Vec<u8>,
    allocated: Vec<(usize, usize)>, // (ptr, size) pairs
}

#[wasm_bindgen]
impl TextProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        TextProcessor {
            memory: Vec::with_capacity(1024 * 1024), // 1MB initial capacity
            allocated: Vec::new(),
        }
    }

    pub fn allocate(&mut self, size: usize) -> usize {
        let aligned_size = (size + 7) & !7; // 8-byte alignment
        let ptr = self.memory.len();
        self.memory.resize(ptr + aligned_size, 0);
        self.allocated.push((ptr, aligned_size));
        ptr
    }

    pub fn deallocate(&mut self, ptr: usize, size: usize) {
        if let Some(index) = self.allocated.iter().position(|&(p, s)| p == ptr && s >= size) {
            self.allocated.remove(index);
        }
    }

    pub fn process_text(&mut self, text_ptr: usize) -> usize {
        let text = self.read_string(text_ptr);
        let chunks = self.chunk_text_impl(&text, &ProcessingConfig {
            chunk_size: 1024,
            overlap: 200,
            preserve_whitespace: false,
            preserve_newlines: true,
            trim_chunks: true,
        });

        self.write_chunks(&chunks)
    }

    pub fn chunk_text(&mut self, text_ptr: usize, config_ptr: usize) -> usize {
        let text = self.read_string(text_ptr);
        let config = self.read_config(config_ptr);
        let chunks = self.chunk_text_impl(&text, &config);
        self.write_chunks(&chunks)
    }

    fn chunk_text_impl(&self, text: &str, config: &ProcessingConfig) -> Vec<TextChunk> {
        let mut chunks = Vec::new();
        let graphemes: Vec<_> = text.graphemes(true).collect();
        let mut start = 0;

        while start < graphemes.len() {
            let end = (start + config.chunk_size).min(graphemes.len());
            let mut chunk_end = end;

            // Find natural boundary if possible
            if end < graphemes.len() {
                if let Some(boundary) = SENTENCE_BOUNDARY.find_iter(&graphemes[start..end].concat())
                    .map(|m| start + m.end())
                    .last() {
                    chunk_end = boundary;
                }
            }

            let chunk_text = graphemes[start..chunk_end].concat();
            let chunk_text = if config.trim_chunks {
                chunk_text.trim().to_string()
            } else {
                chunk_text
            };

            chunks.push(TextChunk {
                text: chunk_text,
                start,
                end: chunk_end,
                metadata: ChunkMetadata {
                    language: None,
                    confidence: 1.0,
                },
            });

            start = chunk_end - config.overlap;
        }

        chunks
    }

    fn read_string(&self, ptr: usize) -> String {
        let mut len = 0;
        while self.memory[ptr + len] != 0 {
            len += 1;
        }
        String::from_utf8_lossy(&self.memory[ptr..ptr + len]).to_string()
    }

    fn read_config(&self, ptr: usize) -> ProcessingConfig {
        let slice = unsafe {
            std::slice::from_raw_parts(
                self.memory[ptr..].as_ptr() as *const i32,
                5,
            )
        };

        ProcessingConfig {
            chunk_size: slice[0] as usize,
            overlap: slice[1] as usize,
            preserve_whitespace: slice[2] != 0,
            preserve_newlines: slice[3] != 0,
            trim_chunks: slice[4] != 0,
        }
    }

    fn write_chunks(&mut self, chunks: &[TextChunk]) -> usize {
        let result_size = 12; // 4 bytes each for count, metadata_ptr, chunks_ptr
        let result_ptr = self.allocate(result_size);

        let chunks_data = chunks.iter().map(|chunk| {
            let text_ptr = self.write_string(&chunk.text);
            let metadata_ptr = self.write_metadata(&chunk.metadata);
            (text_ptr, chunk.start, chunk.end, metadata_ptr)
        }).collect::<Vec<_>>();

        let chunks_ptr = self.write_chunk_data(&chunks_data);

        // Write result structure
        let result_slice = unsafe {
            std::slice::from_raw_parts_mut(
                self.memory[result_ptr..].as_mut_ptr() as *mut i32,
                3,
            )
        };

        result_slice[0] = chunks.len() as i32;
        result_slice[1] = 0; // metadata_ptr (global metadata not implemented yet)
        result_slice[2] = chunks_ptr as i32;

        result_ptr
    }

    fn write_string(&mut self, s: &str) -> usize {
        let bytes = s.as_bytes();
        let ptr = self.allocate(bytes.len() + 1);
        self.memory[ptr..ptr + bytes.len()].copy_from_slice(bytes);
        self.memory[ptr + bytes.len()] = 0;
        ptr
    }

    fn write_metadata(&mut self, metadata: &ChunkMetadata) -> usize {
        let ptr = self.allocate(16); // 8 bytes for language ptr, 8 bytes for confidence
        let slice = unsafe {
            std::slice::from_raw_parts_mut(
                self.memory[ptr..].as_mut_ptr() as *mut u64,
                2,
            )
        };

        slice[0] = match &metadata.language {
            Some(lang) => self.write_string(lang) as u64,
            None => 0,
        };
        slice[1] = metadata.confidence.to_bits();

        ptr
    }

    fn write_chunk_data(&mut self, chunks_data: &[(usize, usize, usize, usize)]) -> usize {
        let ptr = self.allocate(chunks_data.len() * 24); // 24 bytes per chunk
        for (i, &(text_ptr, start, end, metadata_ptr)) in chunks_data.iter().enumerate() {
            let offset = ptr + i * 24;
            let slice = unsafe {
                std::slice::from_raw_parts_mut(
                    self.memory[offset..].as_mut_ptr() as *mut i32,
                    6,
                )
            };
            slice[0] = text_ptr as i32;
            slice[1] = start as i32;
            slice[2] = end as i32;
            slice[3] = metadata_ptr as i32;
        }
        ptr
    }

    #[wasm_bindgen]
    pub fn cleanup(&mut self) {
        self.memory.clear();
        self.allocated.clear();
    }
} 