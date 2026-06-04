/**
 * Booking Wizard and Pass Generation Module
 * Manages route schedule databases, interactive seat selections, and ticket layout compilers.
 */

import { generatePassSignature } from './security.js';

// Predefined Cloud-Sync Bus Routes database
export const ROUTES = [
    { id: "R-101", from: "Metro Terminal (Hub)", to: "North Plaza Station", distance: 180, baseFare: 27.00, duration: "3h 15m" },
    { id: "R-102", from: "West Coast Terminal", to: "Silicon Valley Expressway", distance: 350, baseFare: 52.50, duration: "5h 45m" },
    { id: "R-103", from: "Great Lakes Central", to: "Industrial Corridor", distance: 290, baseFare: 43.50, duration: "4h 30m" },
    { id: "R-104", from: "Cascade Terminal", to: "Border City Ingress", distance: 120, baseFare: 18.00, duration: "2h 00m" }
];

/**
 * Generate a grid representing seat availability in a bus
 */
export function generateBusSeats(busId, totalSeats = 40) {
    // Deterministic seating pattern using the bus ID as seed
    const seats = [];
    let seed = 0;
    for (let char of busId) seed += char.charCodeAt(0);

    for (let i = 1; i <= totalSeats; i++) {
        // Mock seat status: 25% occupancy seeded deterministically
        const isOccupied = ((i * seed) % 7 === 0 || (i + seed) % 9 === 0);
        seats.push({
            number: i,
            status: isOccupied ? "occupied" : "available"
        });
    }
    return seats;
}

/**
 * Calculate dynamic client-side ticket price based on user-selected configuration
 * This is used for visual estimation before server validation.
 */
export function computeTicketPrice(routeId, ticketClass, occupancyRate = 0.4) {
    const route = ROUTES.find(r => r.id === routeId);
    if (!route) return 0;

    let base = route.baseFare;
    
    // Class multiplier
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

    return parseFloat((base * classMultiplier * demandMultiplier).toFixed(2));
}

/**
 * Generates a mock canvas QR Code representing the ticket data
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
 * Creates and compiles a secure digital bus pass
 */
export async function createBusPass(bookingData, routeObj) {
    const passId = "BP-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    const timestamp = new Date().toISOString();
    
    // Generate signature to protect pricing and prevent forgery
    const signature = await generatePassSignature(
        passId,
        routeObj.id,
        bookingData.seatNumber,
        bookingData.farePaid,
        bookingData.passengerEmail
    );

    // Package ticket details
    const passObject = {
        id: passId,
        routeId: routeObj.id,
        routeName: `${routeObj.from} to ${routeObj.to}`,
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
        id: passObject.id,
        routeName: passObject.routeName,
        seat: passObject.seatNumber,
        sig: passObject.signature.substr(0, 16)
    });
    passObject.qrCodeUrl = drawMockQRCode(qrData);

    return passObject;
}
