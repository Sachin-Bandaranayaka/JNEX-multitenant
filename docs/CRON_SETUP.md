# Cron Job Setup with cron-job.org

This application uses **cron-job.org** to automatically check for order tracking updates (delivered and returned orders).

## Why cron-job.org?

- ✅ **Free** - Unlimited cron jobs on free tier
- ✅ **Frequent execution** - Can run every minute if needed (we use hourly)
- ✅ **Better monitoring** - Dashboard with execution logs and alerts
- ✅ **Email notifications** - Get notified on failures
- ✅ **Platform independent** - Works regardless of deployment platform

## Setup Instructions

### 1. Create Account

1. Go to [https://cron-job.org](https://cron-job.org)
2. Click **"Sign up"** (top right)
3. Register with your email
4. Verify your email address

### 2. Get Your Cron Secret Key

The cron endpoint is protected with a secret key to prevent unauthorized access.

1. Check your `.env` file for `CRON_SECRET_KEY`
2. If not set, generate a secure random string:
   ```bash
   # Generate a secure random key
   openssl rand -base64 32
   ```
3. Add to your `.env` file:
   ```env
   CRON_SECRET_KEY=your_generated_secret_key_here
   ```
4. **Deploy this change** to your production environment before setting up the cron job

### 3. Create Cron Job

1. Log in to [https://console.cron-job.org](https://console.cron-job.org)
2. Click **"Create cronjob"**
3. Configure the job:

   **Basic Settings:**
   - **Title:** `Order Tracking Updates`
   - **Address (URL):** `https://yourdomain.com/api/cron/tracking-updates`
     - Replace `yourdomain.com` with your actual domain
     - Example: `https://jnexmultitenant.vercel.app/api/cron/tracking-updates`

   **Schedule:**
   - **Every:** `1 hour(s)` (recommended)
   - **Starting at:** `00:00` (midnight)
   - **Timezone:** Select your timezone (e.g., `Asia/Colombo`)

   **Request Settings:**
   - **Request method:** `GET`
   - **Request timeout:** `30 seconds`

   **Headers:**
   Click "Add header" and add:
   - **Header name:** `Authorization`
   - **Header value:** `Bearer YOUR_CRON_SECRET_KEY`
     - Replace `YOUR_CRON_SECRET_KEY` with your actual secret key from `.env`

   **Notifications:**
   - ✅ Enable "Send email on execution failures"
   - Set failure threshold (e.g., after 3 consecutive failures)

4. Click **"Create cronjob"**

### 4. Test the Cron Job

1. In the cron-job.org dashboard, find your newly created job
2. Click the **"Run now"** button (▶️ icon)
3. Check the execution log:
   - ✅ **Success (200):** Cron job is working correctly
   - ❌ **401 Unauthorized:** Check your Authorization header and secret key
   - ❌ **500 Error:** Check your application logs

### 5. Monitor Execution

The dashboard shows:
- **Last execution:** When it last ran
- **Last status:** Success/failure
- **Execution history:** View logs of past runs
- **Statistics:** Success rate over time

## What This Cron Job Does

The `/api/cron/tracking-updates` endpoint:

1. **Finds shipped orders** that haven't been delivered yet
2. **Checks tracking status** with shipping providers:
   - Farda Express
   - Trans Express
   - Royal Express
3. **Auto-detects delivered orders** and updates status
4. **Auto-detects returned orders** and:
   - Updates order status to `RETURNED`
   - Restores product inventory
   - Creates stock adjustment record

## Recommended Schedule

| Frequency | Use Case |
|-----------|----------|
| **Every hour** | ⭐ Recommended - Good balance of updates and API usage |
| Every 30 minutes | High-priority orders needing quick updates |
| Every 2 hours | Low-traffic periods or API rate limit concerns |
| Daily | Not recommended - updates are too slow for customers |

## Security Notes

🔒 **Important:**
- Never commit your `CRON_SECRET_KEY` to version control
- Use a strong, random secret key (32+ characters)
- Rotate the key periodically (update both `.env` and cron-job.org)
- The endpoint validates the Authorization header on every request

## Troubleshooting

### 401 Unauthorized Error

```bash
# Check if CRON_SECRET_KEY is set in production
# Verify the Authorization header in cron-job.org matches your env variable
```

### 500 Server Error

```bash
# Check application logs for details
# Verify shipping provider API keys are configured
# Test endpoint manually with curl:
curl -H "Authorization: Bearer YOUR_SECRET_KEY" https://yourdomain.com/api/cron/tracking-updates
```

### No Orders Being Updated

- Check that orders have `shippingProvider` and `trackingNumber` set
- Verify shipping provider API credentials in database
- Check application logs for specific errors

## Alternative: Vercel Cron Jobs

If you prefer to use Vercel's built-in cron jobs:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/tracking-updates",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

Note: Frequent schedules (hourly or more) require Vercel Pro plan.

## Support

For issues with:
- **cron-job.org service:** [Support](https://cron-job.org/en/documentation.html)
- **Application endpoint:** Check application logs and error messages
