# Stripe Elements Modal Implementation Guide

## Goal: Payment Popup in Same Tab (Not Separate Window)

Use Stripe Elements to create an in-page modal/popup for payments.

## Step-by-Step Implementation

### Step 1: Load Stripe.js

```html
<script src="https://js.stripe.com/v3/"></script>
```

### Step 2: Create Payment Modal HTML

```html
<!-- Payment Modal (hidden by default) -->
<div id="payment-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%;">
    <h2 style="margin-top: 0;">Complete Payment</h2>
    <p>Enter your payment details to accept this offer.</p>
    
    <!-- Stripe Elements will mount here -->
    <div id="card-element" style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 4px; margin: 1rem 0;"></div>
    
    <!-- Error message -->
    <div id="card-errors" style="color: #ef4444; margin: 0.5rem 0;"></div>
    
    <!-- Buttons -->
    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
      <button id="pay-button" style="flex: 1; padding: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
        Pay $${amount}
      </button>
      <button id="cancel-payment" style="padding: 0.75rem 1.5rem; background: #e2e8f0; color: #475569; border: none; border-radius: 6px; cursor: pointer;">
        Cancel
      </button>
    </div>
  </div>
</div>
```

### Step 3: JavaScript Implementation

```javascript
let stripe, cardElement, paymentModal;

// Initialize Stripe
function initStripe() {
  stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY'); // Get from backend or env
}

// Show payment modal
async function showPaymentModal(offerId, amount) {
  // Step 1: Create payment intent
  const intentResponse = await fetch(`/payments/create-intent/offer/${offerId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!intentResponse.ok) {
    alert('Failed to create payment. Please try again.');
    return;
  }
  
  const intentData = await intentResponse.json();
  
  // Step 2: Show modal
  paymentModal = document.getElementById('payment-modal');
  paymentModal.style.display = 'block';
  
  // Step 3: Create Stripe Elements
  const elements = stripe.elements();
  cardElement = elements.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
    },
  });
  
  cardElement.mount('#card-element');
  
  // Handle errors
  cardElement.on('change', ({error}) => {
    const displayError = document.getElementById('card-errors');
    if (error) {
      displayError.textContent = error.message;
    } else {
      displayError.textContent = '';
    }
  });
  
  // Handle payment button
  document.getElementById('pay-button').onclick = async () => {
    const button = document.getElementById('pay-button');
    button.disabled = true;
    button.textContent = 'Processing...';
    
    const { paymentIntent, error } = await stripe.confirmCardPayment(
      intentData.clientSecret,
      {
        payment_method: {
          card: cardElement,
        }
      }
    );
    
    if (error) {
      // Show error
      document.getElementById('card-errors').textContent = error.message;
      button.disabled = false;
      button.textContent = `Pay $${amount}`;
    } else {
      // Payment authorized! Accept offer
      await acceptOfferWithPayment(offerId, paymentIntent.id);
    }
  };
  
  // Handle cancel
  document.getElementById('cancel-payment').onclick = () => {
    closePaymentModal();
  };
  
  // Close on overlay click
  paymentModal.onclick = (e) => {
    if (e.target === paymentModal) {
      closePaymentModal();
    }
  };
}

// Accept offer with payment
async function acceptOfferWithPayment(offerId, paymentIntentId) {
  try {
    const response = await fetch(`/offers/${offerId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentIntentId: paymentIntentId
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Success!
      closePaymentModal();
      alert('✅ Offer accepted! Payment authorized.');
      // Refresh page or update UI
      location.reload();
    } else {
      alert('Error: ' + (data.message || 'Failed to accept offer'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to accept offer. Please try again.');
  }
}

// Close payment modal
function closePaymentModal() {
  if (paymentModal) {
    paymentModal.style.display = 'none';
  }
  if (cardElement) {
    cardElement.unmount();
    cardElement = null;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initStripe();
});
```

### Step 4: Trigger Payment Modal

When customer clicks "Accept Offer":

```javascript
// On "Accept Offer" button click
document.getElementById('accept-offer-button').onclick = () => {
  const offerId = 'YOUR_OFFER_ID';
  const amount = 100.00; // Get from offer/job data
  
  showPaymentModal(offerId, amount);
};
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
  <!-- Your page content -->
  <button id="accept-offer-btn" onclick="handleAcceptOffer('offer-id-123', 100.00)">
    Accept Offer
  </button>
  
  <!-- Payment Modal -->
  <div id="payment-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%;">
      <h2>Complete Payment</h2>
      <div id="card-element"></div>
      <div id="card-errors" style="color: red;"></div>
      <button id="pay-btn">Pay</button>
      <button id="cancel-btn">Cancel</button>
    </div>
  </div>
  
  <script>
    const stripe = Stripe('pk_test_YOUR_KEY');
    let cardElement;
    
    async function handleAcceptOffer(offerId, amount) {
      // Create payment intent
      const res = await fetch(`/payments/create-intent/offer/${offerId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { clientSecret } = await res.json();
      
      // Show modal
      document.getElementById('payment-modal').style.display = 'block';
      
      // Create card element
      const elements = stripe.elements();
      cardElement = elements.create('card');
      cardElement.mount('#card-element');
      
      // Handle payment
      document.getElementById('pay-btn').onclick = async () => {
        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement }
        });
        
        if (error) {
          document.getElementById('card-errors').textContent = error.message;
        } else {
          // Accept offer
          await fetch(`/offers/${offerId}/accept`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id })
          });
          
          // Close modal, refresh
          document.getElementById('payment-modal').style.display = 'none';
          location.reload();
        }
      };
    }
  </script>
</body>
</html>
```

## Key Points

1. **Same tab:** Modal is an overlay on the same page
2. **Stripe Elements:** Handles card input securely
3. **Flow:** Create intent → Show modal → Collect payment → Accept offer
4. **No redirects:** Everything happens on your page

## Backend Endpoints

- `POST /payments/create-intent/offer/:offerId` - Creates payment intent, returns `clientSecret`
- `POST /offers/:id/accept` - Accepts offer with `paymentIntentId`

Both are ready and working!

