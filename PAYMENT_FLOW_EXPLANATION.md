# Payment Flow Explanation

## When Payment Happens

### The Flow:

1. **Customer posts job** → No payment yet
2. **Hustler applies/sends offer** → No payment yet
3. **Customer accepts offer** → **PAYMENT POPUP HAPPENS HERE** ⬅️ Customer pays
4. **Hustler starts job** → No payment change (already authorized)
5. **Hustler completes job** → Payment is captured (charged)

## Key Point: Customer Pays When Accepting Offer

The payment popup should appear when the **CUSTOMER** clicks "Accept Offer", not when the hustler does anything.

## Payment Flow Details

### Step 1: Customer Accepts Offer
- Customer clicks "Accept Offer" button
- **Payment popup/modal appears** (Stripe Elements in same tab)
- Customer enters card: `4242 4242 4242 4242`
- Payment is **authorized** (not charged yet)
- Offer is accepted, job moves to "SCHEDULED"

### Step 2: Hustler Starts Job
- Hustler enters start code
- Job moves to "IN_PROGRESS"
- **No payment change** - still just authorized

### Step 3: Hustler Completes Job
- Hustler enters completion code
- Payment is **captured** (customer is charged)
- Transfer sent to hustler (minus 12% fee)
- Job moves to "COMPLETED"

## Stripe Elements Modal (Same Tab)

You can use Stripe Elements to show a payment modal/popup **within the same page** (not redirecting). This is what you want!

### How It Works:

1. Customer clicks "Accept Offer"
2. Frontend calls: `POST /payments/create-intent/offer/:offerId`
3. Backend returns: `{ clientSecret: "...", paymentIntentId: "..." }`
4. Frontend shows **Stripe Elements modal** (overlay on same page)
5. Customer enters card in modal
6. Payment authorized
7. Frontend calls: `POST /offers/:id/accept { paymentIntentId: "..." }`
8. Offer accepted, modal closes

## Implementation

### Frontend: Stripe Elements Modal

```javascript
// When customer clicks "Accept Offer"
async function acceptOffer(offerId) {
  // Step 1: Create payment intent
  const intentResponse = await fetch(`/payments/create-intent/offer/${offerId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const intentData = await intentResponse.json();
  
  // Step 2: Show Stripe Elements modal
  const stripe = Stripe('pk_test_YOUR_KEY');
  const elements = stripe.elements();
  const cardElement = elements.create('card');
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'payment-modal';
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <h3>Complete Payment</h3>
        <div id="card-element"></div>
        <button id="pay-button">Pay $${amount}</button>
        <button id="cancel-button">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Mount Stripe Elements
  cardElement.mount('#card-element');
  
  // Handle payment
  document.getElementById('pay-button').onclick = async () => {
    const { paymentIntent, error } = await stripe.confirmCardPayment(
      intentData.clientSecret,
      { payment_method: { card: cardElement } }
    );
    
    if (error) {
      alert('Payment failed: ' + error.message);
    } else {
      // Payment authorized! Accept offer
      await fetch(`/offers/${offerId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id
        })
      });
      
      // Close modal, refresh page
      modal.remove();
      location.reload();
    }
  };
}
```

## Summary

- **Payment popup happens:** When customer accepts offer
- **Where:** In-page modal (same tab, not separate window)
- **How:** Stripe Elements modal overlay
- **When customer pays:** At offer acceptance (authorized, not charged)
- **When customer is charged:** When hustler completes job

