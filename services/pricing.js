/**
 * Pricing Service
 * 
 * Centralized fee calculation logic for Hustl platform.
 * All payment-related fee calculations should use this service.
 * 
 * BUSINESS RULES (DO NOT MODIFY WITHOUT APPROVAL):
 * - Platform fee: 12% of job amount (charged to hustler, deducted from payout)
 * - Customer service fee: 6.5% of job amount (charged to customer, added to total)
 * - Hustler payout: 88% of job amount (job amount - platform fee)
 * - Customer total: job amount + customer service fee
 */

// Fee rates (centralized configuration)
const FEE_RATES = {
  PLATFORM_FEE_RATE: 0.12,      // 12% platform fee
  CUSTOMER_FEE_RATE: 0.065,     // 6.5% customer service fee
};

/**
 * Calculate all fees for a job
 * 
 * @param {number} jobAmount - The base job amount (what customer pays for the work)
 * @param {object} options - Optional parameters
 * @param {number} options.tipAmount - Tip amount (default: 0, tips NOT included in fee calculations)
 * @returns {object} Object containing all calculated amounts
 * 
 * @example
 * const fees = calculateFees(100);
 * // Returns:
 * // {
 * //   jobAmount: 100.00,
 * //   platformFee: 12.00,      // 12% of job amount
 * //   customerFee: 6.50,       // 6.5% of job amount
 * //   hustlerPayout: 88.00,    // 88% of job amount
 * //   total: 106.50            // job amount + customer fee
 * // }
 */
function calculateFees(jobAmount, options = {}) {
  // Validate input
  if (typeof jobAmount !== 'number' || jobAmount < 0) {
    throw new Error('Job amount must be a non-negative number');
  }

  const { tipAmount = 0 } = options;

  // Calculate fees based on job amount only (tips are NOT subject to fees)
  const platformFee = jobAmount * FEE_RATES.PLATFORM_FEE_RATE;
  const customerFee = jobAmount * FEE_RATES.CUSTOMER_FEE_RATE;
  const hustlerPayout = jobAmount - platformFee;
  const total = jobAmount + customerFee;

  // Return all amounts rounded to 2 decimal places
  return {
    jobAmount: Number(jobAmount.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    customerFee: Number(customerFee.toFixed(2)),
    hustlerPayout: Number(hustlerPayout.toFixed(2)),
    total: Number(total.toFixed(2)),
    tipAmount: Number(tipAmount.toFixed(2)), // Tips pass through, not included in calculations
  };
}

/**
 * Get fee rates (for display purposes)
 * @returns {object} Current fee rates
 */
function getFeeRates() {
  return {
    platformFeeRate: FEE_RATES.PLATFORM_FEE_RATE,
    platformFeePercent: (FEE_RATES.PLATFORM_FEE_RATE * 100).toFixed(1) + '%',
    customerFeeRate: FEE_RATES.CUSTOMER_FEE_RATE,
    customerFeePercent: (FEE_RATES.CUSTOMER_FEE_RATE * 100).toFixed(1) + '%',
  };
}

/**
 * Calculate platform fee only
 * @param {number} jobAmount 
 * @returns {number} Platform fee amount
 */
function calculatePlatformFee(jobAmount) {
  return Number((jobAmount * FEE_RATES.PLATFORM_FEE_RATE).toFixed(2));
}

/**
 * Calculate customer fee only
 * @param {number} jobAmount 
 * @returns {number} Customer fee amount
 */
function calculateCustomerFee(jobAmount) {
  return Number((jobAmount * FEE_RATES.CUSTOMER_FEE_RATE).toFixed(2));
}

/**
 * Calculate hustler payout only
 * @param {number} jobAmount 
 * @returns {number} Hustler payout amount
 */
function calculateHustlerPayout(jobAmount) {
  return Number((jobAmount - (jobAmount * FEE_RATES.PLATFORM_FEE_RATE)).toFixed(2));
}

module.exports = {
  calculateFees,
  getFeeRates,
  calculatePlatformFee,
  calculateCustomerFee,
  calculateHustlerPayout,
  FEE_RATES, // Export for reference only (DO NOT MODIFY)
};
