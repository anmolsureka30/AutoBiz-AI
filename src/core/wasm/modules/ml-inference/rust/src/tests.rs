#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;
    use std::fs;

    wasm_bindgen_test_configure!(run_in_browser);

    fn create_test_model() -> Vec<u8> {
        // Create a simple ONNX model for testing
        // This is a placeholder - in real tests we'd use a real model file
        b"ONNX".to_vec()
    }

    fn create_test_image() -> Vec<u8> {
        // Create a test image
        let width = 64;
        let height = 64;
        let mut img = ImageBuffer::new(width, height);
        
        // Fill with test pattern
        for y in 0..height {
            for x in 0..width {
                let pixel = image::Rgb([
                    (x % 255) as u8,
                    (y % 255) as u8,
                    ((x + y) % 255) as u8
                ]);
                img.put_pixel(x, y, pixel);
            }
        }

        // Convert to PNG bytes
        let mut bytes = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png)
            .expect("Failed to encode test image");
        bytes
    }

    #[test]
    fn test_model_loading() {
        let mut ml = MLInference::new();
        let model_data = create_test_model();
        let config = ModelConfig {
            batch_size: 1,
            num_threads: 2,
            use_gpu: false,
            precision: "fp32".to_string(),
            optimization_level: 2,
            cache_results: true,
            timeout: 30000,
        };

        let config_ptr = ml.write_config(&config).expect("Failed to write config");
        let result = ml.load_model(&model_data, config_ptr);
        assert!(result.is_ok());
    }

    #[test]
    fn test_preprocessing() {
        let mut ml = MLInference::new();
        let image_data = create_test_image();
        
        let options = PreprocessingOptions {
            resize: Some(ResizeOptions {
                width: 224,
                height: 224,
                method: "bilinear".to_string(),
            }),
            normalize: Some(NormalizeOptions {
                mean: Some(vec![0.485, 0.456, 0.406]),
                std: Some(vec![0.229, 0.224, 0.225]),
                scale: None,
            }),
            color_space: Some("RGB".to_string()),
            layout: Some("NCHW".to_string()),
        };

        let options_json = serde_json::to_string(&options).expect("Failed to serialize options");
        let options_ptr = ml.write_string(&options_json).expect("Failed to write options");
        let data_ptr = ml.write_buffer(&image_data).expect("Failed to write image data");

        let result = ml.preprocess(data_ptr, options_ptr);
        assert!(result.is_ok());

        let tensor_ptr = result.unwrap();
        let tensor = ml.read_tensor(tensor_ptr, 0).expect("Failed to read tensor");

        // Verify tensor shape and values
        assert_eq!(tensor.shape(), &[1, 3, 224, 224]);
        
        // Check if values are normalized
        let data = tensor.as_slice().unwrap();
        assert!(data.iter().all(|&x| x >= -3.0 && x <= 3.0));
    }

    #[test]
    fn test_inference() {
        let mut ml = MLInference::new();
        let model_data = create_test_model();
        let input_data = vec![1.0f32; 224 * 224 * 3];
        let shape = vec![1, 3, 224, 224];

        // Load model
        let config = ModelConfig {
            batch_size: 1,
            num_threads: 2,
            use_gpu: false,
            precision: "fp32".to_string(),
            optimization_level: 2,
            cache_results: true,
            timeout: 30000,
        };

        let config_ptr = ml.write_config(&config).expect("Failed to write config");
        ml.load_model(&model_data, config_ptr).expect("Failed to load model");

        // Run inference
        let input_ptr = ml.write_tensor_data(&input_data).expect("Failed to write input");
        let shape_ptr = ml.write_shape(&shape).expect("Failed to write shape");
        
        let result = ml.run_inference(input_ptr, shape_ptr);
        assert!(result.is_ok());
    }

    #[test]
    fn test_memory_management() {
        let mut ml = MLInference::new();
        
        // Allocate some memory
        let data = vec![1u8; 1024];
        let ptr1 = ml.allocate(data.len()).expect("Failed to allocate");
        let ptr2 = ml.allocate(data.len()).expect("Failed to allocate");

        // Write data
        ml.memory[ptr1..ptr1 + data.len()].copy_from_slice(&data);
        ml.memory[ptr2..ptr2 + data.len()].copy_from_slice(&data);

        // Deallocate
        ml.deallocate(ptr1, data.len());
        ml.deallocate(ptr2, data.len());

        // Cleanup
        ml.cleanup();
        assert_eq!(ml.memory.len(), 0);
    }

    #[test]
    fn test_error_handling() {
        let mut ml = MLInference::new();

        // Test invalid model format
        let invalid_model = vec![0u8; 100];
        let config = ModelConfig {
            batch_size: 1,
            num_threads: 2,
            use_gpu: false,
            precision: "fp32".to_string(),
            optimization_level: 2,
            cache_results: true,
            timeout: 30000,
        };

        let config_ptr = ml.write_config(&config).expect("Failed to write config");
        let result = ml.load_model(&invalid_model, config_ptr);
        assert!(result.is_err());

        // Test invalid preprocessing options
        let invalid_options = PreprocessingOptions {
            resize: Some(ResizeOptions {
                width: 0,
                height: 0,
                method: "invalid".to_string(),
            }),
            normalize: None,
            color_space: Some("INVALID".to_string()),
            layout: Some("INVALID".to_string()),
        };

        let options_json = serde_json::to_string(&invalid_options).expect("Failed to serialize options");
        let options_ptr = ml.write_string(&options_json).expect("Failed to write options");
        let data_ptr = ml.write_buffer(&vec![0u8; 100]).expect("Failed to write data");

        let result = ml.preprocess(data_ptr, options_ptr);
        assert!(result.is_err());
    }
} 