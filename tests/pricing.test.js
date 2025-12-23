/**
 * Unit tests for Pricing Service
 * 
 * Tests fee calculations to ensure correctness and consistency
 */

const { calculateFees, getFeeRates, calculatePlatformFee, calculateCustomerFee, calculateHustlerPayout } = require('../services/pricing');

// Simple test runner (no external dependencies needed)
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${expected}, Got: ${actual}`);
  }
}

// Test Suite
function runTests() {
  console.log('🧪 Running Pricing Service Tests...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: Basic $100 job calculation
  try {
    const result = calculateFees(100);
    assertEqual(result.jobAmount, 100.00, 'Job amount should be 100.00');
    assertEqual(result.platformFee, 12.00, 'Platform fee should be 12.00 (12% of 100)');
    assertEqual(result.customerFee, 6.50, 'Customer fee should be 6.50 (6.5% of 100)');
    assertEqual(result.hustlerPayout, 88.00, 'Hustler payout should be 88.00 (100 - 12)');
    assertEqual(result.total, 106.50, 'Total should be 106.50 (100 + 6.50)');
    console.log('✅ Test 1: Basic $100 job calculation - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 1: FAILED -', error.message);
    failed++;
  }

  // Test 2: Small job ($10)
  try {
    const result = calculateFees(10);
    assertEqual(result.jobAmount, 10.00, 'Job amount should be 10.00');
    assertEqual(result.platformFee, 1.20, 'Platform fee should be 1.20 (12% of 10)');
    assertEqual(result.customerFee, 0.65, 'Customer fee should be 0.65 (6.5% of 10)');
    assertEqual(result.hustlerPayout, 8.80, 'Hustler payout should be 8.80 (10 - 1.20)');
    assertEqual(result.total, 10.65, 'Total should be 10.65 (10 + 0.65)');
    console.log('✅ Test 2: Small job ($10) - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 2: FAILED -', error.message);
    failed++;
  }

  // Test 3: Large job ($1000)
  try {
    const result = calculateFees(1000);
    assertEqual(result.jobAmount, 1000.00, 'Job amount should be 1000.00');
    assertEqual(result.platformFee, 120.00, 'Platform fee should be 120.00 (12% of 1000)');
    assertEqual(result.customerFee, 65.00, 'Customer fee should be 65.00 (6.5% of 1000)');
    assertEqual(result.hustlerPayout, 880.00, 'Hustler payout should be 880.00 (1000 - 120)');
    assertEqual(result.total, 1065.00, 'Total should be 1065.00 (1000 + 65)');
    console.log('✅ Test 3: Large job ($1000) - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 3: FAILED -', error.message);
    failed++;
  }

  // Test 4: Odd amount with rounding ($47.99)
  try {
    const result = calculateFees(47.99);
    assertEqual(result.jobAmount, 47.99, 'Job amount should be 47.99');
    assertEqual(result.platformFee, 5.76, 'Platform fee should be 5.76 (12% of 47.99, rounded)');
    assertEqual(result.customerFee, 3.12, 'Customer fee should be 3.12 (6.5% of 47.99, rounded)');
    assertEqual(result.hustlerPayout, 42.23, 'Hustler payout should be 42.23 (47.99 - 5.76)');
    assertEqual(result.total, 51.11, 'Total should be 51.11 (47.99 + 3.12)');
    console.log('✅ Test 4: Odd amount with rounding ($47.99) - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 4: FAILED -', error.message);
    failed++;
  }

  // Test 5: Zero job amount (edge case)
  try {
    const result = calculateFees(0);
    assertEqual(result.jobAmount, 0.00, 'Job amount should be 0.00');
    assertEqual(result.platformFee, 0.00, 'Platform fee should be 0.00');
    assertEqual(result.customerFee, 0.00, 'Customer fee should be 0.00');
    assertEqual(result.hustlerPayout, 0.00, 'Hustler payout should be 0.00');
    assertEqual(result.total, 0.00, 'Total should be 0.00');
    console.log('✅ Test 5: Zero job amount - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 5: FAILED -', error.message);
    failed++;
  }

  // Test 6: Tips pass through correctly
  try {
    const result = calculateFees(100, { tipAmount: 20 });
    assertEqual(result.tipAmount, 20.00, 'Tip amount should pass through as 20.00');
    assertEqual(result.platformFee, 12.00, 'Platform fee should NOT include tip (12% of job only)');
    assertEqual(result.customerFee, 6.50, 'Customer fee should NOT include tip (6.5% of job only)');
    console.log('✅ Test 6: Tips pass through (not included in fees) - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 6: FAILED -', error.message);
    failed++;
  }

  // Test 7: Individual helper functions
  try {
    assertEqual(calculatePlatformFee(100), 12.00, 'Platform fee helper should return 12.00');
    assertEqual(calculateCustomerFee(100), 6.50, 'Customer fee helper should return 6.50');
    assertEqual(calculateHustlerPayout(100), 88.00, 'Hustler payout helper should return 88.00');
    console.log('✅ Test 7: Individual helper functions - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 7: FAILED -', error.message);
    failed++;
  }

  // Test 8: Get fee rates
  try {
    const rates = getFeeRates();
    assertEqual(rates.platformFeeRate, 0.12, 'Platform fee rate should be 0.12');
    assertEqual(rates.customerFeeRate, 0.065, 'Customer fee rate should be 0.065');
    assertEqual(rates.platformFeePercent, '12.0%', 'Platform fee percent should be "12.0%"');
    assertEqual(rates.customerFeePercent, '6.5%', 'Customer fee percent should be "6.5%"');
    console.log('✅ Test 8: Get fee rates - PASSED');
    passed++;
  } catch (error) {
    console.error('❌ Test 8: FAILED -', error.message);
    failed++;
  }

  // Test 9: Negative amount should throw error
  try {
    calculateFees(-50);
    console.error('❌ Test 9: FAILED - Should have thrown error for negative amount');
    failed++;
  } catch (error) {
    if (error.message.includes('non-negative')) {
      console.log('✅ Test 9: Negative amount validation - PASSED');
      passed++;
    } else {
      console.error('❌ Test 9: FAILED - Wrong error message:', error.message);
      failed++;
    }
  }

  // Test 10: Non-number input should throw error
  try {
    calculateFees('100');
    console.error('❌ Test 10: FAILED - Should have thrown error for non-number input');
    failed++;
  } catch (error) {
    if (error.message.includes('non-negative number')) {
      console.log('✅ Test 10: Non-number input validation - PASSED');
      passed++;
    } else {
      console.error('❌ Test 10: FAILED - Wrong error message:', error.message);
      failed++;
    }
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    return true;
  } else {
    console.log('\n⚠️ Some tests failed!');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };
