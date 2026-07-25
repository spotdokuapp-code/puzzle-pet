module.exports = {
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:8123',
    // Use the system chromium when the pinned Playwright build isn't downloaded.
    launchOptions: process.env.PP_CHROMIUM ? { executablePath: process.env.PP_CHROMIUM } : {}
  },
  webServer: {
    command: 'npx http-server www -p 8123 -c-1 --silent',
    port: 8123,
    reuseExistingServer: true
  }
};
