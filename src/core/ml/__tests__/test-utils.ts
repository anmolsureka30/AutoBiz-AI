import * as tf from '@tensorflow/tfjs-node';
import { ModelConfig } from '../types';

export async function createMockModel(): Promise<tf.LayersModel> {
  const input = tf.input({ shape: [null], dtype: 'float32', name: 'input' });
  const embedding = tf.layers.embedding({
    inputDim: 1000,
    outputDim: 32,
    name: 'embedding',
  }).apply(input);
  
  const lstm = tf.layers.lstm({
    units: 64,
    returnSequences: false,
    name: 'lstm',
  }).apply(embedding);
  
  const dense = tf.layers.dense({
    units: 1000,
    activation: 'softmax',
    name: 'output',
  }).apply(lstm);

  const model = tf.model({ inputs: input, outputs: dense as tf.SymbolicTensor });
  
  await model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

export function mockModelConfig(overrides?: Partial<ModelConfig>): ModelConfig {
  return {
    modelPath: 'mock-path',
    device: 'cpu',
    precision: 'float32',
    maxBatchSize: 1,
    timeout: 1000,
    ...overrides,
  };
}

export function createMockTensor(text: string): tf.Tensor {
  const tokens = text.split(' ').map((_, i) => i % 1000);
  return tf.tensor2d([tokens], [1, tokens.length]);
}

export async function cleanupTensors(): Promise<void> {
  tf.disposeVariables();
  await tf.ready();
} 