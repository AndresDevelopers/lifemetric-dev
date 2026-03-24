import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const reactFiles = ["src/**/*.{tsx,jsx}"];
const typeScriptFiles = ["src/**/*.{ts,tsx}"];

const eslintConfig = [
  {
    ignores: [
      "eslint.config.mjs",
      "prisma/**",
      "postcss.config.mjs",
      "next.config.ts",
    ],
  },
  ...nextCoreWebVitals.map((config) => ({
    ...config,
    files: reactFiles,
  })),
  ...nextTypescript.map((config) => ({
    ...config,
    files: typeScriptFiles,
  })),
];

export default eslintConfig;
