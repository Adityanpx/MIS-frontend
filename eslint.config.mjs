import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // the access token must never be persisted (TRD §7.3)
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='setItem'][arguments.0.value=/token/i]",
          message: 'Never store tokens in browser storage. The access token lives in memory only.',
        },
      ],
    },
  },
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/shared/**'] },
];

export default eslintConfig;
