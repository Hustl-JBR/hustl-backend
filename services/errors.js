/**
 * Error Handling Service
 * 
 * Provides standardized error responses for API endpoints.
 * All error responses follow a consistent structure for better client handling.
 * 
 * Standard Error Response Format:
 * {
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Human-readable error message",
 *     details: { ... optional context data ... },
 *     actions: [ ... optional actionable items ... ]
 *   }
 * }
 */

/**
 * Standard Error Codes
 * Use these consistent codes across all endpoints for easier client-side handling
 */
const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  
  // Payment & Stripe
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  STRIPE_ERROR: 'STRIPE_ERROR',
  PAYMENT_ALREADY_CAPTURED: 'PAYMENT_ALREADY_CAPTURED',
  REFUND_FAILED: 'REFUND_FAILED',
  
  // Verification & Codes
  INVALID_CODE: 'INVALID_CODE',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_ALREADY_USED: 'CODE_ALREADY_USED',
  
  // Job Status
  INVALID_JOB_STATUS: 'INVALID_JOB_STATUS',
  JOB_ALREADY_ASSIGNED: 'JOB_ALREADY_ASSIGNED',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  
  // Offers
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  OFFER_ALREADY_ACCEPTED: 'OFFER_ALREADY_ACCEPTED',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/**
 * Custom API Error Class
 * Extends Error with structured data for consistent API responses
 */
class ApiError extends Error {
  /**
   * Create a new API error
   * @param {string} code - Error code from ErrorCodes
   * @param {string} message - Human-readable error message
   * @param {object} details - Optional additional context data
   * @param {array} actions - Optional actionable items for client
   * @param {number} statusCode - HTTP status code (default: 400)
   */
  constructor(code, message, details = {}, actions = [], statusCode = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.actions = actions;
    this.statusCode = statusCode;
  }

  /**
   * Convert error to JSON response format
   * @returns {object} Formatted error response
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(Object.keys(this.details).length > 0 && { details: this.details }),
        ...(this.actions.length > 0 && { actions: this.actions }),
      }
    };
  }

  /**
   * Send error response via Express response object
   * @param {object} res - Express response object
   */
  send(res) {
    return res.status(this.statusCode).json(this.toJSON());
  }
}

/**
 * Helper function to create common error responses
 */
const Errors = {
  /**
   * Payment required error (customer needs to authorize payment)
   */
  paymentRequired(amount, jobId, offerId = null) {
    return new ApiError(
      ErrorCodes.PAYMENT_REQUIRED,
      'Payment required to accept this offer. Please complete payment to proceed.',
      { amount, jobId, ...(offerId && { offerId }) },
      [{ type: 'AUTHORIZE_PAYMENT', label: 'Complete Payment' }],
      400
    );
  },

  /**
   * Invalid verification code error
   */
  invalidCode(codeType = 'verification') {
    return new ApiError(
      ErrorCodes.INVALID_CODE,
      `The ${codeType} code you entered is incorrect. Please try again.`,
      { codeType },
      [],
      400
    );
  },

  /**
   * Code expired error
   */
  codeExpired(codeType = 'verification') {
    return new ApiError(
      ErrorCodes.CODE_EXPIRED,
      `The ${codeType} code has expired. Please request a new code.`,
      { codeType },
      [{ type: 'REQUEST_NEW_CODE', label: 'Get New Code' }],
      400
    );
  },

  /**
   * Insufficient balance error (for transfers/payouts)
   */
  insufficientBalance(balance, required) {
    return new ApiError(
      ErrorCodes.INSUFFICIENT_BALANCE,
      'Insufficient balance to complete this transfer.',
      { 
        available: balance.available || 0,
        pending: balance.pending || 0,
        required: required 
      },
      [{ type: 'RETRY_LATER', label: 'Try Again Later' }],
      400
    );
  },

  /**
   * Not found error
   */
  notFound(resourceType, resourceId = null) {
    return new ApiError(
      ErrorCodes.NOT_FOUND,
      `${resourceType} not found.`,
      { resourceType, ...(resourceId && { resourceId }) },
      [],
      404
    );
  },

  /**
   * Forbidden error
   */
  forbidden(reason = null) {
    return new ApiError(
      ErrorCodes.FORBIDDEN,
      reason || 'You do not have permission to perform this action.',
      {},
      [],
      403
    );
  },

  /**
   * Validation error
   */
  validation(errors) {
    return new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      'Validation failed. Please check your input.',
      { errors },
      [],
      400
    );
  },

  /**
   * Internal server error
   */
  internal(message = 'An unexpected error occurred. Please try again later.') {
    return new ApiError(
      ErrorCodes.INTERNAL_ERROR,
      message,
      {},
      [],
      500
    );
  },

  /**
   * Stripe error (payment processing)
   */
  stripe(stripeError) {
    return new ApiError(
      ErrorCodes.STRIPE_ERROR,
      stripeError.message || 'Payment processing failed.',
      { 
        type: stripeError.type,
        code: stripeError.code 
      },
      [],
      400
    );
  },
};

/**
 * Express middleware to handle ApiError instances
 * Add this to your Express app after routes:
 * app.use(errorHandler);
 */
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return err.send(res);
  }
  
  // Handle other errors
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again later.'
    }
  });
}

module.exports = {
  ApiError,
  ErrorCodes,
  Errors,
  errorHandler,
};
