/**
 * Banking Ledger and Portfolio Allocation Module
 * Manages investment vehicle databases, interactive risk tranches, and digital ledger receipts.
 * Maintains structural compatibility with transit routes to preserve cryptographic verification.
 */

import { generatePassSignature } from './security.js';

// Predefined Investment Portfolios database (mapped to Route parameters)
export const ROUTES = [
    { id: "R-101", from: "Apex Alpha", to: "Tech Growth Fund", distance: 180, baseFare: 27.00, duration: "12.5% APY" },
    { id: "R-102", from: "West Coast Capital", to: "Sovereign Bond Vault", distance: 350, baseFare: 52.50, duration: "4.8% APY" },
    { id: "R-103", from: "Cyber Shield", to: "Security Infrastructure", distance: 290, baseFare: 43.50, duration: "8.9% APY" },
    { id: "R-104", from: "Eco-Yield", to: "Green Energy Trust", distance: 120, baseFare: 18.00, duration: "6.5% APY" }
];

/**
 * Generate a grid representing risk allocation blocks in an asset portfolio
 */
export function generateBusSeats(portfolioId, totalBlocks = 40) {
    // Deterministic allocation pattern using the portfolio ID as seed
    const blocks = [];
    let seed = 0;
    for (let char of portfolioId) seed += char.charCodeAt(0);

    for (let i = 1; i <= totalBlocks; i++) {
        // Mock block status: 25% allocation occupancy seeded deterministically
        const isOccupied = ((i * seed) % 7 === 0 || (i + seed) % 9 === 0);
        blocks.push({
            number: i,
            status: isOccupied ? "occupied" : "available"
        });
    }
    return blocks;
}

/**
 * Calculate dynamic client-side investment price based on user-selected configuration
 * Mapped to computeTicketPrice for system compatibility.
 */
export function computeTicketPrice(portfolioId, accountClass, loadRate = 0.4) {
    const portfolio = ROUTES.find(p => p.id === portfolioId);
    if (!portfolio) return 0;

    let base = portfolio.baseFare;
    
    // Account tier multiplier
    let tierMultiplier = 1.0;
    if (accountClass === 'luxury-ac') tierMultiplier = 1.5; // Gold Tier Account (+50% base commission/price)
    else if (accountClass === 'sleeper') tierMultiplier = 1.8; // Institutional VIP (+80% base commission/price)
    
    // Dynamic network volume fee based on simulated CPU load
    let dynamicVolumeMultiplier = 1.0;
    if (loadRate >= 0.8) {
        dynamicVolumeMultiplier = 1.4; // 40% network surge fee
    } else if (loadRate >= 0.5) {
        dynamicVolumeMultiplier = 1.15; // 15% network surge fee
    }

    return parseFloat((base * tierMultiplier * dynamicVolumeMultiplier).toFixed(2));
}

/**
 * Generates a mock canvas QR Code representing the secure ledger receipt
 * Returns a data URL of the image
 */
export function drawMockQRCode(dataString) {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 180, 180);

    // Draw finder patterns (three corner boxes)
    ctx.fillStyle = '#000000';
    const drawFinder = (x, y) => {
        ctx.fillRect(x, y, 40, 40);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 5, y + 5, 30, 30);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 10, y + 10, 20, 20);
    };

    drawFinder(10, 10);
    drawFinder(130, 10);
    drawFinder(10, 130);

    // Add alignment pattern
    ctx.fillRect(135, 135, 15, 15);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(140, 140, 5, 5);

    // Fill pseudo data blocks based on hash of input string
    ctx.fillStyle = '#000000';
    let hash = 5381;
    for (let i = 0; i < dataString.length; i++) {
        hash = ((hash << 5) + hash) + dataString.charCodeAt(i);
    }

    const gridSize = 18;
    const cellSize = 10;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            // Skip finder patterns
            if ((r < 5 && c < 5) || (r < 5 && c >= gridSize - 5) || (r >= gridSize - 5 && c < 5)) {
                continue;
            }
            
            // Deterministic pseudorandom noise based on data hash
            const bit = ((hash >> (r * c % 32)) & 1) ^ (((r + c) * 31) % 2 === 0);
            if (bit) {
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            }
        }
    }

    return canvas.toDataURL();
}

/**
 * Creates and compiles a secure digital banking ledger receipt
 */
export async function createBusPass(bookingData, portfolioObj) {
    const receiptId = "TX-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    const timestamp = new Date().toISOString();
    
    // Generate signature to protect transaction value and prevent forgery
    const signature = await generatePassSignature(
        receiptId,
        portfolioObj.id,
        bookingData.seatNumber,
        bookingData.farePaid,
        bookingData.passengerEmail
    );

    // Package ledger receipt details
    const receiptObject = {
        id: receiptId,
        routeId: portfolioObj.id,
        routeName: `${portfolioObj.from} to ${portfolioObj.to}`,
        seatNumber: bookingData.seatNumber,
        passengerName: bookingData.passengerName,
        passengerEmail: bookingData.passengerEmail,
        ticketClass: bookingData.ticketClass,
        fare: bookingData.farePaid,
        timestamp: timestamp,
        signature: signature,
        validated: false
    };

    // Draw the QR Code image
    const qrData = JSON.stringify({
        id: receiptObject.id,
        routeName: receiptObject.routeName,
        seat: receiptObject.seatNumber,
        sig: receiptObject.signature.substr(0, 16)
    });
    receiptObject.qrCodeUrl = drawMockQRCode(qrData);

    return receiptObject;
}
