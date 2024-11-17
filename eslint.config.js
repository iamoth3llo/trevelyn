import { common, prettier, typescript } from "eslint-config-neon";
import merge from "lodash.merge";

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const config = [
	...common,
	...typescript.map((conf) =>
		merge({}, conf, {
			files: ["src/**/*.ts"],
			languageOptions: {
				parser: conf.languageOptions?.parser,
				parserOptions: {
					project: "./tsconfig.eslint.json",
					tsconfigRootDir: import.meta.dirname,
				},
			},
			rules: {
				"@typescript-eslint/dot-notation": [
					"error",
					{
						allowKeywords: true,
						allowPrivateClassPropertyAccess: false,
						allowProtectedClassPropertyAccess: false,
						allowIndexSignaturePropertyAccess: false,
					},
				],
				"@typescript-eslint/no-unused-expressions": [
					"error",
					{
						allowShortCircuit: true,
						allowTernary: true,
						allowTaggedTemplates: true,
					},
				],
			},
		}),
	),
	...prettier,
];

export default config;
