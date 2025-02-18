import * as tf from '@tensorflow/tfjs-node';

beforeAll(async () => {
  // Ensure TensorFlow.js is using the CPU backend for tests
  await tf.setBackend('cpu');
  // Disable TensorFlow.js warnings during tests
  tf.env().set('DEBUG', false);
});

afterAll(async () => {
  // Clean up any remaining tensors
  tf.disposeVariables();
  await tf.ready();
}); 