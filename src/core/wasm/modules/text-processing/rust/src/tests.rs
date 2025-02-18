#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[test]
    fn test_chunk_text_basic() {
        let mut processor = TextProcessor::new();
        let text = "This is a test sentence. And another one. And a third.";
        let config = ProcessingConfig {
            chunk_size: 20,
            overlap: 5,
            preserve_whitespace: false,
            preserve_newlines: true,
            trim_chunks: true,
        };

        let text_ptr = processor.write_string(text);
        let config_ptr = processor.write_config(&config);
        let result_ptr = processor.chunk_text(text_ptr, config_ptr);
        let chunks = processor.read_chunks(result_ptr);

        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].text, "This is a test sentence.");
        assert_eq!(chunks[1].text, "And another one.");
        assert_eq!(chunks[2].text, "And a third.");
    }

    #[test]
    fn test_chunk_text_with_overlap() {
        let mut processor = TextProcessor::new();
        let text = "First chunk. Second chunk. Third chunk. Fourth chunk.";
        let config = ProcessingConfig {
            chunk_size: 25,
            overlap: 10,
            preserve_whitespace: false,
            preserve_newlines: true,
            trim_chunks: true,
        };

        let text_ptr = processor.write_string(text);
        let config_ptr = processor.write_config(&config);
        let result_ptr = processor.chunk_text(text_ptr, config_ptr);
        let chunks = processor.read_chunks(result_ptr);

        assert!(chunks.len() > 1);
        // Check for overlap
        for i in 1..chunks.len() {
            let prev_end = chunks[i-1].end;
            let curr_start = chunks[i].start;
            assert!(curr_start < prev_end);
        }
    }

    #[test]
    fn test_memory_management() {
        let mut processor = TextProcessor::new();
        let initial_memory = processor.memory.len();

        // Allocate some memory
        let ptr1 = processor.allocate(100);
        let ptr2 = processor.allocate(200);
        assert!(processor.memory.len() > initial_memory);

        // Deallocate
        processor.deallocate(ptr1, 100);
        processor.deallocate(ptr2, 200);

        // Cleanup
        processor.cleanup();
        assert_eq!(processor.memory.len(), 0);
        assert_eq!(processor.allocated.len(), 0);
    }

    #[test]
    fn test_unicode_handling() {
        let mut processor = TextProcessor::new();
        let text = "Hello 👋 World! こんにちは 世界！";
        let config = ProcessingConfig {
            chunk_size: 10,
            overlap: 2,
            preserve_whitespace: true,
            preserve_newlines: true,
            trim_chunks: false,
        };

        let text_ptr = processor.write_string(text);
        let config_ptr = processor.write_config(&config);
        let result_ptr = processor.chunk_text(text_ptr, config_ptr);
        let chunks = processor.read_chunks(result_ptr);

        // Verify that emoji and multi-byte characters are handled correctly
        assert!(chunks.iter().any(|chunk| chunk.text.contains("👋")));
        assert!(chunks.iter().any(|chunk| chunk.text.contains("こんにちは")));
    }

    #[test]
    fn test_error_handling() {
        let mut processor = TextProcessor::new();
        
        // Test invalid memory access
        let result = std::panic::catch_unwind(|| {
            processor.read_string(usize::MAX);
        });
        assert!(result.is_err());

        // Test invalid config
        let result = std::panic::catch_unwind(|| {
            processor.read_config(usize::MAX);
        });
        assert!(result.is_err());
    }
} 