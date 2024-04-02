import globals from "globals";
import unicorn from "eslint-plugin-unicorn";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  jsdoc.configs["flat/recommended-typescript-flavor"],
  {
    ignores: ["eslint.config.js"],
  },
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.nodeBuiltin,
    },
    plugins: { unicorn },
    rules: {
      ...unicorn.configs["flat/recommended"].rules,
      "no-empty": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
        },
      ],
    },
  }
);
