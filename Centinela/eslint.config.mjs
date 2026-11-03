import nextConfig from "eslint-config-next"

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["lib/generated/**", "prisma/generated/**", "Prototypes/**", "playwright-report/**", "test-results/**"],
  },
]

export default eslintConfig
