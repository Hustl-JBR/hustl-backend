# Testing Payment Flow in Browser Console

Since the frontend payment popup isn't implemented yet, you can test the payment flow directly in your browser console.

## Step-by-Step Test Flow

### 1. Open Browser Console
- Press `F12` or `Right-click → Inspect → Console`
- Make sure you're logged in as the **customer** account

### 2. Get the Offer ID
- Go to your job posting
- Find the offer you want to accept
- Copy the offer ID (it looks like: `cmjawnxou000110hksjudx8eb`)

### 3. Create Payment Intent (Run in Console)

```javascript
// Replace OFFER_ID with your actual offer ID
const offerId = 'YOUR_OFFER_ID_HERE';

// Get your auth token (check localStorage or cookies)
const token = localStorage.getItem('token') || document.cookie.match(/token=([^;]+)/)?.[1];

// Create payment intent
fetch(`https://hustljobs.com/payments/create-intent/offer/${offerId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('Payment Intent Created:', data);
  window.testPaymentIntent = data; // Save for next step
  return data;
})
.catch(err => console.error('Error:', err));
```

### 4. Authorize Payment with Stripe (Run in Console)

After step 3, you'll get a `clientSecret`. Now authorize it:

```javascript
// This uses Stripe.js to confirm the payment
// Make sure Stripe.js is loaded on the page (it should be)

const stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY'); // Get from Railway env vars

stripe.confirmCardPayment(window.testPaymentIntent.clientSecret, {
  payment_method: {
    card: {
      number: '4242424242424242',
      exp_month: 12,
      exp_year: 2025,
      cvc: '123',
    },
    billing_details: {
      name: 'Test Customer',
      email: 'test@example.com'
    }
  }
})
.then(result => {
  if (result.error) {
    console.error('Payment failed:', result.error);
  } else {
    console.log('Payment authorized!', result);
    window.testPaymentIntentId = result.paymentIntent.id;
    console.log('Payment Intent ID:', window.testPaymentIntentId);
    console.log('Now run the accept offer command below!');
  }
});
```

### 5. Accept the Offer (Run in Console)

```javascript
// Use the paymentIntentId from step 4
const offerId = 'YOUR_OFFER_ID_HERE';
const paymentIntentId = window.testPaymentIntentId;

fetch(`https://hustljobs.com/offers/${offerId}/accept`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    paymentIntentId: paymentIntentId
  })
})
.then(r => r.json())
.then(data => {
  console.log('Offer Accepted!', data);
})
.catch(err => console.error('Error:', err));
```

## Quick All-in-One Script

If you want to do it all at once, here's a combined script:

```javascript
// ===== CONFIGURATION =====
const OFFER_ID = 'YOUR_OFFER_ID_HERE';
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY'; // Get from Railway
const token = localStorage.getItem('token') || document.cookie.match(/token=([^;]+)/)?.[1];

// ===== STEP 1: Create Payment Intent =====
fetch(`https://hustljobs.com/payments/create-intent/offer/${OFFER_ID}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(async (data) => {
  console.log('✅ Payment Intent Created:', data);
  
  // ===== STEP 2: Authorize Payment =====
  const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  
  const result = await stripe.confirmCardPayment(data.clientSecret, {
    payment_method: {
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2025,
        cvc: '123',
      },
      billing_details: {
        name: 'Test Customer',
        email: 'test@example.com'
      }
    }
  });
  
  if (result.error) {
    console.error('❌ Payment failed:', result.error);
    return;
  }
  
  console.log('✅ Payment Authorized:', result.paymentIntent.id);
  
  // ===== STEP 3: Accept Offer =====
  const acceptResult = await fetch(`https://hustljobs.com/offers/${OFFER_ID}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      paymentIntentId: result.paymentIntent.id
    })
  });
  
  const acceptData = await acceptResult.json();
  console.log('✅ Offer Accepted!', acceptData);
})
.catch(err => console.error('❌ Error:', err));
```

## What You Need

1. **Offer ID**: From your job posting page
2. **Auth Token**: Check browser localStorage or cookies
3. **Stripe Publishable Key**: From Railway environment variables (`STRIPE_PUBLISHABLE_KEY`)

## Expected Results

- Payment intent created in Stripe (status: `requires_capture`)
- Payment authorized successfully
- Offer accepted, job moves to `SCHEDULED` status
- You can see the payment in Stripe dashboard (status: `requires_capture`)

## Troubleshooting

- **"Unauthorized"**: Check your auth token
- **"Offer not found"**: Check the offer ID
- **"Payment failed"**: Make sure Stripe.js is loaded on the page
- **"Stripe is not defined"**: The page needs to load Stripe.js first

