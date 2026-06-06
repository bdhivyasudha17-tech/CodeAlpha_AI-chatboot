/**
 * Security Engine - Cloud-Based Bus Pass System
 * Handles encryption, ticket signature generation, price-integrity verification,
 * duplicate-spend checking, and WAF rate-limiting simulator.
 */

// Simulated Backend Secret Key for Cryptographic Signatures
const BACKEND_SECRET_KEY = "BusPassCloudSecureSignatureKey#2026";

// Simple in-memory ledger of checked-in tickets to prevent double spending
const usedTicketsLedger = new Set();

/**
 * Generates standard SHA-256 hash using the Web Crypto API
 */
export async function generateSHA256(message) {
    try {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (e) {
        // Fallback for environments where Web Crypto API is unavailable
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0').repeat(8).slice(0, 64);
    }
}

/**
 * Generates a tamper-proof cryptographic pass signature (simulated HMAC)
 */
export async function generatePassSignature(passId, routeId, seatNumber, fare, passengerEmail) {
    const rawMessage = `${passId}|${routeId}|${seatNumber}|${fare}|${passengerEmail}|${BACKEND_SECRET_KEY}`;
    return await generateSHA256(rawMessage);
}

/**
 * Verifies if a pass signature is authentic and unaltered
 */
export async function verifyPassSignature(pass) {
    const computedSignature = await generatePassSignature(
        pass.id,
        pass.routeId,
        pass.seatNumber,
        pass.fare,
        pass.passengerEmail
    );
    return computedSignature === pass.signature;
}

/**
 * Validates check-in of a digital pass and prevents double-spend/duplicate theft
 * Returns an object: { success: boolean, reason: string }
 */
export async function checkInPass(pass) {
    // 1. Verify cryptographic signature integrity
    const isAuthentic = await verifyPassSignature(pass);
    if (!isAuthentic) {
        return { 
            success: false, 
            reason: "CRITICAL: Ledger signature mismatch! Transaction data has been tampered with or forged." 
        };
    }

    // 2. Check double-spending
    if (usedTicketsLedger.has(pass.signature)) {
        return { 
            success: false, 
            reason: "SECURITY ALERT: Double spend detected! This transaction signature was already verified." 
        };
    }

    // 3. Mark as used in local database
    usedTicketsLedger.add(pass.signature);
    return { 
        success: true, 
        reason: "Valid signature. Core Ledger Authorized." 
    };
}

/**
 * Reset scanned ticket ledger (useful for admin testing)
 */
export function resetLedger() {
    usedTicketsLedger.clear();
}

/**
 * Server-side Pricing Integrity Validator
 * Prevents client-side price modification (incorrect pricing / price manipulation)
 * Returns true if valid, false if tampering detected.
 */
export function verifyFareIntegrity(routeDistance, ticketClass, occupancyRate, clientPrice) {
    // Recalculate price using strict server-side formulas
    const basePrice = routeDistance * 0.15; // 15 cents per mile
    
    let classMultiplier = 1.0;
    if (ticketClass === 'luxury-ac') classMultiplier = 1.5;
    else if (ticketClass === 'sleeper') classMultiplier = 1.8;
    
    // Demand pricing based on occupancy
    let demandMultiplier = 1.0;
    if (occupancyRate >= 0.8) {
        demandMultiplier = 1.4; // 40% surge
    } else if (occupancyRate >= 0.5) {
        demandMultiplier = 1.15; // 15% surge
    }
    
    const serverPrice = parseFloat((basePrice * classMultiplier * demandMultiplier).toFixed(2));
    
    // Check if client price deviates from server calculation (allowing tiny floating-point variance)
    const deviation = Math.abs(serverPrice - clientPrice);
    return deviation < 0.05;
}

/**
 * Web Application Firewall (WAF) Simulation
 * Evaluates traffic and filters malicious requests
 * Returns structure: { allow: boolean, classification: string, action: string }
 */
export class WebApplicationFirewall {
    constructor() {
        this.ipRequestCounts = {};
        this.blocklist = new Set();
        this.rateLimitThreshold = 120; // max requests per second per IP in simulation
    }

    evaluateRequest(ipAddress, userAgent, isDdosModeActive) {
        // Automatically classify bots/attacks in high-traffic modes
        if (isDdosModeActive && Math.random() > 0.3) {
            // Simulator labels 70% of traffic during active DDoS simulation as malicious bot
            const isBotPattern = userAgent.includes('ZombieBot') || Math.random() > 0.5;
            if (isBotPattern) {
                return {
                    allow: false,
                    classification: "DDoS BOT ATTACK",
                    action: "DROP REQUEST"
                };
            }
        }

        // Standard IP Rate Limiting
        const currentTime = Math.floor(Date.now() / 1000);
        const ipKey = `${ipAddress}:${currentTime}`;
        
        this.ipRequestCounts[ipKey] = (this.ipRequestCounts[ipKey] || 0) + 1;
        
        if (this.ipRequestCounts[ipKey] > this.rateLimitThreshold || this.blocklist.has(ipAddress)) {
            this.blocklist.add(ipAddress);
            return {
                allow: false,
                classification: "RATE_LIMIT_EXCEEDED",
                action: "BLOCK IP"
            };
        }

        return {
            allow: true,
            classification: "LEGITIMATE_TRAFFIC",
            action: "FORWARD TO LOAD BALANCER"
        };
    }

    clearBlocklist() {
        this.blocklist.clear();
        this.ipRequestCounts = {};
    }
}
