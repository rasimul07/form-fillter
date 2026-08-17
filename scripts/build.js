require('dotenv').config();
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const define = {
  __AIML_API_KEY__: JSON.stringify(process.env.AIML_API_KEY || ''),
  __AIML_MODEL__: JSON.stringify(process.env.AIML_MODEL || 'openai/gpt-4o'),
};

const common = {
  bundle: true,
  sourcemap: true,
  target: 'chrome100',
  logLevel: 'info',
  define,
};

async function build() {
  const popupCtx = await esbuild.context({
    ...common,
    entryPoints: ['popup/popup.js'],
    outfile: 'popup/popup.bundle.js',
    format: 'iife',
  });

  const contentCtx = await esbuild.context({
    ...common,
    entryPoints: ['content/content.js'],
    outfile: 'content/content.bundle.js',
    format: 'iife',
  });

  if (watch) {
    await popupCtx.watch();
    await contentCtx.watch();
    console.log('Watching for changes...');
  } else {
    await popupCtx.rebuild();
    await contentCtx.rebuild();
    await popupCtx.dispose();
    await contentCtx.dispose();
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
