
import { randomInt } from "crypto";

function generateAccountNumber(): string {
    return randomInt(0, 1000000000).toString().padStart(10, "0");
}

console.log("Generating 10 random account numbers:");
const numbers = new Set<string>();
for (let i = 0; i < 10; i++) {
    const num = generateAccountNumber();
    console.log(num);
    if (num.length !== 10) {
        console.error(`Error: Generated number ${num} is not 10 digits long.`);
        process.exit(1);
    }
    if (!/^\d{10}$/.test(num)) {
        console.error(`Error: Generated number ${num} contains non-digits.`);
        process.exit(1);
    }
    numbers.add(num);
}

if (numbers.size !== 10) {
    console.warn("Warning: Duplicate numbers generated in small sample size (unlikely but possible).");
} else {
    console.log("All 10 generated numbers are unique.");
}

console.log("Verification passed!");
