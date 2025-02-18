use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use ndarray::{Array, ArrayD};
use anyhow::Result;
use thiserror::Error;
use std::sync::Arc;
use std::mem::size_of;
use tract_core::tract_ndarray::{Array1, Array2, Array3, Array4};
use tract_core::internal::tract_smallvec::SmallVec;

mod preprocessing;
use preprocessing::{ImagePreprocessor, PreprocessingOptions, PreprocessingError};

#[derive(Error, Debug)]
pub enum MLError {
    #[error("Model loading failed: {0}")]
    ModelLoadError(String),
    #[error("Inference failed: {0}")]
    InferenceError(String),
    #[error("Memory allocation failed: {0}")]
    MemoryError(String),
    #[error("Invalid input: {0}")]
    InputError(String),
}

#[derive(Serialize, Deserialize)]
pub struct ModelConfig {
    batch_size: usize,
    num_threads: usize,
    use_gpu: bool,
    precision: String,
    optimization_level: u8,
    cache_results: bool,
    timeout: u32,
}

#[derive(Serialize, Deserialize)]
pub struct TensorInfo {
    shape: Vec<usize>,
    data_type: String,
    layout: String,
}

#[derive(Serialize, Deserialize)]
pub struct ModelMetadata {
    name: String,
    version: String,
    framework: String,
    input_shapes: Vec<TensorInfo>,
    output_shapes: Vec<TensorInfo>,
}

#[wasm_bindgen]
pub struct MLInference {
    model: Option<Arc<tract_core::Model>>,
    config: ModelConfig,
    metadata: Option<ModelMetadata>,
    memory: Vec<u8>,
}

#[wasm_bindgen]
impl MLInference {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        MLInference {
            model: None,
            config: ModelConfig {
                batch_size: 1,
                num_threads: 1,
                use_gpu: false,
                precision: "fp32".to_string(),
                optimization_level: 2,
                cache_results: true,
                timeout: 30000,
            },
            metadata: None,
            memory: Vec::with_capacity(1024 * 1024), // 1MB initial capacity
        }
    }

    pub fn load_model(&mut self, data: &[u8], config_ptr: usize) -> Result<usize, JsValue> {
        let config: ModelConfig = self.read_config(config_ptr)?;
        self.config = config;

        // Load model based on header detection
        let model = if data.starts_with(b"ONNX") {
            self.load_onnx_model(data)?
        } else if data.starts_with(b"TF") {
            self.load_tensorflow_model(data)?
        } else {
            return Err(JsValue::from_str("Unsupported model format"));
        };

        self.model = Some(Arc::new(model));
        self.update_metadata()?;

        // Serialize and return metadata pointer
        let metadata_ptr = self.write_metadata()?;
        Ok(metadata_ptr)
    }

    pub fn run_inference(&mut self, input_ptr: usize, shape_ptr: usize) -> Result<usize, JsValue> {
        let model = self.model.as_ref()
            .ok_or_else(|| JsValue::from_str("Model not loaded"))?;

        // Read input data
        let input_data = self.read_tensor(input_ptr, shape_ptr)?;
        
        // Run inference
        let outputs = tract_core::tract_ndarray::tract_core::prelude::SimplePlan::new(model)
            .map_err(|e| JsValue::from_str(&e.to_string()))?
            .run(input_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Write results
        self.write_inference_results(&outputs)
    }

    pub fn preprocess(&mut self, data_ptr: usize, options_ptr: usize) -> Result<usize, JsValue> {
        let data = self.read_buffer(data_ptr)?;
        let options: PreprocessingOptions = self.read_preprocessing_options(options_ptr)?;

        let preprocessor = ImagePreprocessor::new(options);
        let processed = preprocessor.process(&data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        self.write_tensor(&processed)
    }

    fn load_onnx_model(&self, data: &[u8]) -> Result<tract_core::Model, MLError> {
        let mut model = tract_onnx::onnx()
            .model_for_read(&mut std::io::Cursor::new(data))
            .map_err(|e| MLError::ModelLoadError(e.to_string()))?
            .into_optimized()
            .map_err(|e| MLError::ModelLoadError(e.to_string()))?;

        // Apply optimization settings
        if self.config.optimization_level > 0 {
            model = model.into_optimized()
                .map_err(|e| MLError::ModelLoadError(e.to_string()))?;
        }

        Ok(model)
    }

    fn load_tensorflow_model(&self, data: &[u8]) -> Result<tract_core::Model, MLError> {
        let mut model = tract_tensorflow::tensorflow()
            .model_for_read(&mut std::io::Cursor::new(data))
            .map_err(|e| MLError::ModelLoadError(e.to_string()))?
            .into_optimized()
            .map_err(|e| MLError::ModelLoadError(e.to_string()))?;

        // Apply optimization settings
        if self.config.optimization_level > 0 {
            model = model.into_optimized()
                .map_err(|e| MLError::ModelLoadError(e.to_string()))?;
        }

        Ok(model)
    }

    fn update_metadata(&mut self) -> Result<(), MLError> {
        let model = self.model.as_ref()
            .ok_or_else(|| MLError::ModelLoadError("Model not loaded".to_string()))?;

        let input_facts = model.input_facts()?;
        let output_facts = model.output_facts()?;

        self.metadata = Some(ModelMetadata {
            name: model.name().unwrap_or("unknown").to_string(),
            version: "1.0".to_string(),
            framework: "unknown".to_string(),
            input_shapes: input_facts.iter()
                .map(|f| TensorInfo {
                    shape: f.shape.as_finite().unwrap_or_default().to_vec(),
                    data_type: format!("{:?}", f.datum_type),
                    layout: "NHWC".to_string(),
                })
                .collect(),
            output_shapes: output_facts.iter()
                .map(|f| TensorInfo {
                    shape: f.shape.as_finite().unwrap_or_default().to_vec(),
                    data_type: format!("{:?}", f.datum_type),
                    layout: "NHWC".to_string(),
                })
                .collect(),
        });

        Ok(())
    }

    fn read_config(&self, ptr: usize) -> Result<ModelConfig, JsValue> {
        let view = unsafe {
            std::slice::from_raw_parts(
                self.memory[ptr..].as_ptr() as *const i32,
                7, // Number of config fields
            )
        };

        Ok(ModelConfig {
            batch_size: view[0] as usize,
            num_threads: view[1] as usize,
            use_gpu: view[2] != 0,
            precision: match view[3] {
                0 => "fp32",
                1 => "fp16",
                2 => "int8",
                _ => "fp32",
            }.to_string(),
            optimization_level: view[4] as u8,
            cache_results: view[5] != 0,
            timeout: view[6] as u32,
        })
    }

    fn read_tensor(&self, ptr: usize, shape_ptr: usize) -> Result<ArrayD<f32>, JsValue> {
        // Read shape
        let shape_len = unsafe {
            *(self.memory[shape_ptr..].as_ptr() as *const i32)
        } as usize;

        let shape = unsafe {
            std::slice::from_raw_parts(
                (self.memory[shape_ptr + 4..].as_ptr() as *const i32),
                shape_len,
            )
        };
        let shape: Vec<usize> = shape.iter().map(|&x| x as usize).collect();

        // Read data
        let data_len = shape.iter().product::<usize>();
        let data = unsafe {
            std::slice::from_raw_parts(
                self.memory[ptr..].as_ptr() as *const f32,
                data_len,
            )
        };

        // Create ndarray
        match shape.len() {
            1 => Ok(Array1::from_vec(data.to_vec()).into_dyn()),
            2 => {
                let array = Array2::from_shape_vec(
                    (shape[0], shape[1]),
                    data.to_vec(),
                ).map_err(|e| JsValue::from_str(&e.to_string()))?;
                Ok(array.into_dyn())
            },
            3 => {
                let array = Array3::from_shape_vec(
                    (shape[0], shape[1], shape[2]),
                    data.to_vec(),
                ).map_err(|e| JsValue::from_str(&e.to_string()))?;
                Ok(array.into_dyn())
            },
            4 => {
                let array = Array4::from_shape_vec(
                    (shape[0], shape[1], shape[2], shape[3]),
                    data.to_vec(),
                ).map_err(|e| JsValue::from_str(&e.to_string()))?;
                Ok(array.into_dyn())
            },
            _ => Err(JsValue::from_str("Unsupported tensor dimension")),
        }
    }

    fn write_metadata(&mut self) -> Result<usize, JsValue> {
        let metadata = self.metadata.as_ref()
            .ok_or_else(|| JsValue::from_str("Metadata not available"))?;

        // Serialize metadata to JSON
        let json = serde_json::to_string(metadata)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Allocate and write
        let ptr = self.allocate(json.len() + 1)?;
        self.memory[ptr..ptr + json.len()].copy_from_slice(json.as_bytes());
        self.memory[ptr + json.len()] = 0; // Null terminator

        Ok(ptr)
    }

    fn write_inference_results(&mut self, outputs: &[tract_core::Tensor]) -> Result<usize, JsValue> {
        // Calculate total size needed
        let mut total_size = size_of::<i32>(); // For number of outputs
        for tensor in outputs {
            total_size += size_of::<i32>() * (1 + tensor.shape().len()); // Shape
            total_size += tensor.as_slice::<f32>()
                .map_err(|e| JsValue::from_str(&e.to_string()))?
                .len() * size_of::<f32>(); // Data
        }

        // Allocate memory
        let ptr = self.allocate(total_size)?;
        let mut offset = ptr;

        // Write number of outputs
        unsafe {
            *(self.memory[offset..].as_mut_ptr() as *mut i32) = outputs.len() as i32;
        }
        offset += size_of::<i32>();

        // Write each tensor
        for tensor in outputs {
            // Write shape
            let shape = tensor.shape();
            unsafe {
                *(self.memory[offset..].as_mut_ptr() as *mut i32) = shape.len() as i32;
            }
            offset += size_of::<i32>();

            for &dim in shape {
                unsafe {
                    *(self.memory[offset..].as_mut_ptr() as *mut i32) = dim as i32;
                }
                offset += size_of::<i32>();
            }

            // Write data
            let data = tensor.as_slice::<f32>()
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            let data_size = data.len() * size_of::<f32>();
            unsafe {
                std::ptr::copy_nonoverlapping(
                    data.as_ptr() as *const u8,
                    self.memory[offset..].as_mut_ptr(),
                    data_size,
                );
            }
            offset += data_size;
        }

        Ok(ptr)
    }

    fn allocate(&mut self, size: usize) -> Result<usize, JsValue> {
        let aligned_size = (size + 7) & !7; // 8-byte alignment
        let ptr = self.memory.len();

        // Check if we need to grow memory
        if ptr + aligned_size > self.memory.capacity() {
            let new_capacity = (ptr + aligned_size).next_power_of_two();
            self.memory.reserve(new_capacity - self.memory.capacity());
        }

        // Allocate
        self.memory.resize(ptr + aligned_size, 0);
        Ok(ptr)
    }

    fn deallocate(&mut self, ptr: usize, size: usize) {
        // In this simple implementation, we don't actually free memory
        // A more sophisticated implementation would use a proper allocator
        // For now, we just zero out the memory
        let aligned_size = (size + 7) & !7;
        if ptr + aligned_size <= self.memory.len() {
            self.memory[ptr..ptr + aligned_size].fill(0);
        }
    }

    #[wasm_bindgen]
    pub fn cleanup(&mut self) {
        self.memory.clear();
        self.model = None;
        self.metadata = None;
    }

    fn read_preprocessing_options(&self, ptr: usize) -> Result<PreprocessingOptions, JsValue> {
        let json = self.read_string(ptr)?;
        serde_json::from_str(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn write_tensor(&mut self, tensor: &ArrayD<f32>) -> Result<usize, JsValue> {
        let shape = tensor.shape();
        let data = tensor.as_slice()
            .ok_or_else(|| JsValue::from_str("Failed to get tensor data"))?;

        // Calculate size needed
        let total_size = size_of::<i32>() * (1 + shape.len()) + // Shape info
                        data.len() * size_of::<f32>(); // Data

        let ptr = self.allocate(total_size)?;
        let mut offset = ptr;

        // Write shape length
        unsafe {
            *(self.memory[offset..].as_mut_ptr() as *mut i32) = shape.len() as i32;
        }
        offset += size_of::<i32>();

        // Write shape
        for &dim in shape {
            unsafe {
                *(self.memory[offset..].as_mut_ptr() as *mut i32) = dim as i32;
            }
            offset += size_of::<i32>();
        }

        // Write data
        unsafe {
            std::ptr::copy_nonoverlapping(
                data.as_ptr() as *const u8,
                self.memory[offset..].as_mut_ptr(),
                data.len() * size_of::<f32>(),
            );
        }

        Ok(ptr)
    }

    #[cfg(test)]
    fn write_config(&mut self, config: &ModelConfig) -> Result<usize, JsValue> {
        let json = serde_json::to_string(config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.write_string(&json)
    }

    #[cfg(test)]
    fn write_string(&mut self, s: &str) -> Result<usize, JsValue> {
        let ptr = self.allocate(s.len() + 1)?;
        self.memory[ptr..ptr + s.len()].copy_from_slice(s.as_bytes());
        self.memory[ptr + s.len()] = 0;
        Ok(ptr)
    }

    #[cfg(test)]
    fn write_buffer(&mut self, data: &[u8]) -> Result<usize, JsValue> {
        let ptr = self.allocate(data.len())?;
        self.memory[ptr..ptr + data.len()].copy_from_slice(data);
        Ok(ptr)
    }

    #[cfg(test)]
    fn write_tensor_data(&mut self, data: &[f32]) -> Result<usize, JsValue> {
        let ptr = self.allocate(data.len() * std::mem::size_of::<f32>())?;
        unsafe {
            std::ptr::copy_nonoverlapping(
                data.as_ptr() as *const u8,
                self.memory[ptr..].as_mut_ptr(),
                data.len() * std::mem::size_of::<f32>(),
            );
        }
        Ok(ptr)
    }

    #[cfg(test)]
    fn write_shape(&mut self, shape: &[usize]) -> Result<usize, JsValue> {
        let ptr = self.allocate((shape.len() + 1) * std::mem::size_of::<i32>())?;
        unsafe {
            *(self.memory[ptr..].as_mut_ptr() as *mut i32) = shape.len() as i32;
            std::ptr::copy_nonoverlapping(
                shape.as_ptr() as *const u8,
                self.memory[ptr + std::mem::size_of::<i32>()..].as_mut_ptr(),
                shape.len() * std::mem::size_of::<i32>(),
            );
        }
        Ok(ptr)
    }
} 