/**
 * Centralized Phone Number Normalization for Turkey
 * 
 * All phone numbers in the system should be stored and compared 
 * in the format: 905XXXXXXXXX (12 digits, no leading zero, country code included)
 * 
 * Examples:
 *   "0532 123 45 67"  → "905321234567"
 *   "05321234567"     → "905321234567"
 *   "5321234567"      → "905321234567"
 *   "905321234567"    → "905321234567"
 *   "+905321234567"   → "905321234567"
 *   "90 532 123 4567" → "905321234567"
 */

const normalizePhoneTR = (phone) => {
    if (!phone) return '';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different Turkish phone formats:
    // 11 digits starting with 0 (0532...): remove leading 0, add 90
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = '9' + cleaned;
    }
    // 10 digits (532...): add 90
    else if (cleaned.length === 10 && !cleaned.startsWith('0')) {
        cleaned = '90' + cleaned;
    }
    // 12 digits starting with 90 (905...): already correct
    // else: leave as-is (might be international or invalid)

    return cleaned;
};

module.exports = { normalizePhoneTR };
