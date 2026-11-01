# zirveokey

## Resend webhook

Configure `RESEND_WEBHOOK_SECRET` with the signing secret shown for the Resend webhook endpoint. The receiver is `POST /api/webhooks/resend`; it validates Svix signatures and rejects timestamps older than five minutes. Supported events are stored idempotently by `svix-id` in `resend_webhook_events`.

The webhook route is available only after this change is deployed. Configure the same signing secret in the production service environment before enabling delivery.
