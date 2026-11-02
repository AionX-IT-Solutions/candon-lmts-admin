import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      // Return types are inferred by TS; requiring them on every function is too noisy for React
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Calling setState inside effects is valid React; the rule produces false positives
      'react-hooks/set-state-in-effect': 'off',
      // Downgrade missing-deps to warning so the app still builds clean
      'react-hooks/exhaustive-deps': 'warn',
      // Allow empty catch blocks (common for fire-and-forget error suppression)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Allow @ts-ignore without a description in legacy code
      '@typescript-eslint/ban-ts-comment': 'off'
    }
  },
  eslintConfigPrettier
)
