import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { hotelLibrary } from '../utils/hotelData';
import { activityLibrary } from '../utils/activityData';
import { getUnifiedBudgetForLead, getUnifiedBudgetForQuote, migrateQuotationsPricing, reconcileQuotationPricing } from '../utils/pricingConsistency';
import {
    isConfirmedLead,
    isConfirmedBookingStatus,
    findBookingForLead,
    findLinkedBookingsForLead,
    findLinkedQuotationsForLead,
    canAddAgencyStaff,
    normalizeStaffRecordForAgency,
    normalizeSubAgentRecordForAgency,
    inferLeadPipelineStatus,
} from '../utils/databaseSync';
import { ensureTrackingId } from '../utils/trackingId';
import { inferQuoteCreatedAt, normalizeQuoteVersion } from '../utils/quoteActivities';
import { migrateTravelAgentRecords } from '../utils/agentPlan';
import { PLATFORM_NAME } from '../constants/platform';
import { sanitizeWorkspaceData, DEMO_ID_MIN } from '../utils/seedData';
import {
    checkMongoHealth,
    fetchDatabaseFromMongo,
    fetchCollectionsFromMongo,
    saveDatabaseToMongo,
    upsertCollectionRecord,
    patchCollectionRecord,
    deleteCollectionRecord,
    PERSISTABLE_TABLES,
} from '../utils/mongoApi';

const initialDB = {
    leads: {
        name: 'Leads',
        columns: ['ID', 'Name', 'Email', 'Phone', 'Destination', 'Travelers', 'Dates', 'Duration', 'Source', 'Airport', 'Budget', 'Status', 'Agent'],
        data: [
            { id: 'LD-001', name: 'John Doe', destination: 'Dubai, UAE', dates: 'Dec 12 - Dec 18', budget: '₹ 1,50,000', status: 'new', sourceCountry: 'India', sourceAirport: 'BOM', email: 'john@example.com', phone: '+91 9876543210', travelers: '2 Adults', duration: '6 Nights / 7 Days', agentId: 'AGT-001', agentName: 'Raj Kumar', createdAt: '2026-05-10T10:00:00Z' },
            { id: 'LD-002', name: 'Emily Chen', destination: 'Paris, France', dates: 'Nov 5 - Nov 9', budget: '₹ 3,31,800', status: 'contacted', sourceCountry: 'USA', sourceAirport: 'JFK (New York)', email: 'emily.chen@example.com', phone: '+1 555-0198', travelers: '2 Adults', duration: '4 Nights / 5 Days', presetId: 'p2', createdAt: '2026-03-25T14:30:00.000Z', agentId: 'AGT-001', agentName: 'Raj Kumar' },
            { id: 'LD-003', name: 'Michael Smith', destination: 'Zurich & Zermatt, Switzerland', dates: 'Jan 10 - Jan 18', budget: '₹ 7,69,650', status: 'itinerary', sourceCountry: 'United Kingdom', sourceAirport: 'LHR (London Heathrow)', email: 'michael.s@example.com', phone: '+44 7700 900077', travelers: '2 Adults, 2 Kids', duration: '7 Nights / 8 Days', presetId: 'p4', createdAt: '2026-03-12T09:15:00.000Z', agentId: 'AGT-002', agentName: 'Amit Patel' },
            { id: 'LD-004', name: 'Sarah Jenkins', destination: 'Bali, Indonesia', dates: 'Oct 1 - Oct 7', budget: '₹ 3,11,850', status: 'negotiation', sourceCountry: 'Australia', sourceAirport: 'SYD (Sydney)', email: 'sarah.j@example.com', phone: '+61 400 123 456', travelers: '2 Adults', duration: '5 Nights / 6 Days', presetId: 'p1', createdAt: '2026-03-29T16:45:00.000Z', agentId: 'AGT-003', agentName: 'Sanjay Gupta' },
            { id: 'LD-005', name: 'David Wilson', destination: 'Tokyo, Japan', dates: 'Apr 15 - Apr 22', budget: '₹ 4,50,000', status: 'new', sourceCountry: 'Canada', sourceAirport: 'YYZ', email: 'david.w@example.com', phone: '+1 416-555-0123', travelers: '2 Adults', duration: '7 Nights / 8 Days', agentId: 'AGT-004', agentName: 'Priya Sharma', createdAt: '2026-05-12T11:00:00Z' },
            { id: 'LD-006', name: 'Lisa Ray', destination: 'Singapore', dates: 'Jun 10 - Jun 15', budget: '₹ 1,20,000', status: 'confirmed', sourceCountry: 'India', sourceAirport: 'DEL', email: 'lisa.ray@example.com', phone: '+91 9988776655', travelers: '1 Adult', duration: '5 Nights / 6 Days', agentId: 'AGT-001', agentName: 'Raj Kumar', createdAt: '2026-05-11T14:30:00Z' },
            { id: 'LD-007', name: 'Robert Brown', destination: 'New York, USA', dates: 'Jul 4 - Jul 10', budget: '₹ 5,80,000', status: 'itinerary', sourceCountry: 'Germany', sourceAirport: 'FRA', email: 'robert.b@example.com', phone: '+49 151 12345678', travelers: '3 Adults', duration: '6 Nights / 7 Days', agentId: 'AGT-002', agentName: 'Amit Patel', createdAt: '2026-05-09T09:00:00Z' },
            { id: 'LD-008', name: 'Alice Wong', destination: 'Phuket, Thailand', dates: 'Aug 15 - Aug 20', budget: '₹ 85,000', status: 'lost', sourceCountry: 'China', sourceAirport: 'HKG', email: 'alice.w@example.com', phone: '+852 9123 4567', travelers: '2 Adults', duration: '5 Nights / 6 Days', agentId: 'AGT-003', agentName: 'Sanjay Gupta', createdAt: '2026-05-08T16:45:00Z' },
            { id: 'LD-009', name: 'James Miller', destination: 'London, UK', dates: 'Sep 10 - Sep 15', budget: '₹ 2,10,000', status: 'new', sourceCountry: 'UK', sourceAirport: 'LHR', email: 'james.m@example.com', phone: '+44 20 7946 0123', travelers: '2 Adults', duration: '5 Nights / 6 Days', agentId: 'AGT-002', agentName: 'Amit Patel', createdAt: '2026-05-13T08:00:00Z' },
            { id: 'LD-010', name: 'Maria Garcia', destination: 'Madrid, Spain', dates: 'Oct 5 - Oct 12', budget: '₹ 3,50,000', status: 'contacted', sourceCountry: 'Spain', sourceAirport: 'MAD', email: 'maria.g@example.com', phone: '+34 91 123 45 67', travelers: '2 Adults, 1 Kid', duration: '7 Nights / 8 Days', agentId: 'AGT-004', agentName: 'Priya Sharma', createdAt: '2026-05-12T15:30:00Z' },
            { id: 'LD-011', name: 'Hiroshi Tanaka', destination: 'Kyoto, Japan', dates: 'Oct 20 - Oct 25', budget: '₹ 4,20,000', status: 'itinerary', sourceCountry: 'Japan', sourceAirport: 'NRT', email: 'tanaka@example.jp', phone: '+81 3 1234 5678', travelers: '2 Adults', duration: '5 Nights / 6 Days', agentId: 'AGT-005', agentName: 'Vikram Singh', createdAt: '2026-05-13T10:00:00Z' },
            { id: 'LD-012', name: 'Chloe Dubois', destination: 'Nice, France', dates: 'Jun 15 - Jun 22', budget: '₹ 2,80,000', status: 'negotiation', sourceCountry: 'France', sourceAirport: 'NCE', email: 'chloe.d@example.fr', phone: '+33 4 12 34 56 78', travelers: '2 Adults', duration: '7 Nights / 8 Days', agentId: 'AGT-004', agentName: 'Priya Sharma', createdAt: '2026-05-11T09:15:00Z' },
            { id: 'LD-013', name: 'Ahmed Al-Farsi', destination: 'Istanbul, Turkey', dates: 'Sep 1 - Sep 7', budget: '₹ 1,95,000', status: 'confirmed', sourceCountry: 'Oman', sourceAirport: 'MCT', email: 'ahmed@example.om', phone: '+968 24 123456', travelers: '4 Adults', duration: '6 Nights / 7 Days', agentId: 'AGT-002', agentName: 'Amit Patel', createdAt: '2026-05-07T12:00:00Z' },
            { id: 'LD-014', name: 'Sven Larsson', destination: 'Oslo, Norway', dates: 'Dec 1 - Dec 6', budget: '₹ 3,10,000', status: 'new', sourceCountry: 'Sweden', sourceAirport: 'ARN', email: 'sven.l@example.se', phone: '+46 8 123 45 67', travelers: '2 Adults', duration: '5 Nights / 6 Days', agentId: 'AGT-002', agentName: 'Amit Patel', createdAt: '2026-05-13T11:45:00Z' },
            { id: 'LD-015', name: 'Anita Desai', destination: 'Santorini, Greece', dates: 'Jul 10 - Jul 17', budget: '₹ 4,80,000', status: 'itinerary', sourceCountry: 'India', sourceAirport: 'BOM', email: 'anita.d@example.com', phone: '+91 91234 56789', travelers: '2 Adults', duration: '7 Nights / 8 Days', agentId: 'AGT-001', agentName: 'Raj Kumar', createdAt: '2026-05-12T14:00:00Z' },
        ]
    },
    bookings: {
        name: 'Bookings',
        columns: ['ID', 'Customer', 'Email', 'Phone', 'Package', 'Dates', 'Travelers', 'Source', 'Airport', 'Total Amount', 'Status', 'Payment Status', 'Agent'],
        data: [
            { id: 'BK-001', customer: 'John Doe', email: 'john@example.com', phone: '+91 9876543210', package: 'Luxury Dubai Escape', dates: 'Dec 12 - Dec 18', travelers: '2 Adults', source: 'India', airport: 'BOM', total: '₹ 1,50,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-001' },
            { id: 'BK-002', customer: 'Lisa Ray', email: 'lisa.ray@example.com', phone: '+91 9988776655', package: 'Singapore Highlights', dates: 'Jun 10 - Jun 15', travelers: '1 Adult', source: 'India', airport: 'DEL', total: '₹ 1,20,000', status: 'completed', paymentStatus: 'paid', agentId: 'AGT-001' },
            { id: 'BK-003', customer: 'Sarah Jenkins', email: 'sarah.j@example.com', phone: '+61 400 123 456', package: 'Bali Romantic Getaway', dates: 'Oct 1 - Oct 7', travelers: '2 Adults', source: 'Australia', airport: 'SYD', total: '₹ 3,11,850', status: 'pending', paymentStatus: 'partial', agentId: 'AGT-003' },
            { id: 'BK-004', customer: 'Mark Thompson', email: 'mark.t@example.com', phone: '+1 212 555 1212', package: 'Swiss Alps Adventure', dates: 'Dec 20 - Dec 28', travelers: '2 Adults', source: 'USA', airport: 'JFK', total: '₹ 5,45,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-002' },
            { id: 'BK-005', customer: 'Sophia Loren', email: 'sophia@example.it', phone: '+39 06 1234567', package: 'Rome & Florence Cultural', dates: 'Sep 5 - Sep 12', travelers: '2 Adults', source: 'Italy', airport: 'FCO', total: '₹ 2,90,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-001' },
            { id: 'BK-006', customer: 'Liam Neeson', email: 'liam@example.com', phone: '+353 1 1234567', package: 'Dublin & Galway Explorer', dates: 'Oct 15 - Oct 22', travelers: '1 Adult', source: 'Ireland', airport: 'DUB', total: '₹ 1,85,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-002' },
            { id: 'BK-007', customer: 'Emma Watson', email: 'emma@example.com', phone: '+44 20 7946 0111', package: 'London & Cotswolds', dates: 'Nov 1 - Nov 8', travelers: '2 Adults', source: 'UK', airport: 'LHR', total: '₹ 3,20,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-002' },
            { id: 'BK-008', customer: 'Ahmed Al-Farsi', email: 'ahmed@example.om', phone: '+968 24 123456', package: 'Istanbul Heritage Tour', dates: 'Sep 1 - Sep 7', travelers: '4 Adults', source: 'Oman', airport: 'MCT', total: '₹ 1,95,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-002' },
            { id: 'BK-009', customer: 'Chloe Dubois', email: 'chloe.d@example.fr', phone: '+33 4 12 34 56 78', package: 'French Riviera Breeze', dates: 'Jun 15 - Jun 22', travelers: '2 Adults', source: 'France', airport: 'NCE', total: '₹ 2,80,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-004' },
            { id: 'BK-010', customer: 'Sven Larsson', email: 'sven.l@example.se', phone: '+46 8 123 45 67', package: 'Northern Lights Safari', dates: 'Dec 1 - Dec 6', travelers: '2 Adults', source: 'Sweden', airport: 'ARN', total: '₹ 3,10,000', status: 'confirmed', paymentStatus: 'paid', agentId: 'AGT-002' },
        ]
    },
    quotations: {
        name: 'Quotations',
        columns: ['ID', 'Customer', 'Destination', 'Source', 'Airport', 'Duration', 'Travelers', 'Total Amount', 'Status', 'Date'],
        data: [
            { id: 'QT-001', customer: 'John Doe', destination: 'Dubai, UAE', source: 'India', airport: 'BOM', duration: '6 Nights / 7 Days', travelers: '2 Adults', total: '₹ 1,50,000', status: 'confirmed', date: '2026-05-10', agentId: 'AGT-001' },
            { id: 'QT-002', customer: 'David Wilson', destination: 'Tokyo, Japan', source: 'Canada', airport: 'YYZ', duration: '7 Nights / 8 Days', travelers: '2 Adults', total: '₹ 4,50,000', status: 'sent', date: '2026-05-12', agentId: 'AGT-004' },
            { id: 'QT-003', customer: 'Robert Brown', destination: 'New York, USA', source: 'Germany', airport: 'FRA', duration: '6 Nights / 7 Days', travelers: '3 Adults', total: '₹ 5,80,000', status: 'draft', date: '2026-05-09', agentId: 'AGT-002' },
            { id: 'QT-004', customer: 'Sarah Jenkins', destination: 'Bali, Indonesia', source: 'Australia', airport: 'SYD', duration: '5 Nights / 6 Days', travelers: '2 Adults', total: '₹ 3,11,850', status: 'sent', date: '2026-05-05', agentId: 'AGT-003' },
            { id: 'QT-005', customer: 'Michael Smith', destination: 'Zurich, Switzerland', source: 'UK', airport: 'LHR', duration: '7 Nights / 8 Days', travelers: '4', total: '₹ 7,69,650', status: 'confirmed', date: '2026-05-01', agentId: 'AGT-002' },
            { id: 'QT-006', customer: 'Maria Garcia', destination: 'Madrid, Spain', source: 'Spain', airport: 'MAD', duration: '7 Nights / 8 Days', travelers: '3', total: '₹ 3,50,000', status: 'sent', date: '2026-05-12', agentId: 'AGT-004' },
            { id: 'QT-007', customer: 'James Miller', destination: 'London, UK', source: 'UK', airport: 'LHR', duration: '5 Nights / 6 Days', travelers: '2', total: '₹ 2,10,000', status: 'draft', date: '2026-05-13', agentId: 'AGT-002' },
            { id: 'QT-008', customer: 'Hiroshi Tanaka', destination: 'Kyoto, Japan', source: 'Japan', airport: 'NRT', duration: '5 Nights / 6 Days', travelers: '2', total: '₹ 4,20,000', status: 'sent', date: '2026-05-13', agentId: 'AGT-005' },
            { id: 'QT-009', customer: 'Anita Desai', destination: 'Santorini, Greece', source: 'India', airport: 'BOM', duration: '7 Nights / 8 Days', travelers: '2', total: '₹ 4,80,000', status: 'draft', date: '2026-05-12', agentId: 'AGT-001' },
            { id: 'QT-010', customer: 'Chloe Dubois', destination: 'Nice, France', source: 'France', airport: 'NCE', duration: '7 Nights / 8 Days', travelers: '2', total: '₹ 2,80,000', status: 'confirmed', date: '2026-05-11', agentId: 'AGT-004' },
        ]
    },
    customers: {
        name: 'Customers',
        columns: ['ID', 'Name', 'Email', 'Phone', 'Total Bookings'],
        data: [
            { id: 'CUST-001', name: 'John Doe', email: 'john@example.com', phone: '+91 9876543210', totalBookings: 1 },
            { id: 'CUST-002', name: 'Emily Chen', email: 'emily.chen@example.com', phone: '+1 555-0198', totalBookings: 0 },
            { id: 'CUST-003', name: 'Michael Smith', email: 'michael.s@example.com', phone: '+44 7700 900077', totalBookings: 0 },
            { id: 'CUST-004', name: 'Sarah Jenkins', email: 'sarah.j@example.com', phone: '+61 400 123 456', totalBookings: 1 },
            { id: 'CUST-005', name: 'Lisa Ray', email: 'lisa.ray@example.com', phone: '+91 9988776655', totalBookings: 1 },
            { id: 'CUST-006', name: 'Liam Neeson', email: 'liam@example.com', phone: '+353 1 1234567', totalBookings: 1 },
            { id: 'CUST-007', name: 'Emma Watson', email: 'emma@example.com', phone: '+44 20 7946 0111', totalBookings: 1 },
            { id: 'CUST-008', name: 'Ahmed Al-Farsi', email: 'ahmed@example.om', phone: '+968 24 123456', totalBookings: 1 },
            { id: 'CUST-009', name: 'Hiroshi Tanaka', email: 'tanaka@example.jp', phone: '+81 3 1234 5678', totalBookings: 0 },
            { id: 'CUST-010', name: 'Chloe Dubois', email: 'chloe.d@example.fr', phone: '+33 4 12 34 56 78', totalBookings: 1 },
        ]
    },
    destinations: {
        name: 'Destinations',
        columns: ['ID', 'Name', 'Country', 'Flag', 'Status'],
        data: [
            { id: 'DEST-001', name: 'Bali', country: 'Indonesia', flag: '🇮🇩', status: 'Active' },
            { id: 'DEST-002', name: 'Swiss Alps', country: 'Switzerland', flag: '🇨🇭', status: 'Active' },
            { id: 'DEST-003', name: 'Dubai', country: 'UAE', flag: '🇦🇪', status: 'Active' },
            { id: 'DEST-004', name: 'Paris', country: 'France', flag: '🇫🇷', status: 'Active' },
            { id: 'DEST-005', name: 'Tokyo', country: 'Japan', flag: '🇯🇵', status: 'Active' },
            { id: 'DEST-006', name: 'Singapore', country: 'Singapore', flag: '🇸🇬', status: 'Active' },
            { id: 'DEST-007', name: 'New York', country: 'USA', flag: '🇺🇸', status: 'Active' },
            { id: 'DEST-008', name: 'London', country: 'UK', flag: '🇬🇧', status: 'Active' },
            { id: 'DEST-009', name: 'Madrid', country: 'Spain', flag: '🇪🇸', status: 'Active' },
            { id: 'DEST-010', name: 'Istanbul', country: 'Turkey', flag: '🇹🇷', status: 'Active' },
            { id: 'DEST-011', name: 'Santorini', country: 'Greece', flag: '🇬🇷', status: 'Active' },
            { id: 'DEST-012', name: 'Sydney', country: 'Australia', flag: '🇦🇺', status: 'Active' },
        ]
    },
    hotels: {
        name: 'Hotels',
        columns: ['ID', 'Name', 'Location', 'Stars', 'Base Rate', 'Status', 'Description'],
        data: hotelLibrary.map(h => ({
            id: h.id.toUpperCase(),
            name: h.name,
            location: h.destination,
            destination: h.destination,
            stars: `${h.rating} Star`,
            rating: h.rating,
            baseRate: `${h.standardRate.toLocaleString()}/night`,
            standardRate: h.standardRate,
            deluxeRate: h.deluxeRate,
            luxuryRate: h.luxuryRate,
            description: h.description,
            status: 'Active',
        }))
    },
    activities: {
        name: 'Activities',
        columns: ['ID', 'Name', 'Location', 'Price', 'Description'],
        data: activityLibrary.map(a => ({
            id: a.id.toUpperCase(),
            name: a.title,
            title: a.title,
            country: a.country,
            location: a.country,
            price: a.price,
            priceNum: a.price,
            category: a.category,
            description: a.description,
            status: 'Active'
        }))
    },
    travelAgents: {
        name: 'Travel Agents',
        columns: ['ID', 'Name', 'Business', 'Email', 'Status', 'Joined Date', 'Plan'],
        data: [
            { id: 'AGT-001', name: 'Raj Kumar', businessName: 'Global Travels', email: 'raj@globaltravels.com', password: 'password123', status: 'approved', joinedDate: '2026-01-15', plan: 'Enterprise', planExpiresAt: '2027-01-15T00:00:00.000Z', planRenewedAt: '2026-01-15T00:00:00.000Z' },
            { id: 'AGT-002', name: 'Amit Patel', businessName: 'FlyHigh Travels', email: 'amit@flyhigh.com', password: 'password123', status: 'approved', joinedDate: '2026-02-10', plan: 'Growth', planExpiresAt: '2027-02-10T00:00:00.000Z', planRenewedAt: '2026-05-01T00:00:00.000Z' },
            { id: 'AGT-003', name: 'Sanjay Gupta', businessName: 'Desert Safaris', email: 'sanjay@desertsafaris.com', password: 'password123', status: 'approved', joinedDate: '2026-03-05', plan: 'Growth', planExpiresAt: '2027-03-05T00:00:00.000Z', isTrial: false },
            { id: 'AGT-004', name: 'Priya Sharma', businessName: 'Zen Holidays', email: 'priya@zenholidays.com', password: 'password123', status: 'approved', joinedDate: '2026-04-20', plan: 'Enterprise', planExpiresAt: '2027-04-20T00:00:00.000Z' },
            { id: 'AGT-005', name: 'Vikram Singh', businessName: 'Royal Tours', email: 'vikram@royaltours.com', password: 'password123', status: 'approved', joinedDate: '2026-05-11', plan: 'Growth', isTrial: true, trialEndsAt: '2026-07-25T00:00:00.000Z', planRenewedAt: '2026-05-11T00:00:00.000Z' },
        ]
    },
    staff: {
        name: 'Staff Members',
        columns: ['ID', 'Name', 'Employee ID', 'Agent ID', 'Role', 'Status'],
        data: [
            { id: 'STF-001', name: 'John Staff', employeeId: 'E-101', password: '123', agentId: 'AGT-001', role: 'Sales', status: 'active' },
            { id: 'STF-002', name: 'Jane Doe', employeeId: 'E-102', password: '123', agentId: 'AGT-001', role: 'Operations', status: 'active' },
            { id: 'STF-003', name: 'Alice Smith', employeeId: 'E-103', password: '123', agentId: 'AGT-002', role: 'Sales', status: 'active' },
            { id: 'STF-004', name: 'Bob Brown', employeeId: 'E-104', password: '123', agentId: 'AGT-002', role: 'Management', status: 'active' },
            { id: 'STF-005', name: 'Charlie Green', employeeId: 'E-105', password: '123', agentId: 'AGT-005', role: 'Sales', status: 'active' },
            { id: 'STF-006', name: 'Diana Prince', employeeId: 'E-106', password: '123', agentId: 'AGT-004', role: 'Operations', status: 'active' },
        ]
    },
    plans: {
        name: 'Subscription Plans',
        columns: ['ID', 'Name', 'Tagline', 'Price', 'Period', 'Staff Limit', 'Sub-Agent Limit', 'Features'],
        data: [
            { id: 'PLAN-001', name: 'Lite', tagline: 'Perfect for solo agents and small startups', price: '₹0', priceInr: 0, period: '/forever', staffLimit: 9999, subAgentLimit: 9999, features: 'Dashboard & Analytics,Lead Management (Pipeline & Kanban),Quotation Builder with Itinerary,Quotation PDF Download,Booking Management,Invoices & Finance Tracking,Terms & Conditions Templates' },
            { id: 'PLAN-002', name: 'Growth', tagline: 'Best for rising teams and growing agencies', price: '₹1,999', priceInr: 1999, period: '/month', staffLimit: 9999, subAgentLimit: 9999, features: 'Dashboard & Analytics,Lead Management (Pipeline & Kanban),Lead Follow-ups,Quotation Builder with Itinerary,Quotation PDF Download,Share Quotes via Email & WhatsApp,Booking Management,Hotel Vouchers,Trip Cancellations,Invoices & Finance Tracking,CSV Export (Bookings & Finance),Package Studio (Hotels / Activities / Presets),Terms & Conditions Templates,Team Staff with Role Permissions,Agency Branding (Logo & Profile),Bank Details on Invoices' },
            { id: 'PLAN-003', name: 'Enterprise', tagline: 'Scale your business with zero limits', price: '₹4,999', priceInr: 4999, period: '/month', staffLimit: 9999, subAgentLimit: 9999, features: 'Dashboard & Analytics,Lead Management (Pipeline & Kanban),Lead Follow-ups,Quotation Builder with Itinerary,Quotation PDF Download,Share Quotes via Email & WhatsApp,Booking Management,Hotel Vouchers,Trip Cancellations,Invoices & Finance Tracking,CSV Export (Bookings & Finance),Package Studio (Hotels / Activities / Presets),Terms & Conditions Templates,Team Staff with Role Permissions,Sub-Agent Management,Agency Branding (Logo & Profile),Bank Details on Invoices,Send Emails from Your Agency Address' },
        ]
    },
    settings: {
        name: 'Settings',
        columns: ['ID', 'Email', 'Agency Name', 'Support Email', 'Agency Address', 'Currency', 'Timezone', 'Avatar', 'Logo URL'],
        data: [
            {
                id: 'SET-001',
                email: 'admin@aumento.com',
                agencyName: PLATFORM_NAME,
                supportEmail: 'admin@aumento.com',
                agencyAddress: 'Main Headquarters',
                currency: 'INR (₹)',
                timezone: 'India Standard Time (IST)',
                avatar: '',
                logoUrl: ''
            }
        ]
    },
    customPresets: {
        name: 'Custom Presets',
        columns: ['ID', 'Name', 'Destination', 'Duration', 'Total Amount', 'Status'],
        data: []
    },
    quoteTerms: {
        name: 'Quote Terms & Conditions',
        columns: ['ID', 'Title', 'Location', 'Status', 'Default'],
        data: [
            {
                id: 'TC-DEFAULT',
                title: 'General Travel Terms',
                location: 'Global',
                locations: ['India', 'International'],
                content: `Rates are subject to availability at the time of booking.\nPassport must be valid for at least 6 months from the travel date.\nTravel insurance is highly recommended for all international trips.\nCancellation and amendment charges apply as per supplier policy.\nAll disputes are subject to local jurisdiction.`,
                agentId: null,
                isDefault: true,
                status: 'Active',
                updatedAt: '2026-05-01T00:00:00.000Z',
            },
            {
                id: 'TC-UAE',
                title: 'Dubai & UAE Package Terms',
                location: 'UAE',
                locations: ['Dubai', 'Abu Dhabi'],
                content: `Rates are subject to hotel and flight availability at confirmation.\nUAE visa processing timelines apply; passport must be valid 6+ months.\nTourism Dirham / municipality fees may apply at hotel check-in.\nFriday and public holiday schedules may affect activity timings.\nNo-show and late cancellation penalties are non-refundable.`,
                agentId: null,
                isDefault: false,
                status: 'Active',
                updatedAt: '2026-05-01T00:00:00.000Z',
            },
            {
                id: 'TC-FR',
                title: 'France & Europe Package Terms',
                location: 'France',
                locations: ['Paris', 'Nice', 'Europe'],
                content: `Schengen visa requirements apply for Indian passport holders.\nCity tax may be payable directly at hotels in France.\nMuseum and attraction entry is subject to seasonal closures.\nTrain and transfer timings are indicative and may vary.\nTravel insurance covering medical and trip cancellation is mandatory.`,
                agentId: null,
                isDefault: false,
                status: 'Active',
                updatedAt: '2026-05-01T00:00:00.000Z',
            },
            {
                id: 'TC-ID',
                title: 'Bali & Indonesia Package Terms',
                location: 'Indonesia',
                locations: ['Bali'],
                content: `Indonesia visa-on-arrival or e-VOA rules apply as per nationality.\nPeak season surcharges may apply on hotels and activities.\nMonsoon weather may affect water sports and transfers.\nAll domestic flights are subject to airline schedule changes.\nPersonal expenses, tips, and optional tours are not included.`,
                agentId: null,
                isDefault: false,
                status: 'Active',
                updatedAt: '2026-05-01T00:00:00.000Z',
            },
        ]
    }
};

const hydrateTravelAgents = (agents: any[] = [], mergeSeed = false) =>
    migrateTravelAgentRecords(agents, mergeSeed ? initialDB.travelAgents.data : []);

export const buildEmptyDatabase = () => {
    const empty: any = {};
    Object.keys(initialDB).forEach((key) => {
        empty[key] = {
            name: (initialDB as any)[key].name,
            columns: (initialDB as any)[key].columns,
            data: [],
        };
    });
    return empty;
};

export const buildSeededDatabase = () => {
    const empty = buildEmptyDatabase();
    return {
        ...empty,
        destinations: initialDB.destinations,
        hotels: initialDB.hotels,
        activities: initialDB.activities,
        plans: initialDB.plans,
        settings: initialDB.settings,
        quoteTerms: initialDB.quoteTerms,
    };
};

const mergeCollectionsIntoDatabase = (collections: Record<string, any[]>) => {
    const base = buildEmptyDatabase();
    Object.keys(base).forEach((key) => {
        if (Array.isArray(collections[key])) {
            base[key].data = collections[key];
        }
    });
    return hydrateParsedDatabase(base, { syncBookings: true, enrichFromLibraries: false });
};

const hasAnyCollectionData = (collections: Record<string, unknown[]>) =>
    Object.values(collections).some((records) => Array.isArray(records) && records.length > 0);

type HydrateOptions = {
    /** When false, keep bookings/customers exactly as stored in MongoDB. */
    syncBookings?: boolean;
    /** When false, do not backfill hotel/activity rows from static libraries. */
    enrichFromLibraries?: boolean;
};

const hydrateParsedDatabase = (parsed: any, options: HydrateOptions = {}) => {
    const { syncBookings = true, enrichFromLibraries = true } = options;
    Object.keys(initialDB).forEach((key) => {
        if (!parsed[key]) {
            parsed[key] = {
                name: (initialDB as any)[key].name,
                columns: (initialDB as any)[key].columns,
                data: [],
            };
        } else if (!Array.isArray(parsed[key].data)) {
            parsed[key] = {
                name: parsed[key].name || (initialDB as any)[key].name,
                columns: parsed[key].columns || (initialDB as any)[key].columns,
                data: [],
            };
        }
    });

    if (enrichFromLibraries && parsed.hotels?.data?.length) {
        parsed.hotels.data = parsed.hotels.data.map((row: any) => {
            const lib = hotelLibrary.find(
                (h) => h.id.toUpperCase() === String(row.id || '').toUpperCase()
            );
            const standardRate = Number(row.standardRate) || lib?.standardRate || 0;
            const deluxeRate = Number(row.deluxeRate) || lib?.deluxeRate || 0;
            const luxuryRate = Number(row.luxuryRate) || lib?.luxuryRate || 0;
            return {
                ...row,
                destination: row.destination || row.location || lib?.destination,
                location: row.location || row.destination || lib?.destination,
                rating: row.rating ?? lib?.rating ?? 5,
                standardRate,
                deluxeRate,
                luxuryRate,
                description: row.description || lib?.description || '',
                baseRate:
                    row.baseRate ||
                    (standardRate > 0 ? `${standardRate.toLocaleString()}/night` : row.baseRate),
            };
        });
    }

    parsed.travelAgents = {
        name: parsed.travelAgents?.name || initialDB.travelAgents.name,
        columns: parsed.travelAgents?.columns || initialDB.travelAgents.columns,
        data: hydrateTravelAgents(parsed.travelAgents?.data || []),
    };

    if (enrichFromLibraries && parsed.activities?.data?.length) {
        parsed.activities.data = parsed.activities.data.map((row: any) => {
            const lib = activityLibrary.find(
                (a) => a.id.toUpperCase() === String(row.id || '').toUpperCase()
            );
            if (!lib) {
                return {
                    ...row,
                    title: row.title || row.name,
                    name: row.name || row.title,
                    country: row.country || row.location,
                    location: row.location || row.country,
                    category: row.category || 'Experience',
                };
            }
            return {
                ...row,
                name: row.name || lib.title,
                title: row.title || lib.title,
                country: row.country || lib.country,
                location: row.location || lib.country,
                price: row.price ?? lib.price,
                priceNum: row.priceNum ?? lib.price,
                category: row.category || lib.category,
                description: row.description || lib.description,
            };
        });
    }

    if (parsed.settings?.data?.length) {
        parsed.settings.data = parsed.settings.data.map((setting: any) => {
            const legacyNames = new Set(['Lord Shiva', 'Lord Shiva Admin']);
            if (legacyNames.has(setting?.agencyName)) {
                return { ...setting, agencyName: PLATFORM_NAME };
            }
            return setting;
        });
    }

    const sanitized = sanitizeWorkspaceData(parsed);
    const { db: pricedDb } = migrateQuotationsPricing(sanitized);
    return syncBookings ? syncConfirmedLeadsWithBookings(pricedDb) : pricedDb;
};

const loadDatabaseFromLocalStorage = () => {
    const saved = localStorage.getItem('crm_database');
    if (!saved) {
        return hydrateParsedDatabase(buildEmptyDatabase(), {
            syncBookings: false,
            enrichFromLibraries: false,
        });
    }
    return hydrateParsedDatabase(JSON.parse(saved), {
        syncBookings: true,
        enrichFromLibraries: false,
    });
};

const DatabaseContext = createContext<any>(null);

export const syncConfirmedLeadsWithBookings = (db: any) => {
    if (!db || !db.leads || !db.bookings) return db;

    let dbChanged = false;
    const leadsData = [...db.leads.data];
    let bookingsData = [...db.bookings.data];
    let customersData = db.customers ? [...db.customers.data] : [];
    let quotationsData = db.quotations ? [...db.quotations.data] : [];

    // Version / createdAt normalization only — avoid repricing every quote on each sync.
    quotationsData = quotationsData.map((q: any) => {
        let next = q;
        const fixedVersion = normalizeQuoteVersion(q.version);
        if (String(q.version || '') !== fixedVersion) {
            dbChanged = true;
            next = { ...next, version: fixedVersion };
        }
        if (!next.createdAt) {
            const inferred = inferQuoteCreatedAt(next);
            if (inferred) {
                dbChanged = true;
                next = { ...next, createdAt: inferred };
            }
        }
        return next;
    });

    const dbWithQuotes = quotationsData.length
        ? { ...db, quotations: { ...db.quotations, data: quotationsData } }
        : db;

    // 1. Unique ID deduplication: Keep only the first booking record for any unique ID
    const seenIds = new Set<string>();
    const uniqueBookingsById: any[] = [];
    for (const b of bookingsData) {
        if (b && b.id) {
            if (!seenIds.has(b.id)) {
                seenIds.add(b.id);
                uniqueBookingsById.push(b);
            } else {
                dbChanged = true;
            }
        } else {
            uniqueBookingsById.push(b);
        }
    }
    bookingsData = uniqueBookingsById;

    // 2. Lead-based deduplication: For each lead, keep at most one booking.
    // If a lead is confirmed, find all bookings that match it and keep only the first/primary one.
    const leadsWithConfirmedBookings = leadsData.filter((l: any) => isConfirmedLead(l));
    const bookingsToRemove = new Set<string>();
    
    leadsWithConfirmedBookings.forEach((lead: any) => {
        const matches = bookingsData.filter((b: any) =>
            findBookingForLead(lead, [b], lead.confirmedQuoteId)?.id === b.id
        );
        
        if (matches.length > 1) {
            // Prefer the booking matching lead.bookingId, otherwise the first one
            const keepBooking = matches.find((b: any) => lead.bookingId && b.id === lead.bookingId) || matches[0];
            
            matches.forEach((b: any) => {
                if (b.id !== keepBooking.id) {
                    bookingsToRemove.add(b.id);
                }
            });
        }
    });
    
    if (bookingsToRemove.size > 0) {
        bookingsData = bookingsData.filter((b: any) => !bookingsToRemove.has(b.id));
        dbChanged = true;
    }

    const getNextBookingId = (bookings: any[]) => {
        const floor = DEMO_ID_MIN.bookings ?? 11;
        const existingNums = bookings
            .map((r: any) => {
                const idStr = String(r.id || '');
                const parts = idStr.split('-');
                return parseInt(parts[parts.length - 1]);
            })
            .filter((n: number) => !isNaN(n));
        const nextNum =
            existingNums.length > 0 ? Math.max(...existingNums, floor - 1) + 1 : floor;
        return `BK-${String(nextNum).padStart(3, '0')}`;
    };

    const getNextCustomerId = (customers: any[]) => {
        const floor = DEMO_ID_MIN.customers ?? 11;
        const existingNums = customers
            .map((r: any) => {
                const idStr = String(r.id || '');
                const parts = idStr.split('-');
                return parseInt(parts[parts.length - 1]);
            })
            .filter((n: number) => !isNaN(n));
        const nextNum =
            existingNums.length > 0 ? Math.max(...existingNums, floor - 1) + 1 : floor;
        return `CUST-${String(nextNum).padStart(3, '0')}`;
    };

    const usedTrackingIds = new Set<string>();
    const updatedLeadsData = leadsData.map((lead: any) => {
        const leadTrackingId = ensureTrackingId(lead?.trackingId, Array.from(usedTrackingIds));
        usedTrackingIds.add(leadTrackingId);
        let updatedLead = { ...lead, trackingId: leadTrackingId };
        if (lead?.trackingId !== leadTrackingId) {
            dbChanged = true;
        }

        if (isConfirmedLead(lead)) {
            let quote: any = null;
            if (lead.confirmedQuoteId && db.quotations?.data) {
                quote = db.quotations.data.find((q: any) => q.id === lead.confirmedQuoteId);
            }

            if (!quote) {
                const linkedBooking = findBookingForLead(lead, bookingsData, lead.confirmedQuoteId);
                const hasLegacyConfirmedBooking =
                    linkedBooking && isConfirmedBookingStatus(linkedBooking);

                if (hasLegacyConfirmedBooking) {
                    return updatedLead;
                }

                const revertedStatus = inferLeadPipelineStatus(dbWithQuotes, lead);
                dbChanged = true;
                updatedLead = {
                    ...updatedLead,
                    status: revertedStatus,
                    confirmedQuoteId: '',
                };
                return updatedLead;
            }

            const existingBooking = findBookingForLead(lead, bookingsData, lead.confirmedQuoteId);
            const bookingIndex = existingBooking
                ? bookingsData.findIndex((b: any) => b.id === existingBooking.id)
                : -1;

            const budgetFormatted = getUnifiedBudgetForLead(lead, dbWithQuotes);

            const bookingPackage = quote ? quote.destination : (lead.destination || 'Custom Package');
            const bookingDates = quote 
                ? (quote.departureDate ? `${new Date(quote.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} onwards` : lead.dates)
                : (lead.dates || 'Dates TBD');
            const bookingTotal = quote 
                ? getUnifiedBudgetForQuote(quote, dbWithQuotes)
                : budgetFormatted;
            const bookingTravelers = quote ? quote.travelers : (lead.travelers || '2 Adults');
            const bookingPresetId = quote ? quote.presetId : (lead.presetId || '');
            const bookingQuoteId = quote ? quote.id : '';

            if (bookingIndex === -1) {
                // Create booking
                const nextBookingId = getNextBookingId(bookingsData);
                const newBooking = {
                    id: nextBookingId,
                    trackingId: leadTrackingId,
                    createdAt: lead.createdAt || new Date().toISOString(),
                    customer: lead.name,
                    package: bookingPackage,
                    dates: bookingDates,
                    total: bookingTotal,
                    status: 'confirmed',
                    paymentStatus: 'unpaid',
                    paid: '₹ 0',
                    nextDue: '-',
                    travelers: bookingTravelers,
                    presetId: bookingPresetId,
                    quoteId: bookingQuoteId,
                    email: lead.email || '',
                    phone: lead.phone || '',
                    sourceCountry: lead.sourceCountry || '',
                    sourceAirport: lead.sourceAirport || '',
                    source: lead.source || '',
                    agentId: lead.agentId || '',
                    agentName: lead.agentName || '',
                    leadId: lead.id,
                };
                bookingsData = [newBooking, ...bookingsData];
                dbChanged = true;

                updatedLead.bookingId = nextBookingId;
            } else {
                // Update booking if it exists to ensure fields are in sync
                const existingBooking = bookingsData[bookingIndex];
                const pipelineStatus =
                    lead.status === 'completed' ? 'completed' : 'confirmed';
                const updatedBooking = {
                    ...existingBooking,
                    trackingId: leadTrackingId,
                    customer: lead.name,
                    package: bookingPackage,
                    dates: bookingDates,
                    total: bookingTotal,
                    travelers: bookingTravelers,
                    presetId: bookingPresetId || existingBooking.presetId,
                    quoteId: bookingQuoteId || existingBooking.quoteId,
                    email: lead.email || '',
                    phone: lead.phone || '',
                    sourceCountry: lead.sourceCountry || existingBooking.sourceCountry,
                    sourceAirport: lead.sourceAirport || existingBooking.sourceAirport,
                    source: lead.source || existingBooking.source,
                    agentId: lead.agentId || existingBooking.agentId,
                    agentName: lead.agentName || existingBooking.agentName,
                    leadId: lead.id,
                    status: pipelineStatus,
                };

                const hasChanged = JSON.stringify(existingBooking) !== JSON.stringify(updatedBooking);
                if (hasChanged) {
                    bookingsData[bookingIndex] = updatedBooking;
                    dbChanged = true;
                }

                if (!lead.bookingId || lead.bookingId !== existingBooking.id) {
                    dbChanged = true;
                    updatedLead.bookingId = existingBooking.id;
                }
            }

            if (db.customers) {
                const customerExists = customersData.some((c: any) => c.name === lead.name);
                if (!customerExists) {
                    const nextCustId = getNextCustomerId(customersData);
                    customersData = [
                        ...customersData,
                        {
                            id: nextCustId,
                            name: lead.name,
                            email: lead.email || '',
                            phone: lead.phone || '',
                            totalBookings: 0,
                            bookings: '0',
                        }
                    ];
                    dbChanged = true;
                }
            }
        }

        const syncedBudget = getUnifiedBudgetForLead(updatedLead, dbWithQuotes);
        if (syncedBudget && syncedBudget !== updatedLead.budget) {
            updatedLead = { ...updatedLead, budget: syncedBudget };
            dbChanged = true;
        }

        if (lead.bookingId) {
            // Non-confirmed leads with a booking: mirror pipeline status on the booking row
            const bookingIndex = bookingsData.findIndex((b: any) => b.id === lead.bookingId);
            if (bookingIndex !== -1) {
                const existingBooking = bookingsData[bookingIndex];
                const pipelineStatus = String(lead.status || 'pending').toLowerCase();
                if (existingBooking.status !== pipelineStatus) {
                    bookingsData[bookingIndex] = {
                        ...existingBooking,
                        status: pipelineStatus,
                        agentId: lead.agentId || existingBooking.agentId,
                        agentName: lead.agentName || existingBooking.agentName,
                    };
                    dbChanged = true;
                }
            }
        }
        return updatedLead;
    });

    // Keep booking contact fields aligned with the linked lead (avoids wrong email when names duplicate)
    bookingsData = bookingsData.map((booking: any) => {
        if (!booking?.leadId) return booking;
        const owner = updatedLeadsData.find((l: any) => l.id === booking.leadId);
        if (!owner) return booking;
        const email = owner.email || '';
        const phone = owner.phone || '';
        if (booking.email === email && booking.phone === phone) return booking;
        dbChanged = true;
        return { ...booking, email, phone };
    });

    if (dbChanged) {
        return {
            ...db,
            leads: {
                ...db.leads,
                data: updatedLeadsData
            },
            bookings: {
                ...db.bookings,
                data: bookingsData
            },
            ...(db.quotations
                ? {
                      quotations: {
                          ...db.quotations,
                          data: quotationsData,
                      },
                  }
                : {}),
            ...(db.customers
                ? {
                      customers: {
                          ...db.customers,
                          data: customersData,
                      },
                  }
                : {}),
        };
    }

    return db;
};

export const DatabaseProvider = ({ children }: any) => {
    const [db, setDb] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mongoConnected, setMongoConnected] = useState(false);
    const migratedRef = useRef(false);
    const isRefreshingRef = useRef(false);

    const applyRemoteDatabase = (remote: any) =>
        hydrateParsedDatabase(remote, { syncBookings: true, enrichFromLibraries: false });

    useEffect(() => {
        let cancelled = false;

        const loadDatabase = async () => {
            const apiAvailable = await checkMongoHealth();

            if (apiAvailable) {
                try {
                    const { collections } = await fetchCollectionsFromMongo();
                    let nextDb;

                    if (hasAnyCollectionData(collections)) {
                        nextDb = mergeCollectionsIntoDatabase(collections as Record<string, any[]>);
                    } else {
                        const snapshot = await fetchDatabaseFromMongo();
                        if (snapshot) {
                            nextDb = applyRemoteDatabase(snapshot);
                            await saveDatabaseToMongo(nextDb);
                        } else {
                            nextDb = applyRemoteDatabase(buildEmptyDatabase());
                        }
                    }

                    if (!cancelled) {
                        setDb(nextDb);
                        setMongoConnected(true);
                        setIsLoading(false);
                        try {
                            localStorage.setItem('crm_database', JSON.stringify(nextDb));
                        } catch {
                            /* ignore quota errors */
                        }
                    }
                    return;
                } catch (error) {
                    console.warn('MongoDB load failed, falling back to local cache:', error);
                }
            }

            if (!cancelled) {
                setDb(loadDatabaseFromLocalStorage());
                setMongoConnected(false);
                setIsLoading(false);
            }
        };

        loadDatabase();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!mongoConnected || isLoading) return;

        const refreshFromMongo = async () => {
            if (isRefreshingRef.current) return;

            isRefreshingRef.current = true;
            try {
                const { collections } = await fetchCollectionsFromMongo();
                if (!hasAnyCollectionData(collections)) return;

                setDb(mergeCollectionsIntoDatabase(collections as Record<string, any[]>));
            } catch (error) {
                console.warn('Live refresh from MongoDB failed:', error);
            } finally {
                isRefreshingRef.current = false;
            }
        };

        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void refreshFromMongo();
            }
        }, 10000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshFromMongo();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [mongoConnected, isLoading]);

    useEffect(() => {
        if (!db || migratedRef.current) return;
        migratedRef.current = true;

        setDb((prev: any) => {
            const migrated = hydrateTravelAgents(prev.travelAgents?.data || []);
            if (JSON.stringify(migrated) === JSON.stringify(prev.travelAgents?.data || [])) {
                return prev;
            }
            return {
                ...prev,
                travelAgents: {
                    name: prev.travelAgents?.name || initialDB.travelAgents.name,
                    columns: prev.travelAgents?.columns || initialDB.travelAgents.columns,
                    data: migrated,
                },
            };
        });
    }, [db]);

    useEffect(() => {
        if (!db || isLoading) return;

        try {
            localStorage.setItem('crm_database', JSON.stringify(db));
        } catch (e) {
            console.error('Database sync failed (likely localStorage limit exceeded):', e);
        }
    }, [db, isLoading]);

    const persistEntityChange = (
        table: string,
        action: 'create' | 'update' | 'delete',
        recordOrId: any,
        updates?: any
    ) => {
        if (!mongoConnected || !PERSISTABLE_TABLES.has(table)) return;

        const onError = (label: string) => (error: unknown) => {
            console.error(`MongoDB ${label} failed:`, error);
        };

        if (action === 'create') {
            upsertCollectionRecord(table, recordOrId).catch(onError(`${table} create`));
        }
        if (action === 'update') {
            patchCollectionRecord(table, recordOrId, updates).catch(onError(`${table} update`));
        }
        if (action === 'delete') {
            deleteCollectionRecord(table, recordOrId).catch(onError(`${table} delete`));
        }
    };

    const addRecord = (table: string, record: any) => {
        let nextRecord = record;

        if (typeof window !== 'undefined') {
            const userRole = localStorage.getItem('userRole');
            const sessionAgentId = localStorage.getItem('agentId');

            if (userRole && userRole !== 'admin' && sessionAgentId) {
                if (table === 'staff') {
                    const staffCheck = canAddAgencyStaff(db, sessionAgentId);
                    if (!staffCheck.allowed) {
                        window.alert(staffCheck.message);
                        return;
                    }
                    nextRecord = normalizeStaffRecordForAgency(nextRecord, db, sessionAgentId);
                }

                if (
                    table === 'travelAgents' &&
                    String(nextRecord?.parentId ?? '').trim() !== ''
                ) {
                    nextRecord = normalizeSubAgentRecordForAgency(nextRecord, db, sessionAgentId);
                }
            }
        }

        setDb((prev: any) => {
            const nextDb = {
                ...prev,
                [table]: {
                    ...prev[table],
                    data: [nextRecord, ...prev[table].data]
                }
            };
            return syncConfirmedLeadsWithBookings(nextDb);
        });
        persistEntityChange(table, 'create', nextRecord);
    };

    const updateRecord = (table: string, id: string, updates: any) => {
        setDb((prev: any) => {
            const nextDb = {
                ...prev,
                [table]: {
                    ...prev[table],
                    data: prev[table].data.map((item: any) => item.id === id ? { ...item, ...updates } : item)
                }
            };
            return syncConfirmedLeadsWithBookings(nextDb);
        });
        persistEntityChange(table, 'update', id, updates);
    };

    const deleteRecord = (table: string, id: string) => {
        if (table === 'leads' && db) {
            const lead = db.leads?.data?.find((item: any) => item.id === id);
            const linkedBookings = lead ? findLinkedBookingsForLead(lead, db) : [];
            const linkedQuotations = lead ? findLinkedQuotationsForLead(lead, db) : [];
            const bookingIds = new Set(linkedBookings.map((b: any) => b.id));
            const quotationIds = new Set(linkedQuotations.map((q: any) => q.id));

            setDb((prev: any) => ({
                ...prev,
                leads: {
                    ...prev.leads,
                    data: prev.leads.data.filter((item: any) => item.id !== id),
                },
                ...(prev.bookings
                    ? {
                          bookings: {
                              ...prev.bookings,
                              data: prev.bookings.data.filter((b: any) => !bookingIds.has(b.id)),
                          },
                      }
                    : {}),
                ...(prev.quotations
                    ? {
                          quotations: {
                              ...prev.quotations,
                              data: prev.quotations.data.filter((q: any) => !quotationIds.has(q.id)),
                          },
                      }
                    : {}),
            }));

            linkedBookings.forEach((b: any) => persistEntityChange('bookings', 'delete', b.id));
            linkedQuotations.forEach((q: any) => persistEntityChange('quotations', 'delete', q.id));
            persistEntityChange('leads', 'delete', id);
            return;
        }

        setDb((prev: any) => {
            const nextDb = {
                ...prev,
                [table]: {
                    ...prev[table],
                    data: prev[table].data.filter((item: any) => item.id !== id),
                },
            };
            return syncConfirmedLeadsWithBookings(nextDb);
        });
        persistEntityChange(table, 'delete', id);
    };

    const softDeleteLead = (id: string) => {
        if (!db) return;

        const lead = db.leads?.data?.find((item: any) => item.id === id);
        if (!lead) return;

        const linkedBookings = findLinkedBookingsForLead(lead, db);
        const bookingIds = new Set(linkedBookings.map((b: any) => b.id));
        const patch = {
            status: 'deleted',
            deletedAt: new Date().toISOString(),
            previousStatus: lead.status,
            bookingId: '',
        };

        setDb((prev: any) => ({
            ...prev,
            leads: {
                ...prev.leads,
                data: prev.leads.data.map((item: any) =>
                    item.id === id ? { ...item, ...patch } : item
                ),
            },
            ...(prev.bookings
                ? {
                      bookings: {
                          ...prev.bookings,
                          data: prev.bookings.data.filter((b: any) => !bookingIds.has(b.id)),
                      },
                  }
                : {}),
        }));

        linkedBookings.forEach((b: any) => persistEntityChange('bookings', 'delete', b.id));
        persistEntityChange('leads', 'update', id, patch);
    };

    const getNextId = (table: string, prefix: string) => {
        const floor = DEMO_ID_MIN[table] ?? 1;
        const existingNums = (db?.[table]?.data || [])
            .map((r: any) => {
                const idStr = String(r.id || '');
                const parts = idStr.split('-');
                return parseInt(parts[parts.length - 1]);
            })
            .filter((n: number) => !isNaN(n));
        const nextNum =
            existingNums.length > 0 ? Math.max(...existingNums, floor - 1) + 1 : floor;
        return `${prefix}-${String(nextNum).padStart(3, '0')}`;
    };

    if (isLoading || !db) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-crm-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Connecting to database...</p>
                </div>
            </div>
        );
    }

    return (
        <DatabaseContext.Provider
            value={{ db, addRecord, updateRecord, deleteRecord, softDeleteLead, getNextId, mongoConnected }}
        >
            {children}
        </DatabaseContext.Provider>
    );
};

export const useDatabase = () => useContext(DatabaseContext);