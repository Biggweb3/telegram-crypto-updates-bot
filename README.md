Telegram bot that monitors configured X accounts and reposts qualifying posts to Telegram when they have enough views.

Setup
1) Create a bot with BotFather and set TELEGRAM_BOT_TOKEN.
2) Create a MongoDB database and set MONGODB_URI.
3) Configure the CookMyBots X integration and set COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY.
4) Set ADMIN_TELEGRAM_USER_IDS to your Telegram numeric user id.
5) Start the bot.

Run
1) npm run dev
2) npm start

Basic usage
1) In the destination chat, run /setdest
2) In any chat where you are admin, run /addaccount <handle>
3) Wait for polling, or check /status

Notes
This bot uses long polling for Telegram updates and runs in a single Node.js process.
