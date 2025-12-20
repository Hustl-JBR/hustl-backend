# Frontend Steps: Show "Account Connected" Status

## Backend is Ready ✅

The backend endpoint `/stripe-connect/status` returns:
- `connected: true/false` - Whether account is connected
- `accountId` - The Stripe account ID
- `justConnected: true` - If account just became connected (for success message)
- `message` - Status message

## Frontend Implementation Steps

### Step 1: Check Status on Page Load

When the profile/payment setup page loads, check the Stripe connection status:

```javascript
// On profile/payment setup page load
async function checkStripeStatus() {
  try {
    const response = await fetch('/stripe-connect/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.connected) {
      // Show "Account Connected" UI
      showConnectedStatus(data);
      
      // Show success message if just connected
      if (data.justConnected) {
        showSuccessMessage('✅ Stripe account connected successfully!');
      }
    } else {
      // Show "Connect Stripe" button
      showConnectButton();
    }
  } catch (error) {
    console.error('Error checking Stripe status:', error);
  }
}
```

### Step 2: Check Status When Returning from Stripe

When URL has `?stripe_onboarding=success`, check status immediately:

```javascript
// On page load, check if returning from Stripe
if (window.location.search.includes('stripe_onboarding=success')) {
  // Remove query param from URL
  window.history.replaceState({}, document.title, window.location.pathname);
  
  // Check status
  checkStripeStatus();
}
```

### Step 3: Update Payment Setup UI

Replace the "Connect Stripe" button with "Account Connected" when connected:

```javascript
function showConnectedStatus(statusData) {
  // Hide "Connect Stripe" button
  const connectButton = document.querySelector('#connect-stripe-button');
  if (connectButton) {
    connectButton.style.display = 'none';
  }
  
  // Show "Account Connected" status
  const statusDiv = document.querySelector('#stripe-status');
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; color: #10b981;">
        <span>✅</span>
        <span><strong>Account Connected</strong></span>
      </div>
      <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">
        ${statusData.message || 'Your Stripe account is connected and ready to receive payments.'}
      </p>
    `;
    statusDiv.style.display = 'block';
  }
}

function showConnectButton() {
  // Show "Connect Stripe" button
  const connectButton = document.querySelector('#connect-stripe-button');
  if (connectButton) {
    connectButton.style.display = 'block';
  }
  
  // Hide "Account Connected" status
  const statusDiv = document.querySelector('#stripe-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
  }
}
```

### Step 4: Open Stripe Onboarding in Same Window (Not Popup)

When user clicks "Connect Stripe", redirect to Stripe (not popup):

```javascript
async function connectStripe() {
  try {
    // Get onboarding link
    const response = await fetch('/stripe-connect/onboarding-link', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.url) {
      // Redirect to Stripe (same window, not popup)
      window.location.href = data.url;
    }
  } catch (error) {
    console.error('Error getting Stripe onboarding link:', error);
    showError('Failed to connect Stripe. Please try again.');
  }
}
```

### Step 5: Complete Implementation

**HTML Structure:**
```html
<div id="payment-setup">
  <h3>💳 Payment Setup</h3>
  
  <!-- Show when NOT connected -->
  <div id="connect-stripe-section">
    <p>Connect with Stripe to receive payments directly to your bank.</p>
    <button id="connect-stripe-button" onclick="connectStripe()">
      💳 Connect Stripe & Start Earning
    </button>
  </div>
  
  <!-- Show when connected -->
  <div id="stripe-status" style="display: none;">
    <!-- Will be populated by showConnectedStatus() -->
  </div>
</div>
```

**Complete JavaScript:**
```javascript
// Check status on page load
document.addEventListener('DOMContentLoaded', () => {
  checkStripeStatus();
  
  // If returning from Stripe, check immediately
  if (window.location.search.includes('stripe_onboarding=success')) {
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => checkStripeStatus(), 1000); // Wait a moment for backend to process
  }
});

// Connect Stripe function
async function connectStripe() {
  try {
    const response = await fetch('/stripe-connect/onboarding-link', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.url) {
      // Redirect to Stripe (same window)
      window.location.href = data.url;
    } else {
      showError('Failed to get Stripe onboarding link');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to connect Stripe. Please try again.');
  }
}

// Check Stripe status
async function checkStripeStatus() {
  try {
    const response = await fetch('/stripe-connect/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.connected) {
      showConnectedStatus(data);
      if (data.justConnected) {
        showSuccessMessage('✅ Stripe account connected successfully!');
      }
    } else {
      showConnectButton();
    }
  } catch (error) {
    console.error('Error checking Stripe status:', error);
  }
}

function showConnectedStatus(statusData) {
  document.getElementById('connect-stripe-section').style.display = 'none';
  const statusDiv = document.getElementById('stripe-status');
  statusDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; color: #10b981; margin-bottom: 0.5rem;">
      <span style="font-size: 1.2rem;">✅</span>
      <span style="font-weight: 600; font-size: 1.1rem;">Account Connected</span>
    </div>
    <p style="color: #64748b; font-size: 0.9rem; margin: 0;">
      ${statusData.message || 'Your Stripe account is connected and ready to receive payments.'}
    </p>
  `;
  statusDiv.style.display = 'block';
}

function showConnectButton() {
  document.getElementById('connect-stripe-section').style.display = 'block';
  document.getElementById('stripe-status').style.display = 'none';
}
```

## Testing Checklist

- [ ] Page loads → Calls `/stripe-connect/status`
- [ ] If `connected: false` → Shows "Connect Stripe" button
- [ ] If `connected: true` → Shows "✅ Account Connected"
- [ ] Click "Connect Stripe" → Redirects to Stripe (same window)
- [ ] Complete Stripe onboarding → Returns to Hustl
- [ ] URL has `?stripe_onboarding=success` → Checks status again
- [ ] Status shows `connected: true` → Updates UI to "Account Connected"
- [ ] Success message shows if `justConnected: true`

## Expected Behavior

1. **First time:** Shows "Connect Stripe" button
2. **Click button:** Redirects to Stripe (same window)
3. **Complete onboarding:** Returns to Hustl with `?stripe_onboarding=success`
4. **Page checks status:** Backend returns `connected: true`
5. **UI updates:** Shows "✅ Account Connected" instead of button
6. **Email sent:** User receives "Stripe account connected" email

## Backend Endpoints Used

- `GET /stripe-connect/status` - Check connection status
- `POST /stripe-connect/onboarding-link` - Get Stripe onboarding URL

Both endpoints require authentication and HUSTLER role.

