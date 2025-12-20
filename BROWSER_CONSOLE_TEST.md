# Quick Payment Test - Copy & Paste in Browser Console

## Super Simple Version (3 Steps)

### Step 1: Get Your Info
1. Open your browser console (F12 → Console tab)
2. You're on the job page with an offer you want to accept
3. Copy the offer ID from the URL or page (looks like: `cmjawnxou000110hksjudx8eb`)

### Step 2: Copy This Script

Replace `YOUR_OFFER_ID` with your actual offer ID, then paste in console:

```javascript
(async () => {
  const OFFER_ID = 'YOUR_OFFER_ID'; // ← CHANGE THIS
  
  // Get auth token automatically
  const token = localStorage.getItem('token') || 
                 document.cookie.split(';').find(c => c.includes('token'))?.split('=')[1] ||
                 'YOUR_TOKEN_HERE'; // If above doesn't work, paste your token here
  
  console.log('🚀 Starting payment test...');
  
  try {
    // Step 1: Create payment intent
    console.log('📝 Creating payment intent...');
    const intentRes = await fetch(`https://hustljobs.com/payments/create-intent/offer/${OFFER_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!intentRes.ok) {
      const error = await intentRes.json();
      console.error('❌ Error creating intent:', error);
      return;
    }
    
    const intentData = await intentRes.json();
    console.log('✅ Payment intent created:', intentData);
    
    // Step 2: Authorize payment (using Stripe test card)
    console.log('💳 Authorizing payment...');
    
    // Check if Stripe is loaded
    if (typeof Stripe === 'undefined') {
      console.error('❌ Stripe.js not loaded. Loading it now...');
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      document.head.appendChild(script);
      await new Promise(resolve => script.onload = resolve);
    }
    
    // Get publishable key from page or use test key
    const publishableKey = window.stripePublishableKey || 'pk_test_51SgY4nHv07XVqtRwYOUR_KEY'; // ← May need to update
    
    const stripe = Stripe(publishableKey);
    const confirmResult = await stripe.confirmCardPayment(intentData.clientSecret, {
      payment_method: {
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvc: '123',
        },
      }
    });
    
    if (confirmResult.error) {
      console.error('❌ Payment failed:', confirmResult.error);
      return;
    }
    
    console.log('✅ Payment authorized!', confirmResult.paymentIntent.id);
    
    // Step 3: Accept offer
    console.log('✅ Accepting offer...');
    const acceptRes = await fetch(`https://hustljobs.com/offers/${OFFER_ID}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        paymentIntentId: confirmResult.paymentIntent.id
      })
    });
    
    const acceptData = await acceptRes.json();
    
    if (acceptRes.ok) {
      console.log('🎉 SUCCESS! Offer accepted!', acceptData);
      console.log('✅ Job should now be SCHEDULED');
      alert('✅ Offer accepted successfully! Check the job status.');
    } else {
      console.error('❌ Error accepting offer:', acceptData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

### Step 3: Run It!

1. Paste the script in browser console
2. Replace `YOUR_OFFER_ID` with your actual offer ID
3. Press Enter
4. Watch the console for success messages!

## What You'll See

- ✅ Payment intent created
- ✅ Payment authorized (using test card 4242...)
- ✅ Offer accepted
- ✅ Job moves to SCHEDULED status

## If It Doesn't Work

**Error: "Unauthorized"**
- Your token might be expired
- Try logging out and back in
- Or manually get token: `localStorage.getItem('token')`

**Error: "Stripe is not defined"**
- The page needs to load Stripe.js
- Try refreshing the page first
- Or the publishable key might be wrong

**Error: "Offer not found"**
- Check the offer ID is correct
- Make sure you're logged in as the customer (not hustler)

## Need Help?

Check the browser console for detailed error messages. The script will tell you exactly what went wrong at each step.

