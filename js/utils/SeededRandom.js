/**
 * Creates a simple Linear Congruential Generator (LCG) for seeded random numbers.
 * This ensures that for the same seed, the sequence of generated numbers is always identical.
 * @param {number} seed - An integer seed.
 * @returns {function(): number} A function that returns a random number between 0 (inclusive) and 1 (exclusive).
 */
export function createSeededRandom(seed) {
    // A large prime number for the multiplier, and other numbers for increment and modulus
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32); // 2^32 as the modulus

    let currentSeed = seed | 0; // Ensure initial seed is a 32-bit integer

    return function() {
        // LCG formula: Xn+1 = (a * Xn + c) % m
        // Use bitwise OR 0 to ensure currentSeed stays a 32-bit integer,
        // which helps with consistent modulo behavior across platforms and handles potential negative intermediate results.
        currentSeed = (a * currentSeed + c) | 0;

        // Take the absolute value and normalize to [0, 1) range.
        // Using bitwise AND with 0x7fffffff (max 31-bit signed int) to get a positive result
        // then dividing by 0x80000000 (2^31) to get into [0, 1)
        return (currentSeed & 0x7fffffff) / 0x80000000;
    };
}
