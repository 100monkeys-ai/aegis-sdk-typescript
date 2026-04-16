/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.tsx?$": ["@swc/jest"],
    "^.+\\.jsx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: ["node_modules/(?!@noble/)"],
  forceExit: true,
};
