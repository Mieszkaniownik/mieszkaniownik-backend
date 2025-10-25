#!/usr/bin/env node

const { google } = require("googleapis");
const readline = require("readline");

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

function header(message) {
  console.log("\n" + "=".repeat(60));
  log(message, colors.blue + colors.bold);
  console.log("=".repeat(60) + "\n");
}

async function getAuthorizationCode(oauth2Client, useWebFlow) {
  const scopes = ["https://www.googleapis.com/auth/gmail.send"];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  if (useWebFlow) {
    log("\nWeb-based OAuth Flow:", colors.bold);
    log("\n1. Open this URL in your browser:", colors.yellow);
    log(`\n${authUrl}\n`, colors.blue);
    log("2. Sign in with your Gmail account", colors.yellow);
    log("3. Grant permissions", colors.yellow);
    log(
      "4. Copy the authorization code from the redirect URL\n",
      colors.yellow,
    );
  } else {
    header("Step 1: Authorize the Application");
    log("Opening authorization URL. Please sign in and grant permissions:\n");
    log(authUrl, colors.blue);
    log("\nAfter authorization, you will be redirected to a URL.");
    log('Copy the "code" parameter from the redirect URL.\n', colors.yellow);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter the authorization code: ", (code) => {
      rl.close();
      resolve(code.trim());
    });
  });
}

async function exchangeCodeForTokens(oauth2Client, code) {
  header("Step 2: Exchanging Code for Tokens");

  try {
    log("Exchanging authorization code for tokens...", colors.yellow);
    const { tokens } = await oauth2Client.getToken(code);

    log("Success! Tokens received.\n", colors.green);

    return tokens;
  } catch (error) {
    log("Failed to exchange code for tokens!", colors.red);
    log(`Error: ${error.message}\n`, colors.red);

    if (error.message.includes("invalid_grant")) {
      log("Possible causes:", colors.yellow);
      log("- Authorization code expired (codes expire quickly)", colors.yellow);
      log("- Code was already used", colors.yellow);
      log("- Code is invalid\n", colors.yellow);
      log(
        "Please restart the process and use the code immediately.",
        colors.yellow,
      );
    }

    throw error;
  }
}

function displayTokens(tokens, clientId, clientSecret) {
  header("Step 3: Your OAuth2 Credentials");

  log("Copy these values to your .env file:\n", colors.green + colors.bold);

  log("# Gmail OAuth2 Configuration", colors.blue);
  log(`EMAIL_OAUTH_CLIENT_ID=${clientId}`);
  log(`EMAIL_OAUTH_CLIENT_SECRET=${clientSecret}`);
  log(`EMAIL_OAUTH_REFRESH_TOKEN=${tokens.refresh_token ?? "NOT_RECEIVED"}`);
  log("EMAIL_OAUTH_USER=your-email@gmail.com  # Replace with your Gmail");

  if (tokens.access_token) {
    log(`\n# Optional - will be auto-generated:`, colors.blue);
    log(`EMAIL_OAUTH_ACCESS_TOKEN=${tokens.access_token}`);
  }

  log("\n" + "─".repeat(60));

  if (!tokens.refresh_token) {
    log("\nWARNING: No refresh token received!", colors.red + colors.bold);
    log("\nThis usually happens when:", colors.yellow);
    log("1. You already authorized this app before", colors.yellow);
    log('2. The OAuth consent screen needs "prompt=consent"', colors.yellow);
    log("\nTo fix:", colors.yellow);
    log("1. Go to Google Account settings:", colors.blue);
    log("   https://myaccount.google.com/permissions", colors.blue);
    log("2. Remove your app from authorized apps", colors.yellow);
    log("3. Run this script again\n", colors.yellow);
  } else {
    log("\nRefresh token received successfully!", colors.green);
    log("\nNext steps:", colors.yellow);
    log("1. Copy the above values to your .env file");
    log("2. Replace EMAIL_OAUTH_USER with your actual Gmail address");
    log("3. Restart your application");
    log("4. Test with: npm run oauth2:diagnose\n");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const useWebFlow = args.includes("--web");

  const filteredArgs = args.filter((arg) => arg !== "--web");

  log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", colors.blue);
  log("    Gmail OAuth2 Token Generator", colors.blue + colors.bold);
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", colors.blue);

  let clientId, clientSecret;

  if (filteredArgs.length >= 2) {
    [clientId, clientSecret] = filteredArgs;
    log("\nUsing provided credentials\n", colors.green);
  } else {
    log("\nPlease provide your Google Cloud OAuth credentials.", colors.yellow);
    log("Get them from: https://console.cloud.google.com/\n", colors.blue);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    clientId = await new Promise((resolve) => {
      rl.question("Enter your Client ID: ", (answer) => {
        resolve(answer.trim());
      });
    });

    clientSecret = await new Promise((resolve) => {
      rl.question("Enter your Client Secret: ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    console.log();
  }

  if (!clientId || !clientSecret) {
    log("Error: Client ID and Client Secret are required!\n", colors.red);
    log("Usage:", colors.yellow);
    log("  npm run oauth2:tokens CLIENT_ID CLIENT_SECRET", colors.blue);
    log("  npm run oauth2:tokens:web CLIENT_ID CLIENT_SECRET\n", colors.blue);
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground",
  );

  try {
    const code = await getAuthorizationCode(oauth2Client, useWebFlow);

    if (!code) {
      log("No authorization code provided. Exiting.\n", colors.red);
      process.exit(1);
    }

    const tokens = await exchangeCodeForTokens(oauth2Client, code);

    displayTokens(tokens, clientId, clientSecret);

    log("\nFor more information, see:", colors.blue);
    log("   docs/GMAIL_OAUTH_SETUP.md\n", colors.blue);

    process.exit(0);
  } catch (error) {
    log(`\nError: ${error.message}\n`, colors.red);
    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => {
  log(`\nUnhandled error: ${error.message}\n`, colors.red);
  process.exit(1);
});

main();
