# Order email (Cloudflare Worker + Brevo)

Sends "order received, waiting on Jay to confirm" to the customer when they place an order.
Needs a free Brevo account and a free Cloudflare account. No secrets are stored in this repo.

1. Brevo: create a free account, add and verify a sender address (Senders, Domains and Dedicated IPs, Senders), then create an API key (SMTP and API, API keys).
2. Cloudflare: Workers and Pages, Create Worker, paste in `order-email.js`, Deploy.
3. In the Worker, Settings, Variables and Secrets, add:
   - `BREVO_API_KEY` (type Secret): the Brevo key
   - `SENDER_EMAIL`: the sender address you verified in Brevo
   - `SENDER_NAME`: `DesiSmash`
   - `ALLOWED_ORIGIN`: `https://jaminhassan-debug.github.io`
4. Copy the Worker URL into `emailEndpoint` in `config.js` and commit. Leave it empty to turn emails off.

Only customers who typed an email address get one. The email is a fixed template, so the endpoint cannot be used to send arbitrary text.
