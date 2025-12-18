#!/usr/bin/env node
/**
 * Generate Random Jobs Script - Tennessee
 * 
 * Creates a bunch of random jobs scattered across Tennessee for testing
 * map and filters functionality.
 * 
 * Usage:
 *   node scripts/generate-tn-jobs.js [--count=20]
 */

require('dotenv').config();
const prisma = require('../db');
const bcrypt = require('bcrypt');

// Tennessee coordinates (approximate bounds)
const TN_BOUNDS = {
  minLat: 35.0,
  maxLat: 36.7,
  minLng: -90.3,
  maxLng: -81.7
};

// Major Tennessee cities with coordinates for realistic distribution
const TN_CITIES = [
  { name: 'Nashville', lat: 36.1627, lng: -86.7816 },
  { name: 'Memphis', lat: 35.1495, lng: -90.0490 },
  { name: 'Knoxville', lat: 35.9606, lng: -83.9207 },
  { name: 'Chattanooga', lat: 35.0456, lng: -85.3097 },
  { name: 'Murfreesboro', lat: 35.8456, lng: -86.3903 },
  { name: 'Franklin', lat: 35.9251, lng: -86.8689 },
  { name: 'Jackson', lat: 35.6145, lng: -88.8139 },
  { name: 'Johnson City', lat: 36.3134, lng: -82.3535 },
  { name: 'Bartlett', lat: 35.2045, lng: -89.8739 },
  { name: 'Hendersonville', lat: 36.3048, lng: -86.6200 },
  { name: 'Kingsport', lat: 36.5484, lng: -82.5618 },
  { name: 'Clarksville', lat: 36.5298, lng: -87.3595 },
];

// Job categories
const CATEGORIES = [
  'moving',
  'yard-work',
  'dump-run',
  'cleaning',
  'power-washing',
  'furniture-assembly',
  'painting',
  'handyman',
  'landscaping',
  'pet-care',
  'delivery',
  'car-cleaning',
  'event-setup',
  'snow-removal',
  'other'
];

// Job titles by category
const JOB_TITLES = {
  'moving': ['Help moving furniture', 'Apartment move', 'Heavy lifting needed', 'Move boxes to storage'],
  'yard-work': ['Mow lawn', 'Weed garden', 'Trim bushes', 'Clean up yard', 'Rake leaves'],
  'dump-run': ['Haul away junk', 'Remove old furniture', 'Clean out garage', 'Dispose of items'],
  'cleaning': ['Deep clean house', 'Kitchen cleaning', 'Bathroom cleaning', 'Office cleaning'],
  'power-washing': ['Power wash driveway', 'Clean siding', 'Wash deck', 'Clean patio'],
  'furniture-assembly': ['Assemble IKEA furniture', 'Put together desk', 'Build bed frame'],
  'painting': ['Paint bedroom', 'Touch up walls', 'Paint exterior trim'],
  'handyman': ['Fix door', 'Install shelves', 'Repair fence', 'Mount TV'],
  'landscaping': ['Plant garden', 'Install mulch', 'Tree trimming', 'Design landscape'],
  'pet-care': ['Dog walking', 'Pet sitting', 'Grooming help'],
  'delivery': ['Deliver packages', 'Pick up furniture', 'Transport items'],
  'car-cleaning': ['Wash car', 'Detail interior', 'Wax car'],
  'event-setup': ['Set up party', 'Event decorations', 'Clean up after event'],
  'snow-removal': ['Shovel driveway', 'Clear sidewalks', 'Snow removal'],
  'other': ['General help needed', 'Various tasks', 'Multiple jobs']
};

// Job descriptions by category
const JOB_DESCRIPTIONS = {
  'moving': ['Need help moving furniture from one room to another. Heavy items require two people.', 'Moving to a new apartment and need assistance with boxes and furniture.', 'Quick move - just need help with heavy items.'],
  'yard-work': ['Lawn needs mowing and garden needs weeding. Tools provided.', 'Yard cleanup needed after winter. Raking and trimming required.', 'Regular yard maintenance - mowing and edging.'],
  'dump-run': ['Have old furniture and boxes to get rid of. Need someone with a truck.', 'Garage cleanup - several items need to be hauled away.', 'Removing old appliances - need disposal help.'],
  'cleaning': ['Deep cleaning needed for entire house. All supplies provided.', 'Kitchen and bathroom deep clean required.', 'Office space needs thorough cleaning.'],
  'power-washing': ['Driveway and sidewalks need power washing. Equipment available.', 'Siding and deck need to be cleaned with power washer.', 'Patio and outdoor area needs pressure washing.'],
  'furniture-assembly': ['New furniture arrived - need help assembling. Instructions included.', 'Desk and shelves need to be put together.', 'Bed frame assembly required.'],
  'painting': ['Bedroom walls need painting. Paint and supplies provided.', 'Touch up work needed on several walls.', 'Exterior trim painting job.'],
  'handyman': ['Door hinge needs repair and shelves need installation.', 'Several small repairs needed around the house.', 'TV mounting and shelf installation.'],
  'landscaping': ['Garden planting and mulching needed.', 'Tree trimming and yard cleanup required.', 'Landscape design and installation help needed.'],
  'pet-care': ['Dog walking services needed while I\'m away.', 'Pet sitting for the weekend.', 'Help with pet grooming.'],
  'delivery': ['Need items delivered across town.', 'Furniture pickup and delivery needed.', 'Package delivery service required.'],
  'car-cleaning': ['Car needs thorough wash and interior detail.', 'Vehicle cleaning and waxing needed.', 'Full car detail service.'],
  'event-setup': ['Party setup help needed - decorations and tables.', 'Event setup and breakdown required.', 'Wedding decorations and setup.'],
  'snow-removal': ['Driveway and sidewalk need shoveling.', 'Snow removal from property required.', 'Clear paths and driveway after snowfall.'],
  'other': ['Various tasks around the house - will discuss details.', 'Multiple small jobs that need attention.', 'General help with various projects.']
};

// Get a random float between min and max
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Get a random integer between min and max (inclusive)
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Get a random element from an array
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate a random location in Tennessee (weighted towards cities)
function generateLocation() {
  // 70% chance of being near a major city, 30% random
  if (Math.random() < 0.7) {
    const city = randomElement(TN_CITIES);
    // Add some random offset (within ~10 miles)
    const offsetLat = randomFloat(-0.15, 0.15);
    const offsetLng = randomFloat(-0.15, 0.15);
    return {
      lat: city.lat + offsetLat,
      lng: city.lng + offsetLng,
      city: city.name
    };
  } else {
    // Random location in Tennessee
    return {
      lat: randomFloat(TN_BOUNDS.minLat, TN_BOUNDS.maxLat),
      lng: randomFloat(TN_BOUNDS.minLng, TN_BOUNDS.maxLng),
      city: 'Tennessee'
    };
  }
}

// Generate random date (within next 30 days)
function generateDate() {
  const now = new Date();
  const daysOut = randomInt(0, 30);
  const date = new Date(now);
  date.setDate(date.getDate() + daysOut);
  return date;
}

// Generate random time range for a job
function generateTimeRange(baseDate) {
  const startHour = randomInt(8, 16); // Between 8 AM and 4 PM
  const duration = randomInt(2, 6); // 2-6 hours
  const startTime = new Date(baseDate);
  startTime.setHours(startHour, randomInt(0, 59), 0, 0);
  const endTime = new Date(startTime);
  endTime.setHours(startHour + duration, randomInt(0, 59), 0, 0);
  return { startTime, endTime };
}

// Get or create a test customer user
async function getOrCreateTestCustomer() {
  // Try to find existing test customer
  let customer = await prisma.user.findFirst({
    where: {
      email: 'test-customer-tn@hustl.test',
      roles: {
        has: 'CUSTOMER'
      }
    }
  });

  if (!customer) {
    // Create new test customer
    const hashedPassword = await bcrypt.hash('test123', 10);
    customer = await prisma.user.create({
      data: {
        email: 'test-customer-tn@hustl.test',
        passwordHash: hashedPassword,
        name: 'Test Customer TN',
        username: 'test-customer-tn',
        city: 'Nashville',
        zip: '37201',
        roles: ['CUSTOMER'],
        emailVerified: true
      }
    });
    console.log('✅ Created test customer user');
  } else {
    console.log('✅ Using existing test customer user');
  }

  return customer;
}

// Generate a single job
async function generateJob(customerId, index) {
  const category = randomElement(CATEGORIES);
  const title = randomElement(JOB_TITLES[category]);
  const description = randomElement(JOB_DESCRIPTIONS[category]);
  const location = generateLocation();
  
  const date = generateDate();
  const { startTime, endTime } = generateTimeRange(date);
  
  // Random pay type and amount
  const payType = randomElement(['flat', 'hourly']);
  let amount, hourlyRate, estHours;
  
  if (payType === 'flat') {
    amount = randomInt(50, 500);
  } else {
    hourlyRate = randomInt(15, 50);
    estHours = randomInt(2, 8);
    amount = hourlyRate * estHours;
  }
  
  // Calculate expiration (3-7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + randomInt(3, 7));
  expiresAt.setHours(23, 59, 59, 999);
  
  const jobData = {
    customerId,
    title: `${title} #${index + 1}`,
    category,
    description,
    photos: [],
    address: `Approximate location in ${location.city}, TN`,
    lat: location.lat,
    lng: location.lng,
    approximateLat: location.lat,
    approximateLng: location.lng,
    date,
    startTime,
    endTime,
    payType,
    amount,
    hourlyRate: payType === 'hourly' ? hourlyRate : null,
    estHours: payType === 'hourly' ? estHours : null,
    expiresAt,
    requirements: {
      teamSize: randomInt(1, 3),
      preferredTime: randomElement(['morning', 'afternoon', 'evening', 'anytime']),
    },
    status: 'OPEN',
  };

  const job = await prisma.job.create({
    data: jobData
  });

  return job;
}

// Main function
async function generateJobs(count = 20) {
  console.log(`\n🏗️  Generating ${count} random jobs across Tennessee...\n`);

  try {
    // Get or create test customer
    const customer = await getOrCreateTestCustomer();
    
    // Generate jobs
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const job = await generateJob(customer.id, i);
      jobs.push(job);
      console.log(`✅ Created job ${i + 1}/${count}: ${job.title} (${job.category}) in ${job.lat.toFixed(4)}, ${job.lng.toFixed(4)}`);
    }

    console.log(`\n🎉 Successfully created ${jobs.length} jobs!`);
    console.log(`   Categories: ${[...new Set(jobs.map(j => j.category))].join(', ')}`);
    console.log(`   Locations: Scattered across Tennessee\n`);

  } catch (error) {
    console.error('\n❌ Error generating jobs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let count = 20;

args.forEach(arg => {
  if (arg.startsWith('--count=')) {
    count = parseInt(arg.split('=')[1], 10);
  }
});

// Run the script
generateJobs(count)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

