// obuild config — bundles src/cli.ts to dist/cli.mjs (named after the input stem).
export default {
  entries: [
    { type: 'bundle', input: 'src/cli.ts', outDir: 'dist' },
  ],
};
