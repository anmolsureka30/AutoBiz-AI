import { WasmModuleConfig, WasmModuleType } from '../../types';

export interface TensorShape {
  dimensions: number[];
  dataType: 'float32' | 'int32' | 'uint8' | 'int64';
  layout: 'NHWC' | 'NCHW' | 'LINEAR';
}

export interface ModelMetadata {
  name: string;
  version: string;
  framework: 'tensorflow' | 'pytorch' | 'onnx';
  inputShapes: TensorShape[];
  outputShapes: TensorShape[];
  labels?: string[];
  meanValues?: number[];
  stdValues?: number[];
}

export interface MLInferenceConfig extends WasmModuleConfig {
  type: WasmModuleType.MLInference;
  options?: {
    batchSize?: number;
    numThreads?: number;
    useGPU?: boolean;
    precision?: 'fp32' | 'fp16' | 'int8';
    optimizationLevel?: 0 | 1 | 2 | 3;
    cacheResults?: boolean;
    timeout?: number;
  };
}

export interface InferenceResult {
  outputs: {
    [key: string]: {
      data: Float32Array | Int32Array | Uint8Array;
      shape: number[];
      type: TensorShape['dataType'];
    };
  };
  metadata: {
    inferenceTime: number;
    memoryUsed: number;
    confidence?: number;
    preprocessingTime?: number;
    postprocessingTime?: number;
  };
  statistics: {
    maxValue: number;
    minValue: number;
    meanValue: number;
    stdDeviation: number;
  };
}

export interface PreprocessingOptions {
  resize?: {
    width: number;
    height: number;
    method?: 'bilinear' | 'nearest' | 'bicubic';
  };
  normalize?: {
    mean?: number[];
    std?: number[];
    scale?: number;
  };
  colorSpace?: 'RGB' | 'BGR' | 'GRAYSCALE';
  layout?: TensorShape['layout'];
}

export interface MLInferenceError {
  code: string;
  message: string;
  details?: {
    modelInfo?: string;
    inputShape?: number[];
    memoryLimit?: number;
    cause?: string;
  };
} 