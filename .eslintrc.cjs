module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  ignorePatterns: ['dist', 'node_modules', 'src/index.d.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
