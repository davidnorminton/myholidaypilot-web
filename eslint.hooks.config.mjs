import reactHooks from 'eslint-plugin-react-hooks'
export default [
  {
    files: ['src/**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { parserOptions: { ecmaVersion: 2023, sourceType: 'module', ecmaFeatures: { jsx: true } } },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
]
