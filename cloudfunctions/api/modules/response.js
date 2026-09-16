function successResponse(data, requestId) {
  return { ok: true, data, requestId };
}

function errorResponse(code, message, requestId, retryable) {
  return { ok: false, error: { code, message, retryable }, requestId };
}

module.exports = { errorResponse, successResponse };

