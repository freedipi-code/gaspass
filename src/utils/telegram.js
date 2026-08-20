function isMessageNotModifiedError(error) {
  const description = error?.description || error?.message || '';
  return /message is not modified/i.test(description);
}

module.exports = { isMessageNotModifiedError };
