import { execSync } from 'child_process';
import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const WASM_SOURCE = join(__dirname, '../wasm/document-processor');
const WASM_DEST = join(__dirname, '../public/wasm');

async function buildWasm() {
  try {
    // Ensure wasm-pack is installed
    execSync('which wasm-pack', { stdio: 'ignore' });
  } catch {
    console.log('Installing wasm-pack...');
    execSync('curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh');
  }

  console.log('Building WASM module...');
  
  // Build WASM module
  execSync('wasm-pack build --target web', {
    cwd: WASM_SOURCE,
    stdio: 'inherit',
  });

  // Create destination directory
  mkdirSync(WASM_DEST, { recursive: true });

  // Copy WASM files to public directory
  const files = [
    'document_processor_bg.wasm',
    'document_processor.js',
  ];

  files.forEach(file => {
    copyFileSync(
      join(WASM_SOURCE, 'pkg', file),
      join(WASM_DEST, file)
    );
  });

  console.log('WASM build complete!');
}

buildWasm().catch(error => {
  console.error('Failed to build WASM module:', error);
  process.exit(1);
}); 