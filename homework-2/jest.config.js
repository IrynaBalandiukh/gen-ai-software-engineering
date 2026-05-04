module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
  coverageThreshold: {
    global: { statements: 85, branches: 85, functions: 85, lines: 85 },
  },
  coverageReporters: ["text", "lcov", "html"],
};
