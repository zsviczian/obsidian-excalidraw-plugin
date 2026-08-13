import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'rollup.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'tsconfig.api.json',
		'api',
        "scripts",
        "ea-scripts",
        "docs",
        "lib",
        "images",
        "assets",
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				// Buffer/NodeJS/BufferEncoding: genuine ambient Node types available
				// in Obsidian's Electron environment (used e.g. in DataAdapter.fs
				// callbacks in src/types/types.d.ts).
				...globals.node,
				// @types/react/global.d.ts declares this as a bare top-level
				// `interface` (an ambient script, not a module), so it becomes a
				// real global type alongside HTMLDivElement etc. -- not something
				// that can be imported.
				HTMLWebViewElement: 'readonly',
				// NodeJS/BufferEncoding: ambient @types/node type/namespace names
				// (globals.node above only covers runtime values like `Buffer`,
				// not these TS-only type names).
				NodeJS: 'readonly',
				BufferEncoding: 'readonly',
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,

);
