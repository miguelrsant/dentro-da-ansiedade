import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode inline` puts the character models inside the JS bundle (as base64), for hosts
// that only serve web file types. inlineModels.js hands them to three's file cache, so nothing is fetched.
// The meshopt layer is decoded here, because such hosts may also refuse to run WebAssembly.
function inlineModels() {
  const id = 'virtual:inline-models';
  let mode = 'development';
  return {
    name: 'inline-models',
    configResolved(config) { mode = config.mode; },
    resolveId: source => (source === id ? '\0' + id : null),
    async load(source) {
      if (source !== '\0' + id) return null;
      if (mode !== 'inline') return 'export default {};';
      const { NodeIO } = await import('@gltf-transform/core');
      const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
      const { MeshoptDecoder } = await import('meshoptimizer');
      await MeshoptDecoder.ready;
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
      const dir = path.resolve(__dirname, 'public/models');
      const models = {};
      for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.glb'))) {
        const doc = await io.read(path.join(dir, f));
        doc.getRoot().listExtensionsUsed().filter(e => e.extensionName === 'EXT_meshopt_compression').forEach(e => e.dispose());
        models[`./models/${f}`] = Buffer.from(await io.writeBinary(doc)).toString('base64');
      }
      return `export default ${JSON.stringify(models)};`;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), inlineModels()],
  base: './',
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: mode === 'inline' ? 6000 : 1500,
    copyPublicDir: mode !== 'inline', // the inline build already carries the models
  },
}));
