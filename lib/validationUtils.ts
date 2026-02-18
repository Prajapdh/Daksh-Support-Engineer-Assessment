export function isValidLuhn(cardNumber: string): boolean {
    // Remove any non-digit characters
    const sanitized = cardNumber.replace(/\D/g, '');

    if (!sanitized) return false;

    let sum = 0;
    let isSecond = false;

    // Loop from right to left
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized[i], 10);

        if (isSecond) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isSecond = !isSecond;
    }

    return sum % 10 === 0;
}

export function isValidCardNumber(cardNumber: string): boolean {
    const sanitized = cardNumber.replace(/\D/g, '');
    // Check length (typically 13-19 digits for major cards)
    if (sanitized.length < 13 || sanitized.length > 19) return false;

    return isValidLuhn(sanitized);
}

export function isFutureDate(dateString: string): boolean {
    const date = new Date(dateString);
    const now = new Date();
    return date > now;
}

export function isValidAge(dateString: string, minAge: number = 18): boolean {
    const date = new Date(dateString);
    const now = new Date();
    if (date > now) return false;

    const age = now.getFullYear() - date.getFullYear();
    const monthDiff = now.getMonth() - date.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
        return age - 1 >= minAge;
    }
    return age >= minAge;
}
