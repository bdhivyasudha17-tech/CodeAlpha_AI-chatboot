/**
 * Secure Ledger and Pricing Validation Test Suite
 * Run with: node test.js
 */

import { verifyFareIntegrity, generatePassSignature, verifyPassSignature, checkInPass, resetLedger } from './modules/security.js';
import { computeTicketPrice } from './modules/booking.js';

let passedTestsCount = 0;
let totalTestsCount = 0;

function assert(condition, message) {
    totalTestsCount++;
    if (condition) {
        passedTestsCount++;
        console.log(`  ✓ PASS: ${message}`);
    } else {
        console.error(`  ✕ FAIL: ${message}`);
    }
}

async function runTests() {
    console.log("=== STARTING CLOUD-BASED TRANSIT SECURITY TESTS ===");

    // Test 1: Dynamic Pricing Formula
    console.log("\n[Test Suite 1: Pricing calculations]");
    const basePrice = computeTicketPrice("R-101", "economy", 0.4);
    assert(basePrice === 27.00, `Base Economy fare for R-101 should be $27.00, got $${basePrice}`);

    const luxuryPrice = computeTicketPrice("R-101", "luxury-ac", 0.4);
    assert(luxuryPrice === 40.50, `Luxury Premium fare for R-101 should be $40.50 (1.5x), got $${luxuryPrice}`);

    const surgePrice = computeTicketPrice("R-101", "economy", 0.85);
    assert(surgePrice === 37.80, `Surge Economy fare for R-101 should be $37.80 (1.4x), got $${surgePrice}`);

    // Test 2: Server-Side Price Modification Prevention (Theft & Price Integrity)
    console.log("\n[Test Suite 2: Client Price Modification Detection]");
    const routeDistance = 180; // matches R-101
    
    // A. Legit transaction price
    const isValidLegit = verifyFareIntegrity(routeDistance, "economy", 0.4, 27.00);
    assert(isValidLegit === true, "WAF should ALLOW legitimate price matching the calculations");

    // B. Modified price (Hacker attempt)
    const isValidHack = verifyFareIntegrity(routeDistance, "economy", 0.4, 1.00);
    assert(isValidHack === false, "WAF should REJECT hacked price modification ($1.00 instead of $27.00)");

    // Test 3: Cryptographic Signature Integrity
    console.log("\n[Test Suite 3: Cryptographic Signing]");
    const passId = "BP-TESTSIGN1";
    const routeId = "R-101";
    const seatNumber = 12;
    const fare = 27.00;
    const email = "passenger@test.com";

    const signature = await generatePassSignature(passId, routeId, seatNumber, fare, email);
    assert(signature.length === 64, "Generated signature should be a 64-character SHA-256 string");

    const dummyPass = {
        id: passId,
        routeId: routeId,
        seatNumber: seatNumber,
        fare: fare,
        passengerEmail: email,
        signature: signature
    };

    const isSigValid = await verifyPassSignature(dummyPass);
    assert(isSigValid === true, "Verifying original signed ticket should return true");

    // Attempt to tamper with seat allocation (theft/transfer fraud)
    const tamperedPass = { ...dummyPass, seatNumber: 13 };
    const isTamperedValid = await verifyPassSignature(tamperedPass);
    assert(isTamperedValid === false, "Tampering with seat number should INVALIDATE signature verification");

    // Attempt to tamper with price
    const cheapPass = { ...dummyPass, fare: 5.00 };
    const isCheapValid = await verifyPassSignature(cheapPass);
    assert(isCheapValid === false, "Tampering with fare cost should INVALIDATE signature verification");

    // Test 4: Access Control Gate and Double-Spend Check
    console.log("\n[Test Suite 4: Access Gate Verification & Double-Spend prevention]");
    resetLedger();

    // First scan should succeed
    const scan1 = await checkInPass(dummyPass);
    assert(scan1.success === true, "First ticket check-in should succeed");

    // Second scan (reuse duplicate / theft) should be blocked
    const scan2 = await checkInPass(dummyPass);
    assert(scan2.success === false, "Second ticket scan with same signature should be BLOCKED (Double spend)");
    assert(scan2.reason.includes("Double spend detected"), "Failure reason should indicate double-spend detection");

    // Scan tampered ticket should be blocked
    const scanTampered = await checkInPass(tamperedPass);
    assert(scanTampered.success === false, "Tampered ticket signature validation should fail at check-in");

    console.log(`\n=== TEST SUMMARY: Passed ${passedTestsCount} / ${totalTestsCount} assertions ===`);
    if (passedTestsCount === totalTestsCount) {
        console.log("STATUS: SUCCESS. Ledger security holds.");
    } else {
        console.error("STATUS: FAILURE. Security bugs found.");
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Unhandle test exception:", err);
    process.exit(1);
});
