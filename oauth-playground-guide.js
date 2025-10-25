#!/usr/bin/env node

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

console.log("\n" + "=".repeat(70));
log(
  "  Gmail OAuth2 Token Generator - OAuth Playground Method",
  colors.blue + colors.bold,
);
console.log("=".repeat(70) + "\n");

log("This is the EASIEST method to get OAuth tokens.\n", colors.green);

log("STEP 1: Configure OAuth Playground", colors.bold);
log("─".repeat(70));
log("1. Go to: https://developers.google.com/oauthplayground/", colors.blue);
log("2. Click the gear icon (Settings) in the top right corner");
log('3. Check "Use your own OAuth credentials"');
log("4. Enter your credentials from Google Cloud Console:\n");

if (process.env.EMAIL_OAUTH_CLIENT_ID) {
  log(
    `   OAuth Client ID: ${colors.green}${process.env.EMAIL_OAUTH_CLIENT_ID}${colors.reset}`,
  );
} else {
  log(
    `   OAuth Client ID: ${colors.yellow}[Get from Google Cloud Console]${colors.reset}`,
  );
}

if (process.env.EMAIL_OAUTH_CLIENT_SECRET) {
  log(
    `   OAuth Client secret: ${colors.green}${process.env.EMAIL_OAUTH_CLIENT_SECRET.substring(0, 10)}...${colors.reset}`,
  );
} else {
  log(
    `   OAuth Client secret: ${colors.yellow}[Get from Google Cloud Console]${colors.reset}`,
  );
}

log("\n   Tip: Your current .env credentials are shown above", colors.blue);

log("\nSTEP 2: Select Gmail API Scope", colors.bold);
log("─".repeat(70));
log('1. In the left panel, find "Gmail API v1"');
log("2. Select: https://www.googleapis.com/auth/gmail.send", colors.green);
log('3. Click "Authorize APIs"');

log("\nSTEP 3: Authorize", colors.bold);
log("─".repeat(70));
log("1. Sign in with your Gmail account");
log('2. Click "Allow" to grant permissions');
log('3. You will see "Authorization code" appear');

log("\nSTEP 4: Get Tokens", colors.bold);
log("─".repeat(70));
log('1. Click "Exchange authorization code for tokens"');
log("2. You will see:", colors.green);
log("   {");
log('     "access_token": "...",');
log('     "refresh_token": "...",  ← THIS IS WHAT YOU NEED!', colors.yellow);
log('     "expires_in": 3599');
log("   }");

log("\nSTEP 5: Update Your .env File", colors.bold);
log("─".repeat(70));
log("Copy the refresh_token and add to your .env file:\n", colors.green);

log("EMAIL_OAUTH_CLIENT_ID=your-client-id", colors.blue);
log("EMAIL_OAUTH_CLIENT_SECRET=your-client-secret", colors.blue);
log(
  "EMAIL_OAUTH_REFRESH_TOKEN=1//04...your-refresh-token",
  colors.green + colors.bold,
);
log("EMAIL_OAUTH_USER=your-email@gmail.com", colors.blue);

log(
  "\nIMPORTANT: The refresh token is the long-lived token!",
  colors.yellow + colors.bold,
);
log(
  "   Access tokens expire in 1 hour, but refresh tokens last much longer.",
  colors.yellow,
);
log(
  "   The app will automatically use the refresh token to get new access tokens.\n",
  colors.yellow,
);

log("STEP 6: Test", colors.bold);
log("─".repeat(70));
log("1. Save your .env file");
log("2. Run: npm run oauth2:diagnose", colors.blue);
log('3. You should see "Token refresh successful!"\n', colors.green);

log("─".repeat(70));
log("Need help? See: docs/GMAIL_OAUTH_SETUP.md", colors.blue);
log(
  "OAuth Playground: https://developers.google.com/oauthplayground/",
  colors.blue,
);
log("─".repeat(70) + "\n");

if (
  !process.env.EMAIL_OAUTH_CLIENT_ID ||
  !process.env.EMAIL_OAUTH_CLIENT_SECRET
) {
  log("Notice: OAuth credentials not found in .env file", colors.yellow);
  log(
    "Make sure you have created OAuth credentials in Google Cloud Console first.\n",
    colors.yellow,
  );
}
