const MAX_EXTRACTION_TEXT_LENGTH = 12000;

function validateExtractionText(text) {
  if (typeof text !== 'string') {
    return {
      ok: false,
      statusCode: 400,
      error: 'Text must be provided as a string.',
    };
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Text is required',
    };
  }

  if (trimmedText.length > MAX_EXTRACTION_TEXT_LENGTH) {
    return {
      ok: false,
      statusCode: 413,
      error: `Text exceeds the maximum allowed length of ${MAX_EXTRACTION_TEXT_LENGTH} characters. Please provide a smaller excerpt for AI extraction.`,
    };
  }

  return {
    ok: true,
    text: trimmedText,
  };
}

module.exports = {
  MAX_EXTRACTION_TEXT_LENGTH,
  validateExtractionText,
};
