# DesiSmash website and ordering

A free static site. No server, no monthly fees, no framework.

| File | What it is |
| --- | --- |
| `index.html` | The website: menu, basket, checkout, app links, social links |
| `post-kit.html` | Weekly caption generator for Instagram, TikTok, Facebook, WhatsApp |
| `config.js` | Everything you edit: WhatsApp number, links, prices, sold-out list, weekly special |
| `app.js`, `styles.css` | Site code and styling |
| `logos/` | Your logo and packaging images |

## How ordering works

1. Customer builds a basket, picks a day and a 30-minute slot (Fri to Sun only, UK time) and sends the order.
2. The order opens in WhatsApp as a ready-written message to your WhatsApp Business number.
3. You reply to confirm. Customer pays on collection or delivery.

This has no card payments, so it needs no payment account and costs nothing. If you want card payments later, add a Stripe or SumUp payment link and paste it into the confirmation reply.

## Set up in 6 steps

1. Open `config.js`. Put your WhatsApp Business number in `whatsapp` (country code first, digits only, e.g. `447123456789`).
2. Add your Instagram, TikTok and Facebook links under `social`.
3. Set `kitchenPostcode` to a postcode **near** your kitchen, never your exact address. `config.js` is public, so anyone can read this value. The mileage bands and `roadFactor` are in the same file.
4. Check `allergenNote` against your real recipes. It is a starting point, not a legal allergen matrix.
5. Each weekend: change `special`, and add sold-out item ids to `soldOut`.
6. Publish (below), then open `post-kit.html` to write your posts.

## Hosting and updating (all through GitHub)

This repository is the website. GitHub Pages publishes it, and every commit to `main` goes live in about a minute.

- **Live site:** https://www.desismash.co.uk/ (domain bought on Cloudflare; `CNAME` file tells GitHub Pages to serve it). The old address https://jaminhassan-debug.github.io/desismash-site/ redirects to it.
- **Edit a file:** open it on GitHub, press the pencil icon, change it, press Commit changes.
- **Weekly changes:** edit `config.js` (special, sold-out list, announcement) and commit.
- **Closing for a weekend:** in `config.js` set `closed: { on: true, ... }`. The site then shows your message, and every Add button says Closed. Set it back to `false` to reopen.
- **Source of truth:** this repo only holds public files. The paid recipe book, its source, costings, margins, supplier details and business plans live in the separate private repo `desismash-private`. Never add them here: everything in this repo is public and stays in its history.

Pages setup (already done): Settings, Pages, Deploy from a branch, `main`, `/ (root)`.

## Uber Eats, Deliveroo and Just Eat

There is no free way to connect a home-built site to these three. Each runs its own merchant approval and its own menu system. What this site does:

- Shows a button for each app and links to your store page. Paste the URLs into `config.js` once you're live. Until then the buttons say "Coming soon".
- Keeps direct orders on your own site, where you keep 100% of the sale instead of paying 25 to 35% commission.

To list on the apps:

1. Apply as a merchant on each app's restaurant sign-up page. Expect to give your food business registration, hygiene rating, bank details and photos. The approval can take a few weeks and your EHO registration must be in place first.
2. Upload the menu and set app prices to suit the commission each app charges.
3. Test whether a single smash line can handle app orders and direct orders on the same night before you switch both on.

## Collecting emails and selling the recipe book

The "Make the fakeaway at home" section does three jobs:

1. **Free recipe for an email.** People enter name and email (and can tick an optional box for offers) and download `downloads/Desi-Smash-Starter-Recipe.pdf`.
2. **Spice blend.** "Add to my order" puts a jar in the basket. It is collected or delivered with the weekend order and paid for like the burgers.
3. **Recipe book.** `Desi-Smash-At-Home-Recipe-Book.pdf` is the paid PDF. It is kept in the private `desismash-private` repo, never in this public one. Upload it to Payhip, Gumroad or a Stripe Payment Link, which take payment and email the file. Paste that link into `shop[1].url` in `config.js`. Until then the button says "Coming soon".

### Getting the emails (do this before launch)

A static site cannot store data by itself, so the sign-up form posts to a free form service. Pick one:

- **Formspree** (formspree.io): create a form, copy its endpoint URL into `leads.endpoint`. Sign-ups arrive in your inbox and a dashboard. Free tier covers about 50 a month.
- **Web3Forms** (web3forms.com): put `https://api.web3forms.com/submit` in `leads.endpoint` and your access key in `leads.extra`, as `{ access_key: "..." }`.
- **Google Sheet**: use a Google Apps Script web app that appends each POST to a sheet. Free and unlimited, a little more setup.

Until `leads.endpoint` is set the recipe still downloads, but **no email is saved**. Test with your own email before you promote it.

To send the weekly offers you will need an email tool such as Brevo or Mailchimp (both have free tiers). Only email people whose `marketing_consent` is `yes`.

### UK rules to follow

- The marketing tick box is unticked by default and optional. Do not change that.
- Complete `leads.contactEmail` so `privacy.html` shows a contact. Read the notice and edit it so it matches how you really work. It is a starting template, not legal advice.
- Selling a spice blend is selling food. Label the jar with ingredients, allergens, weight, best-before date, batch code and your business address, and check with your council's trading standards or environmental health team.

### Editing the recipe PDFs

The text of both PDFs is in `recipe-pdf-src/build.py` in the private `desismash-private` repo. Edit it there, rebuild, then copy the free PDF into this repo's `downloads/` folder.

## Social media

- `post-kit.html` creates captions in each platform's style from your weekly special and open days. Copy, paste, post.
- The site has a Share button, and Open Graph tags, so links shared on WhatsApp, Facebook and Instagram show your neon logo.
- Put the website link in your Instagram and TikTok bios and pin a "How to order" post.
- Suggested rhythm: Thursday prep video, Friday 4 pm "open tonight" story, Saturday sold-out alert, Sunday last orders.

## Before you take real orders

- Register the food business with the council at least 28 days before trading.
- Confirm allergen information with Chef Hass's actual recipes. Customers must be told about the 14 major allergens.
- Test one full order on your phone, including the WhatsApp step.
- UK consumer law applies to online orders: show your business name and contact details on the site.

## Kitchen screen and customer records (private)

Every order is saved to a private database (Supabase, London) as well as going to WhatsApp.

- **Kitchen screen:** `/kitchen/` on this site. Sign in with a staff email. It shows tickets in priority order, a cook list and live updates, with Orders and Customers tabs and CSV export.
- **Adding staff:** add the email to the `staff` table in Supabase (Table Editor), then that person signs in on `/kitchen/` (use Create account once). Nobody else can see any data.
- **Marketing:** the Customers tab shows who opted in. Only email people marked "Opted in".
- **Keys:** the key in `config.js` can only place orders. It cannot read anything.

## Security notes

- Everything in this repo is public, including `config.js`. Never put passwords, secret keys, costs, margins or your home address in it. The Supabase key in `config.js` is the public "publishable" key and can only place orders.
- The kitchen screen (`/kitchen/`) runs under a strict Content Security Policy and escapes all customer text. Keep its script in `kitchen/kitchen.js` (no inline scripts) or the policy will block it.
- Staff access is decided by the `staff` table, matched on exact email. In Supabase (Authentication, Providers, Email) turn **off** "Allow new users to sign up" once your staff have accounts, and keep row level security on for every table.
- Email Worker: add a Cloudflare rate limiting rule for it (see `worker/README.md`).

## Coming-soon mode and countdown

`launch` in `config.js` turns the site into a "coming soon" page: the home page shows a countdown, the menu can be browsed but nothing can be added, the order form is blocked, and the guides show a notice.

- **Change the date:** edit `at` (UK time, for example `2026-12-04T17:00:00+00:00`) and `label` (the words shown, for example `Friday 4 December at 5 pm`). GMT is `+00:00` in winter, BST is `+01:00` in summer.
- **It opens by itself** when the countdown reaches zero. Nothing needs changing on the day.
- **Open early:** set `on: false`.
- **After launch:** the page and search results still say "coming soon" in the page description (`index.html`, the `description`, `og:description` and `twitter:description` lines). Update them to "Pre-order Fri to Sun for collection or delivery".
- This only switches ordering off in the website. It is not a lock on the order database, which anyone with the public key could still call directly.

## Logos, tab icon and dark mode

- `logos/logo-light.png` (orange on transparent) is used on light backgrounds, `logos/logo-dark.png` (cream on transparent) on dark ones, and the footer always uses the dark one. They sit in the middle of the header on every page.
- `logos/logo-colour.png` is the three-colour logo. It is not used for the tab icon any more; `logos/logo-192.png` (a square version of it) is only used as the logo in Google's structured data.
- The **browser tab icon** is just the burger from the logo, in the logo's orange on a transparent background, with the lines thickened for tiny sizes. The files are in `icons/` (`burger.ico`, `burger-16/32/48/96/192.png` and `burger-apple-180.png`, which is the same burger on white because iPhones turn transparent icons black); `favicon.ico` in the site root is a copy for browsers that ask for it by default. The sizes are multiples of 48 px because Google asks for that. Keep these file names and addresses stable: Google remembers the icon address.
- **Dark mode** follows the visitor's browser or phone setting. It lives in `dark.css` and switches the logo as well, so the logo and the page can never disagree. To turn dark mode off, delete the `<link ... dark.css ...>` line in `index.html`, `privacy.html`, `terms.html` and the guide template.
- The original logo pictures are kept in the private repo, in `assets/logos/`.

## Replacing a photo

If you replace a photo in `images/` with a new one of the same name, visitors' browsers may keep showing the old one for a while. Change `imageVersion` in `config.js` (any new number, for example today's date) and every visitor fetches the new picture.

## Titles and descriptions

Do not use `&` or special characters in page titles, descriptions or share text (write "and"). Google and some other places show the raw code (`&amp;`) instead of the symbol. Plain apostrophes are fine.

## Collection only mode

`delivery` in `config.js` controls whether the site offers delivery. While `delivery.on` is `false` (the current setting):
- the Delivery option, address form and fee calculator are hidden, and the order is always collection;
- the home page says "Collection only for now" and that delivery through the delivery apps is coming soon;
- the guides show an "Update" box under their opening paragraph (the guides are built with `DELIVERY_ON = False`);
- it overrides the delivery switch on the kitchen screen, so that cannot turn delivery back on by accident.

**To offer our own delivery again:** set `delivery.on` to `true` in `config.js`. The home page wording switches back by itself. Then ask for the guides to be rebuilt with `DELIVERY_ON = True` (removes the Update boxes), and update the search description in `index.html`, the structured data `deliveryMethod`, and the Google Business Profile.

**When the delivery apps go live:** paste each store link into `apps` in `config.js` (the buttons stop saying "Coming soon"), then update the "Delivery coming soon" wording in `index.html`.
