# ZirveOkey

ZirveOkey web application.

## Server configuration

The account, session, profile, notification and lobby APIs require PostgreSQL and a session secret.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret used to sign member sessions; use a long, random value |
| `APP_URL` | For email flows | Canonical HTTPS base URL of the deployed application |
| `RESEND_API_KEY` | For email flows | Resend API key with permission to send from the configured domain |
| `MAIL_FROM` | For email flows | Verified sender identity, e.g. `ZirveOkey <no-reply@your-verified-domain>` |
| `SUPPORT_EMAIL` | For contact form | Destination inbox for contact form messages |

### Password reset and email address verification

Set `RESEND_API_KEY`, `MAIL_FROM` and `APP_URL` in the deployment environment. The sender domain used by `MAIL_FROM` must be verified in Resend. These values enable password reset and one-time email address verification links.

### Contact form

The contact form additionally requires `SUPPORT_EMAIL`. When any required value is missing, the form remains hidden and the API reports that delivery is not configured. Do not add API keys or real secrets to this repository.

### Render deployment

Add the variables in the Render service's Environment settings. Use the same `APP_URL` users open in their browsers, an approved sender address for `MAIL_FROM`, and the actual support inbox for `SUPPORT_EMAIL`. Save secret values directly in Render; do not commit them.

## Local development

1. Copy `.env.example` to `.env` and fill in local PostgreSQL/session values.
2. Run `npm install`.
3. Run `npm start`.

The test workflow uses its own temporary PostgreSQL service and deliberately leaves email credentials unset, so it verifies that email-dependent actions fail safely when delivery is not configured.
