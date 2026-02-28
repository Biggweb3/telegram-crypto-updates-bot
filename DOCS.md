This Telegram bot monitors selected X accounts and reposts qualifying posts into Telegram when the post has enough views.

How it works
1) You add one or more X accounts (handles).
2) You mark one or more Telegram chats as destinations.
3) The bot polls X periodically.
4) If a new post meets the minimum views threshold (default 3000) and passes keyword filters, it gets forwarded to all destinations.
5) The bot deduplicates per destination so the same X post is never sent twice to the same chat.

Public commands
1) /start
Shows what the bot does and quick setup guidance.

2) /help
Shows the full command list and troubleshooting.

3) /status
Shows the bot status (polling interval, number of accounts, number of destinations, last poll time, whether X integration is enabled).

Admin commands
Admin commands require your Telegram user ID to be listed in ADMIN_TELEGRAM_USER_IDS.

1) /addaccount <handleOrUrl>
Adds an X account to monitor.
Example: /addaccount @binance
Example: /addaccount https://x.com/binance

2) /removeaccount <handleOrUrl>
Removes an X account.

3) /accounts
Lists monitored accounts.

4) /setdest
Run this in the chat you want to receive updates. The bot will save the current chat as a destination.

5) /removedest
Run this in a destination chat to remove it.

6) /dests
Lists destination chats.

7) /setthreshold <number>
Sets the minimum views threshold. It is always clamped to at least 3000.

8) /setkeywords include <comma-separated>
Sets include keywords. If include keywords are present, a post must contain at least one.
Example: /setkeywords include btc,eth,sol

9) /setkeywords exclude <comma-separated>
Sets exclude keywords. If a post contains any excluded keyword, it is skipped.

Environment variables
1) TELEGRAM_BOT_TOKEN
Required. Telegram token from BotFather.

2) MONGODB_URI
Required. Mongo connection string.

3) COOKMYBOTS_X_ENDPOINT
Optional but required for polling X. If missing, the bot still starts but polling is skipped.

4) COOKMYBOTS_X_KEY
Optional but required for polling X.

5) ADMIN_TELEGRAM_USER_IDS
Required for admin commands. Comma-separated Telegram user IDs.
If missing, the bot will report that no admins are configured.

6) POLL_INTERVAL_SECONDS
Optional. Defaults to 120.

Collections used (MongoDB)
1) settings
Stores threshold and keyword filters.

2) accounts
Monitored X accounts.

3) destinations
Telegram chats where updates are posted. The bot can auto-disable a destination after repeated send failures.

4) sent_posts
Deduplication records keyed by (destinationChatId, xPostId).

5) last_seen
Per-account cursor to reduce reprocessing.

Troubleshooting
1) The bot is not reposting anything
Check /status. If X integration is disabled, you need COOKMYBOTS_X_ENDPOINT and COOKMYBOTS_X_KEY.
Also ensure you have at least one account and at least one destination.

2) Admin commands say no admins configured
Set ADMIN_TELEGRAM_USER_IDS to your Telegram numeric user ID (comma-separated if multiple), then redeploy.

3) Messages fail to send to a destination
The bot will log send errors and may auto-disable the destination after several failures. Re-add the destination using /setdest after fixing permissions.
