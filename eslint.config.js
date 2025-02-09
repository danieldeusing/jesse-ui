// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'no-console': 'off', // allow console.log in TypeScript files
      'vue/no-multiple-template-root': 'off',
      '@stylistic/indent': ['error', 2],
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off',
      '@stylistic/no-multiple-empty-lines': 0,
      '@stylistic/no-trailing-spaces': 2,
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always',
      }],
      'prefer-const': 'error',
      '@stylistic/padded-blocks': 'warn',
      '@stylistic/comma-dangle': 0,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'vue/no-unused-vars': 'off',
      'vue/no-unused-components': 'error',
      'vue/max-attributes-per-line': ['error', {
        singleline: 4,
        multiline: {
          max: 2,
        },
      }],
      '@stylistic/no-extra-semi': 'warn',
      'vue/no-mutating-props': 'off',
      'vue/no-v-html': 'off',
      'vue/multi-word-component-names': 0,
      '@typescript-eslint/no-dynamic-delete': 0,
      'vue/no-v-text-v-html-on-component': 0
    },
  },
)
