/**
 * Validation utilities for StudyPlan
 */

/**
 * Validates email format
 * @param {string} email 
 * @returns {boolean}
 */
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validates password requirements
 * @param {string} password 
 * @returns {object} { isValid, requirements }
 */
export function validatePassword(password) {
    const requirements = {
        minLength: password.length >= 8,
        hasCapital: /[A-Z]/.test(password),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const isValid = Object.values(requirements).every(Boolean);

    return { isValid, requirements };
}

/**
 * Calculates password strength (0-3)
 * @param {string} password 
 * @returns {number} 0: weak, 1: medium, 2: strong
 */
export function calculatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    if (score <= 2) return 0; // Weak
    if (score === 3) return 1; // Medium
    return 2; // Strong
}

/**
 * Checks if passwords match
 * @param {string} password 
 * @param {string} confirmPassword 
 * @returns {boolean}
 */
export function validatePasswordMatch(password, confirmPassword) {
    return password === confirmPassword && password.length > 0;
}
