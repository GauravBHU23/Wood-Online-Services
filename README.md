# Wood Online Service

A full-stack e-commerce website for a solid wood furniture business, built on ASP.NET Core 8 MVC, Entity Framework Core and Azure SQL Database.

**Designed & Developed by Er Gaurav Kumar** — MIT Licensed.

---

## Quick start

```bash
cd src/WoodOnlineService
dotnet run
```

The database is created and seeded automatically on first run (6 categories, 26 products, roles, admin user).

| | |
|---|---|
| Admin panel | `/Admin/Dashboard` |
| Default email | `admin@woodonline.local` |
| Default password | `ChangeMe@2026` |

> **Change this password before going live.** See [Deployment](#deployment).

### Local database

**Nothing to install.** Development runs on SQLite — `dotnet run` creates `woodonline-dev.db`
in the project folder on first start. Production runs on Azure SQL.

The provider is chosen by one setting:

```jsonc
// appsettings.Development.json
"DatabaseProvider": "Sqlite",
"ConnectionStrings": { "DefaultConnection": "Data Source=woodonline-dev.db" }
```

To develop against real SQL Server instead (recommended before a release, so you exercise
the same engine as production), change it to:

```jsonc
"DatabaseProvider": "SqlServer",
"ConnectionStrings": { "DefaultConnection": "Server=localhost,1433;Database=WoodOnlineService;User Id=sa;Password=...;TrustServerCertificate=True" }
```

**Resetting the dev database:** delete `woodonline-dev.db` and run again.

> **Provider differences are handled in code.** SQLite cannot `ORDER BY` or `SUM` a decimal
> column. Price and rating sorts go through `QueryableExtensions`, which emits a `double`
> cast on SQLite and orders natively on SQL Server; dashboard revenue is summed in memory.
> Follow the same pattern if you add a query that orders or aggregates a money column.

> **Migrations target SQL Server only.** On SQLite the schema is built straight from the
> model with `EnsureCreated`, so a model change shows up locally just by deleting
> `woodonline-dev.db`. After changing a model, generate the migration against SQL Server
> before deploying:
>
> ```bash
> # in appsettings.Development.json set DatabaseProvider to SqlServer and point at a real instance
> dotnet ef migrations add YourChangeName
> ```
>
> Production applies migrations automatically at startup.

---

## What is built

### Customer

- **Catalogue** — category, wood type, price range and rating filters; sort by price, name, rating or popularity; pagination
- **Live search** — debounced autocomplete in the header with keyboard navigation, backed by a cached API
- **Product pages** — image gallery, specifications, description, related products, reviews, inline inquiry form
- **Cart** — works for guests; the guest cart merges into the account on sign-in; AJAX add-to-cart with no page reload
- **Checkout** — address form pre-filled from the profile, online payment or Cash on Delivery
- **Orders** — history, status tracker, invoice printing, cancellation with automatic stock return, payment retry
- **Reviews** — 1 to 5 stars, title and comment, verified-purchase badges, helpful votes, admin moderation
- **Account** — registration, sign-in with lockout, profile, saved address, password change
- **PWA** — installable, offline page, cached assets, app shortcuts

### Admin

- **Dashboard** — revenue, orders, products, inquiries, low-stock alerts, recent activity
- **Products** — create, edit, delete, image upload (main + gallery), featured toggle, stock management
- **Categories** — full CRUD with images and display order
- **Orders** — filter by status, update order/payment/tracking, print-ready invoice
- **Inquiries** — status workflow (New → Contacted → Closed), admin notes, click-to-call and WhatsApp
- **Reviews** — approve, reject, delete, and reply publicly under any review

---

## Payments

Online payments run through **Instamojo**. The integration covers UPI, credit card, debit card, net banking and wallets.

### How it works

1. The customer places an order → an `Order` and a `PaymentTransaction` row are created
2. We call Instamojo to create a payment request and redirect the customer to it
3. Instamojo calls our **webhook** (`POST /api/payment/webhook`) when the payment settles
4. The webhook signature is verified with **HMAC-SHA1** against the account salt before anything is written
5. On success the order is marked paid and confirmed; confirmation emails go to the customer and to you

The browser redirect (`/Checkout/PaymentCallback`) is treated only as a hint — we always re-query Instamojo's API before trusting it, because those query values arrive through the customer's own browser.

### Configuration

Payment behaviour is controlled by one setting, `Instamojo:Mode`:

| Mode | What happens |
|---|---|
| `Live` | Real Instamojo. Real money. Needs the three keys **and** a public HTTPS `SiteBaseUrl`. |
| `Simulated` | A local stand-in gateway page. Full flow, no money, no public URL needed. For local walkthroughs. |
| `Disabled` | Checkout offers Cash on Delivery only. |

Real keys go in `appsettings.Production.json` (gitignored) or Azure App Settings — **never** in
`appsettings.json`:

```json
"Instamojo": {
  "Mode": "Live",
  "ApiKey": "your-api-key",
  "AuthToken": "your-auth-token",
  "Salt": "your-private-salt",
  "BaseUrl": "https://www.instamojo.com/api/1.1/",
  "SiteBaseUrl": "https://your-domain.com"
}
```

### `SiteBaseUrl` must be a public HTTPS domain

This is the single most common reason online payment "does not work". Instamojo builds two
URLs from it and calls them **from its own servers**:

- `{SiteBaseUrl}/Checkout/PaymentCallback` — where the customer's browser returns
- `{SiteBaseUrl}/api/payment/webhook` — where the payment result is delivered

`http://localhost:5199` is only reachable from your own machine, so Instamojo can never deliver
the webhook and a payment would be taken but never confirmed. The app detects this and **refuses
to start the payment**, logging:

```
Online payment is set to Live but is not usable.
Instamojo:SiteBaseUrl points at localhost, which Instamojo cannot reach.
```

The order is still saved with stock reserved, and the customer sees a Retry Payment button —
nothing is charged.

**So:** use `Simulated` on your machine, `Live` once deployed.

### Testing real payments on your own machine

Instamojo has to reach your computer from the public internet to deliver the webhook, so a
tunnel is needed. One command does the whole thing:

```powershell
.\start-with-live-payments.ps1
```

It opens a Cloudflare tunnel, writes the public URL into `appsettings.Development.json`,
and starts the app. Stop it with `Ctrl+C`, or `.\stop-local.ps1`.

The tunnel URL changes on every run, which is why the script rewrites the config each time.
Doing it by hand instead:

```powershell
# once
Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "tools\cloudflared.exe"

# each session
.\tools\cloudflared.exe tunnel --url http://localhost:5199
# copy the https://....trycloudflare.com URL it prints into BOTH
# Instamojo:SiteBaseUrl and SiteSettings:SiteBaseUrl, then run the app
```

Verify the tunnel actually exposes the webhook — a `400` is the correct answer here, it means
the endpoint was reached and rejected an unsigned request:

```bash
curl -X POST https://YOUR-TUNNEL.trycloudflare.com/api/payment/webhook -d "x=1"
```

> **This charges real money.** There is no sandbox on a live account. Test with a ₹1 product
> and refund it from the Instamojo dashboard; the gateway fee is not refundable. For free
> testing set `"Mode": "Simulated"` instead — the full flow runs with a local stand-in page.

### Going live checklist

1. Deploy to Azure App Service and bind your domain with HTTPS
2. In **Configuration → Application settings** add:
   - `Instamojo__Mode` = `Live`
   - `Instamojo__ApiKey`, `Instamojo__AuthToken`, `Instamojo__Salt`
   - `Instamojo__SiteBaseUrl` = `https://your-domain.com`
   - `SiteSettings__SiteBaseUrl` = the same value
3. Place one order for a ₹1 test product, pay it, confirm the order flips to **Paid**
4. Refund it from your Instamojo dashboard (the gateway fee is not refundable)

> **These are live keys — every payment moves real money.** There is no separate sandbox on a
> live account. If you want a free sandbox, create an account on `test.instamojo.com`, use the
> keys it issues, and set `BaseUrl` to `https://test.instamojo.com/api/1.1/`. Live and test keys
> are not interchangeable.

---

## Email

Transactional email is sent over SMTP. When SMTP is not configured, messages are written to the log instead, so every flow still completes during development.

```json
"Smtp": {
  "Enabled": true,
  "Host": "smtp.gmail.com",
  "Port": 587,
  "UseSsl": true,
  "UserName": "you@gmail.com",
  "Password": "your-16-char-app-password",
  "FromEmail": "you@gmail.com",
  "AdminEmail": "where-you-want-notifications@gmail.com"
}
```

Gmail requires an [App Password](https://myaccount.google.com/apppasswords), not your normal password (2-step verification must be on).

| Event | Customer | Admin |
|---|---|---|
| New inquiry | — | ✅ |
| Order placed | ✅ | ✅ |
| Payment received | ✅ | ✅ |
| Payment failed | ✅ | — |
| Order status changed | ✅ | — |
| New account | ✅ (welcome) | — |
| New review | — | ✅ |

All emails are responsive HTML with table-based layouts so they render correctly in Gmail and Outlook. Customer-supplied text is HTML-encoded before it reaches an email body.

---

## Security

| Control | Implementation |
|---|---|
| **Rate limiting** | Three policies — `general` (100/min), `sensitive` (10/min on login, register, checkout, reviews), `webhook` (300/min). Keyed per user when signed in, per IP otherwise, so shared NAT does not cause false positives. |
| **CSRF** | `AutoValidateAntiforgeryToken` on every state-changing request. The payment webhook opts out explicitly (it is not a browser) and is protected by its signature instead. |
| **Webhook authenticity** | HMAC-SHA1 over the sorted payload, compared in constant time. Forged callbacks are rejected with 401 and logged. |
| **Account lockout** | 5 failed attempts → 15-minute lock. Sign-in errors are deliberately vague so the form cannot be used to enumerate registered emails. |
| **Passwords** | Minimum 8 characters, mixed case and a digit; hashed by ASP.NET Core Identity. |
| **Security headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a Content Security Policy. Server banner headers are suppressed. |
| **Authorisation** | Role-based (`Admin` / `Customer`). Every order, review and payment query is scoped by user id, so one customer can never read another's data by guessing an id. |
| **File uploads** | Extension allow-list, 5 MB cap, server-generated filenames, and a path check that confines writes and deletes to `wwwroot/uploads`. |
| **Error handling** | A global middleware turns any unhandled exception into a JSON envelope for AJAX callers and a friendly page for browsers. Stack traces are never sent to clients in production. |
| **Data protection** | Keys are persisted to the database, so auth cookies survive App Service restarts and scale-out. |

Every API returns a single `{ success, message }` envelope, including model-validation failures, so the front end can surface any error as a toast.

---

## Front-end

There is no build step — no npm, no bundler. Everything is plain CSS and ES5-compatible JavaScript.

| File | Purpose |
|---|---|
| `wwwroot/css/site.css` | Design tokens and the wood theme |
| `wwwroot/css/components.css` | Toasts, modals, loaders, skeletons, stars, search, PWA |
| `wwwroot/js/notify.js` | `WOS.toast/confirm/alert/showLoader/buttonBusy/api` |
| `wwwroot/js/site.js` | Search, reviews, validation, cart AJAX, PWA, form guards |
| `wwwroot/sw.js` | Service worker — cache-first assets, network-first pages |

### Notifications

Nothing fails silently. Server messages set through `TempData` are replayed as toasts, and `WOS.api()` turns every network error, HTTP error, expired session and rate limit into a visible message.

```javascript
WOS.success('Saved.');
WOS.error('Could not reach the server.');
await WOS.confirm('Delete this item?', 'Please confirm', { tone: 'danger' });

const restore = WOS.buttonBusy(button, 'Saving...');
const res = await WOS.api('/api/reviews', { method: 'POST', body: { … } });
restore();
```

### Validation

Client-side rules are declarative, and every rule is enforced again on the server:

```html
<input data-validate="required|email" data-label="Email address" />
<textarea data-validate="required|min:10" data-counter="myCounter"></textarea>
```

Supported: `required`, `email`, `phone`, `pincode`, `min:n`, `max:n`, `number`, `match:id`.

---

## Visitor counter

The footer shows the total visit count alongside **the visitor's own** IP address and approximate city. One visitor can never see another visitor's IP through the site — the API only ever returns the caller's own address.

IPs are resolved from `X-Forwarded-For` (Azure App Service terminates TLS at the front end), geolocated through a free API with a 12-hour cache, and de-duplicated to one visit per IP per day. Set `Features.EnableGeoLocation: false` to skip the lookup entirely.

---

## Project structure

```
src/WoodOnlineService/
├── Areas/Admin/              Admin panel
├── Controllers/
│   ├── Api/                  JSON APIs (payment, reviews, search, visitor)
│   └── BaseController.cs     Cart badge + footer categories on every page
├── Data/
│   ├── ApplicationDbContext.cs
│   └── DbSeeder.cs
├── Middleware/
│   ├── GlobalExceptionMiddleware.cs
│   └── SecurityHeadersMiddleware.cs
├── Models/
├── Services/
│   ├── InstamojoService.cs   Payment requests, status checks, HMAC verification
│   ├── NotificationService.cs
│   ├── EmailTemplates.cs
│   ├── ReviewService.cs
│   ├── VisitorService.cs
│   ├── CartService.cs
│   ├── OrderService.cs
│   └── ImageService.cs
├── ViewModels/
├── Views/
├── Migrations/
└── wwwroot/
```

---

## Live deployment

The site is deployed to Azure App Service.

| | |
|---|---|
| **Site** | https://woodonlineservice.azurewebsites.net |
| **Admin** | https://woodonlineservice.azurewebsites.net/Admin/Dashboard |
| Resource group | `rg-woodonline-sea` |
| App Service | `woodonlineservice` (Linux, F1 free tier) |
| Database | `sql-woodonline-sea` / `WoodOnlineService` (Azure SQL Basic) |
| Region | Southeast Asia |

### Redeploying

```powershell
.\deploy-to-azure.ps1
```

The script publishes, refuses to continue if a secrets file would be shipped, packages, uploads
and waits for the site to answer.

> **Do not use `Compress-Archive` to build the package.** It writes Windows backslashes into the
> zip entry names, and Kudu extracts on Linux — rsync then fails with
> `failed to stat "...wwwroot\sw.js": Invalid argument` and the portal only reports
> "Deployment Failed". The script builds the zip with forward slashes for this reason.

### Where the secrets live

Nothing sensitive is in the repository or the deployment package. `appsettings.Development.json`
and `appsettings.Production.json` are excluded by the csproj and gitignored; the real values are
Azure **App Settings**:

```
ASPNETCORE_ENVIRONMENT, DatabaseProvider, ConnectionStrings__DefaultConnection,
AdminUser__Email, AdminUser__Password,
Instamojo__Mode, Instamojo__ApiKey, Instamojo__AuthToken, Instamojo__Salt,
Instamojo__SiteBaseUrl, SiteSettings__SiteBaseUrl, Security__RequireHttps
```

View or change them with:

```bash
az webapp config appsettings list --name woodonlineservice --resource-group rg-woodonline-sea -o table
```

### The free tier sleeps

F1 idles out after about 20 minutes, and a sleeping app can miss the Instamojo webhook — the
customer would have paid while the order still said Pending. `PaymentReconciliationService`
covers this: every five minutes it asks Instamojo about pending payments and settles any the
webhook missed, sending the confirmation emails that never went out.

That is a safety net, not a substitute. For a real shop, move to **B1 (~$13/month)**, which never
sleeps:

```bash
az appservice plan update --name asp-woodonline --resource-group rg-woodonline-sea --sku B1
```

### Costs

| Resource | Tier | Approx. cost |
|---|---|---|
| App Service | F1 | Free |
| Azure SQL | Basic, 2 GB | ~$5/month |

### Useful commands

```bash
# live logs
az webapp log tail --name woodonlineservice --resource-group rg-woodonline-sea

# restart
az webapp restart --name woodonlineservice --resource-group rg-woodonline-sea

# delete everything (irreversible)
az group delete --name rg-woodonline-sea --yes
```

---

## Deployment

### 1. Azure SQL Database

Create a database (Basic or Standard S0 is enough to start), then allow Azure services through its firewall.

Copy the ADO.NET connection string from the portal:

```
Server=tcp:YOUR-SERVER.database.windows.net,1433;Initial Catalog=WoodOnlineService;
User ID=YOUR-USER;Password=YOUR-PASSWORD;Encrypt=True;TrustServerCertificate=False;
Connection Timeout=30;MultipleActiveResultSets=True
```

Migrations run automatically at startup, so there is no separate database deployment step.

### 2. Azure App Service

Create a Windows or Linux App Service on the **.NET 8** runtime (B1 or higher — the Free tier sleeps and will drop webhooks).

Then publish:

```bash
cd src/WoodOnlineService
dotnet publish -c Release -o ./publish
```

Deploy `publish/` through Visual Studio, the Azure CLI, or GitHub Actions.

### 3. App Settings

Set these in **Configuration → Application settings**, not in a committed file. Azure uses `__` for nesting:

| Name | Value |
|---|---|
| `DatabaseProvider` | `SqlServer` |
| `ConnectionStrings__DefaultConnection` | your Azure SQL string |
| `AdminUser__Email` | your admin email |
| `AdminUser__Password` | a strong password |
| `Instamojo__Enabled` | `true` |
| `Instamojo__ApiKey` | your API key |
| `Instamojo__AuthToken` | your auth token |
| `Instamojo__Salt` | your private salt |
| `Instamojo__SiteBaseUrl` | `https://your-domain.com` |
| `Smtp__Enabled` | `true` |
| `Smtp__UserName` | your email |
| `Smtp__Password` | your app password |
| `Smtp__AdminEmail` | where notifications go |
| `SiteSettings__SiteBaseUrl` | `https://your-domain.com` |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

`AdminUser` is only used to create the account on first run. After that, change the password from `/Account/ChangePassword`.

### 4. Domain and HTTPS

Add your custom domain in App Service, bind a certificate (free App Service Managed Certificate works), and turn on **HTTPS Only**. HSTS and HTTPS redirection are already enabled in code.

### 5. Uploads

Product images are written to `wwwroot/uploads`. On App Service this lives on persistent storage but is **not** included in a deployment backup — back it up separately, or move it to Azure Blob Storage if the catalogue grows large.

### Go-live checklist

- [ ] Admin password changed from the default
- [ ] Instamojo keys set in App Settings, tested with a ₹1 order
- [ ] Webhook reachable at `https://your-domain.com/api/payment/webhook`
- [ ] SMTP configured and a test email received
- [ ] `SiteSettings` updated with the real phone, WhatsApp, address and hours
- [ ] Google Maps embed URL added
- [ ] Real product photographs uploaded, seed placeholders removed
- [ ] Shipping charge and free-shipping threshold confirmed
- [ ] HTTPS Only enabled
- [ ] Database backups scheduled
- [ ] `wwwroot/uploads` backup scheduled
- [ ] Full order flow tested on a real phone

---

## Configuration reference

### SiteSettings

Shop details used across the site and in emails.

```json
"SiteSettings": {
  "ShopName": "Wood Online Service",
  "Phone": "+91 98765 43210",
  "WhatsAppNumber": "919876543210",
  "Email": "info@woodonlineservice.in",
  "AddressLine1": "Shop No. 12, Main Market Road",
  "AddressLine2": "Varanasi, Uttar Pradesh - 221005",
  "WorkingHours": "Monday to Saturday, 10:00 AM - 8:00 PM",
  "MapEmbedUrl": "",
  "SiteBaseUrl": "https://your-domain.com",
  "ShippingCharge": 500,
  "FreeShippingAbove": 20000
}
```

`WhatsAppNumber` takes the country code with no `+`. For `MapEmbedUrl`, use Google Maps → Share → Embed a map → copy the `src` URL.

### Features

```json
"Features": {
  "EnableReviews": true,
  "ModerateReviews": true,        // reviews need admin approval before appearing
  "RequirePurchaseToReview": false,
  "EnableVisitorCounter": true,
  "EnableGeoLocation": true,
  "EnablePwa": true
}
```

### Security

```json
"Security": {
  "GeneralRateLimit": 100,
  "SensitiveRateLimit": 10,
  "RateLimitWindowSeconds": 60,
  "MaxFailedLoginAttempts": 5,
  "LockoutMinutes": 15,
  "EnableSecurityHeaders": true,
  "RequireHttps": true
}
```

---

## Notes for developers

**Custom-order products** (`IsCustomOrder = true`) show "Price on request", cannot be added to the cart, and route the customer to the inquiry form instead. Use them for temples, custom doors and made-to-measure work.

**Order numbers** follow `WOS-YYYYMMDD-NNNN`, restarting at 0001 each day.

**Ratings are denormalised** onto `Product.AverageRating` and `Product.ReviewCount`, recalculated whenever a review is approved, edited or deleted. Listing pages therefore never aggregate the reviews table.

**Order placement runs inside an execution strategy.** Azure SQL uses a retrying strategy that refuses user-initiated transactions unless the whole unit is wrapped — `OrderService.PlaceOrderAsync` does this. Follow the same pattern for any new multi-step write.

**Migrations target SQL Server.** On SQLite the schema is created from the model with
`EnsureCreated` instead (see `DbSeeder`), because the two providers generate different
column types. When you change an entity, add a migration with the SQL Server provider
selected; SQLite picks the change up automatically after you delete the dev database file.

```bash
# with DatabaseProvider set to SqlServer and a reachable server
dotnet ef migrations add YourChangeName
```

**Stock movements** happen on transitions only: deducted at placement, returned on cancellation, deducted again if a cancelled order is reinstated. This keeps repeated saves from double-counting.

---

## Tech stack

| | |
|---|---|
| Framework | ASP.NET Core 8 MVC |
| Database | Azure SQL Database (SQL Server) |
| ORM | Entity Framework Core 8 |
| Auth | ASP.NET Core Identity, role-based |
| Payments | Instamojo (UPI, cards, net banking, wallets) |
| Email | SMTP with responsive HTML templates |
| UI | Bootstrap 5 with a custom wood theme |
| PWA | Service worker, manifest, offline support |
| Hosting | Azure App Service |

---

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 Er Gaurav Kumar.
