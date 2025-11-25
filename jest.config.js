/** @type {import("jest").Config} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "**/src/**/*.spec.ts",
    "**/src/**/*.test.ts",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.build/",
  ],
  moduleNameMapper: {
    "^@prisma/client-pe$": "<rootDir>/src/node_modules/.prisma/client-pe/index.js",
    "^@prisma/client-cl$": "<rootDir>/src/node_modules/.prisma/client-cl/index.js",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)",
  ],
  clearMocks: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
};