// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      "dist/*",
      "android/**",
      "ios/**",
      ".expo/**",
      "build/**",
      "dist-release-test/**",
      "dist-release-test-2/**",
      "dist-release-test-3/**",
      "dist-release-test-4/**"
    ]
  },
]);
