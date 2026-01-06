# AWS Amplify Cron Setup

Since AWS Amplify doesn't have built-in cron jobs like Vercel, you have two options:

## Option 1: cron-job.org (Recommended - Free & Simple)

### Setup Steps:

1. **Create Account**
   - Go to https://cron-job.org
   - Sign up for free account
   - Verify your email

2. **Create Cron Job**
   - Click "CREATE CRONJOB"
   - **Title:** "Order Tracking Updates"
   - **URL:** `https://YOUR_AMPLIFY_DOMAIN/api/cron/tracking-updates`
   - **Schedule:** Every 1 hour (recommended) or every 2 hours
   - **Request Method:** GET

3. **Add Authorization Header**
   - Click "Advanced" tab
   - Under "Headers", add:
     - **Header name:** `Authorization`
     - **Header value:** `Bearer YOUR_CRON_SECRET_KEY`

4. **Environment Variable**
   - In AWS Amplify Console → App Settings → Environment Variables
   - Add: `CRON_SECRET_KEY` = `your-secure-random-string`

5. **Test**
   - Click "Test run" in cron-job.org
   - Check the response - should return JSON with processed orders

### Rate Limiting Considerations:
- Royal Express API has rate limits
- **Recommended:** Run every 1-2 hours, not more frequently
- The cron job processes all SHIPPED orders in one batch
- Each order = 1 API call to Royal Express

---

## Option 2: AWS EventBridge + Lambda

For a fully AWS-native solution:

### 1. Create Lambda Function

```javascript
// lambda/tracking-cron.js
const https = require('https');

exports.handler = async (event) => {
  const options = {
    hostname: 'YOUR_AMPLIFY_DOMAIN',
    path: '/api/cron/tracking-updates',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET_KEY}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
};
```

### 2. Create EventBridge Rule

```bash
aws events put-rule \
  --name "OrderTrackingCron" \
  --schedule-expression "rate(1 hour)" \
  --state ENABLED

aws events put-targets \
  --rule "OrderTrackingCron" \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:tracking-cron"
```

### 3. Add Lambda Permission

```bash
aws lambda add-permission \
  --function-name tracking-cron \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT:rule/OrderTrackingCron
```

---

## Troubleshooting

### Cron not working?
1. Check CRON_SECRET_KEY is set in Amplify environment variables
2. Test the endpoint manually with curl:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" https://your-domain/api/cron/tracking-updates
   ```
3. Check Amplify logs for errors

### Rate limiting from Royal Express?
- Reduce frequency to every 2 hours
- The system batches all orders in one cron run
- Consider adding delays between API calls (see below)

---

## Adding Rate Limit Protection

If you're hitting rate limits, the cron job can be modified to add delays between orders.
See: `src/app/api/cron/tracking-updates/route.ts`
