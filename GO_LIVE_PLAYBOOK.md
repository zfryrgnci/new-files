# 🚀 GO-LIVE PLAYBOOK — turning 7 products into income

You have 7 finished, monetized products auto-building in your `new-files` repo.
This is the exact plan to publish and earn once Google approves your account.

## Your catalog

| App | Package id | Category | Money model |
|---|---|---|---|
| Money Manager | com.refaz.money | Finance | Ads + **subscription** (money_pro) |
| Loan Calculator | com.refaz.loan | Finance | Ads + one-time **remove_ads** |
| Streak: Habit Tracker | com.refaz.streak | Productivity | Ads + **subscription** (streak_pro) |
| Focus: Pomodoro | com.refaz.focus | Productivity | Ads + **subscription** (focus_pro) |
| Space Bala | com.refaz.spacebala | Arcade | Ads + one-time remove_ads |
| Neon Snake Rush | com.refaz.neonsnake | Arcade | Ads + one-time remove_ads |
| Quantum Ascent | com.refaz.quantumascent | Arcade | Ads + one-time remove_ads |

## STEP 0 — wait for account approval (the real gate)
Nothing publishes until Google verifies your identity. That's on Google; typically
a few days. Everything below can be prepped now.

## STEP 1 — publish order (don't publish all 7 at once)
Publish the **top 3 first**, learn, then roll out the rest:
1. **Money Manager** — finance category (highest ad rates) + retention + subscription.
2. **Loan Calculator** — high search, high ad value, easy installs, low effort.
3. **Streak (Habit Tracker)** — daily retention + subscription.
Then Focus, then the 3 games.

Use **Internal testing** track first (review in hours, test on your phone), then
promote to **Production**.

## STEP 2 — real AdMob (do per app, before Production)
For EACH app: https://admob.google.com → Apps → Add app → Android → "not on store yet"
→ create **Banner** + **Interstitial** (games: also **Rewarded**). Then in the repo,
edit `app/src/main/java/.../AdConfig.kt`:
- paste the real unit ids into the REAL_* constants
- set `USE_TEST_ADS = false`
- in `app/build.gradle.kts` set the real `admobAppId`
Commit → the GitHub build produces a real-ads AAB. (Test ads pay $0 — this is the
switch that turns on real money.)

## STEP 3 — in-app products (Play Console → Monetize)
- Games + Loan: create an **in-app product** with id **`remove_ads`**.
- Money Manager: create a **subscription** id **`money_pro`** with base plans
  **`monthly`** and **`yearly`**.
- Habit Tracker: subscription **`streak_pro`** (monthly + yearly).
- Focus: subscription **`focus_pro`** (monthly + yearly).
(The ids must match exactly — they're already wired in the code.)

## STEP 4 — each store listing needs
- Title/short/full description → already written in each app's `store_assets/store_listing.md`
- Privacy policy URL → host each `store_assets/privacy_policy.md` free on GitHub Pages
- 2+ phone screenshots (one is included; take more from the app)
- 1024×500 feature graphic (make free in Canva)
- Data safety form + content rating + Ads = Yes

## STEP 5 — the part that actually makes money: measure & double down
Zero marketing = slow, uneven installs. So:
- After ~2 weeks, open **Play Console → Statistics** and **AdMob → Reports**.
- Find the ONE app with the most installs / longest retention.
- Pour effort into THAT winner: better screenshots, more keywords, new features,
  ask happy users to rate (ratings boost ranking).
- Quietly retire or ignore the ones that get nothing. One hit funds the rest.

## Honest expectations
The code, ads, subscriptions, and listings are done correctly. Income depends on
installs, which without ad spend grow slowly and aren't guaranteed. The share
buttons + keyword listings are your free growth levers. Treat this as planting 7
seeds — most stay small, and the goal is to find the one that grows.
