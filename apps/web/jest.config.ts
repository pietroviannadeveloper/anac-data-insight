import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
    "\\.(png|jpg|jpeg|gif|svg|ico|webp)$": "<rootDir>/__mocks__/fileMock.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)", "**/*.test.(ts|tsx)"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};

export default config;
