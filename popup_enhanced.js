  const button = document.querySelector('#scrape-button');
  const sendButton = document.querySelector('#send-api-button');
  const statusDiv = document.querySelector('#status');

  // Original scrape functionality
  button.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: scrapeAttendance
      });
    });
  });

  // New API send functionality
  sendButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: scrapeAndSendToAPI
      });
    });
  });
});

// Enhanced scraping function that sends to API
function scrapeAndSendToAPI() {
  console.log('Scraping UWH Meetup data for API...');

  const attendeeNames = [];
  let location = '';
  let locationHref = '';
  let date = '';

  // Extract attendee names
  const nameElements = document.querySelectorAll("button[data-event-label='attendee-card'] p");
  nameElements.forEach(nameElement => {
    const name = nameElement.textContent.trim();
    if (name) {
      attendeeNames.push(name);
    }
  });

  // Extract location information
  const locationElement = document.querySelector('main a');
  if (locationElement) {
    location = locationElement.textContent.trim();
    locationHref = locationElement.href || '';
  }

  // Extract date information
  const dateElement = document.querySelector('main div.pt-px');
  if (dateElement) {
    date = dateElement.textContent.trim();
  }

  // Parse location to determine pool
  const poolMapping = {
    'carmody': 1,  // Carmody Recreation Center
    'vmac': 2,     // VMAC
    'epic': 3      // EPIC
  };

  let poolId = 1; // Default to Carmody
  const locationLower = location.toLowerCase();
  for (const [key, value] of Object.entries(poolMapping)) {
    if (locationLower.includes(key)) {
      poolId = value;
      break;
    }
  }

  // Parse date and time
  const gameDateTime = parseMeetupDateTime(date);

  // Create comprehensive data object
  const meetupData = {
    location: {
      text: location,
      href: locationHref
    },
    date: date,
    attendees: attendeeNames,
    scrapedAt: new Date().toISOString(),
    attendeeCount: attendeeNames.length,

    // API-ready data
    apiData: {
      pool: poolId,
      starttime: gameDateTime.start,
      endtime: gameDateTime.end,
      attendee_names: attendeeNames,
      notes: `Scraped from Meetup: ${location} - ${date}`,
      shared_time_minutes: 0
    }
  };

  console.log('Scraped data:', meetupData);

  // Send to API
  sendToUWHAPI(meetupData)
    .then(result => {
      if (result.success) {
        alert(`✅ Successfully sent to API!\\n\\nGame ID: ${result.gameId}\\nAttendees: ${attendeeNames.length}\\nLocation: ${location}`);
      } else {
        alert(`❌ Failed to send to API: ${result.error}\\n\\nFalling back to download...`);
        downloadJSON(meetupData);
      }
    })
    .catch(error => {
      console.error('API Error:', error);
      alert(`❌ API Error: ${error.message}\\n\\nFalling back to download...`);
      downloadJSON(meetupData);
    });
}

// Function to send data to UWH API
async function sendToUWHAPI(meetupData) {
  try {
    // Configuration - Update these values for your setup
    const API_BASE_URL = 'http://localhost:8000/api/v1';
    const API_USERNAME = 'apitest';  // Update with your username
    const API_PASSWORD = 'testpass123';  // Update with your password

    const auth = btoa(`${API_USERNAME}:${API_PASSWORD}`);

    // Step 1: Create or find players
    const playerIds = [];
    for (const attendeeName of meetupData.attendees) {
      try {
        const playerId = await createOrFindPlayer(attendeeName, auth);
        if (playerId) {
          playerIds.push(playerId);
        }
      } catch (error) {
        console.warn(`Could not create/find player ${attendeeName}:`, error);
      }
    }

    // Step 2: Create the game
    const gameData = {
      ...meetupData.apiData,
      attendees: playerIds
    };

    const gameResponse = await fetch(`${API_BASE_URL}/games/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gameData)
    });

    if (!gameResponse.ok) {
      const errorData = await gameResponse.text();
      throw new Error(`Game creation failed: ${gameResponse.status} - ${errorData}`);
    }

    const gameResult = await gameResponse.json();

    return {
      success: true,
      gameId: gameResult.id,
      playersCreated: playerIds.length,
      message: 'Game and attendees successfully created'
    };

  } catch (error) {
    console.error('API Integration Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to create or find a player
async function createOrFindPlayer(attendeeName, auth) {
  const API_BASE_URL = 'http://localhost:8000/api/v1';

  try {
    // First, search for existing players
    const searchResponse = await fetch(`${API_BASE_URL}/players/?search=${encodeURIComponent(attendeeName)}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.results && searchData.results.length > 0) {
        // Found existing player
        return searchData.results[0].id;
      }
    }

    // Player not found, create new user and player
    const [firstName, ...lastNameParts] = attendeeName.split(' ');
    const lastName = lastNameParts.join(' ') || 'Unknown';
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/[^a-z0-9]/g, '');

    // Create user first
    const userData = {
      username: username,
      first_name: firstName,
      last_name: lastName,
      email: `${username}@meetup.temp`
    };

    const userResponse = await fetch(`${API_BASE_URL}/users/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    if (!userResponse.ok) {
      // User might already exist, try to find them
      console.log(`Could not create user ${username}, might already exist`);
      return null;
    }

    const userResult = await userResponse.json();

    // Create player
    const playerData = {
      user_id: userResult.id,
      initial_balance: 0,
      initial_num_games: 0,
      notes: `Created from meetup scraper: ${new Date().toISOString()}`
    };

    const playerResponse = await fetch(`${API_BASE_URL}/players/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(playerData)
    });

    if (playerResponse.ok) {
      const playerResult = await playerResponse.json();
      return playerResult.id;
    }

  } catch (error) {
    console.warn(`Error creating/finding player ${attendeeName}:`, error);
  }

  return null;
}

// Helper function to parse meetup date/time
function parseMeetupDateTime(dateString) {
  // Default to current date if parsing fails
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);
  endDate.setHours(now.getHours() + 2); // Default 2-hour duration

  try {
    // Try to parse various date formats from Meetup
    // Examples: "Friday, August 25, 2025 at 7:00 PM"
    //          "Aug 25, 2025 · 7:00 PM"

    // Extract time if present
    const timeMatch = dateString.match(/(\\d{1,2}):(\\d{2})\\s*(PM|AM)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toUpperCase();

      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      startDate.setHours(hours, minutes, 0, 0);
      endDate.setHours(hours + 2, minutes, 0, 0); // 2-hour duration
    }

    // You can add more sophisticated date parsing here

  } catch (error) {
    console.warn('Could not parse date:', dateString, error);
  }

  return {
    start: startDate.toISOString().replace('T', ' ').slice(0, 19),
    end: endDate.toISOString().replace('T', ' ').slice(0, 19)
  };
}

// Fallback: Download JSON (original functionality)
function downloadJSON(meetupData) {
  const dataStr = JSON.stringify(meetupData, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'uwh_meetup_data.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Original scrape function (for backward compatibility)
function scrapeAttendance() {
  console.log('Scraping UWH Meetup data...');

  const attendeeNames = [];
  let location = '';
  let locationHref = '';
  let date = '';

  // Extract attendee names (existing functionality)
  const nameElements = document.querySelectorAll("button[data-event-label='attendee-card'] p");
  nameElements.forEach(nameElement => {
    const name = nameElement.textContent.trim();
    if (name) {
      attendeeNames.push(name);
    }
  });

  // Extract location information
  const locationElement = document.querySelector('main a');
  if (locationElement) {
    location = locationElement.textContent.trim();
    locationHref = locationElement.href || '';
    console.log('Location found:', location);
    console.log('Location href:', locationHref);
  } else {
    console.log('Location element not found');
  }

  // Extract date information
  const dateElement = document.querySelector('main div.pt-px');
  if (dateElement) {
    date = dateElement.textContent.trim();
    console.log('Date found:', date);
  } else {
    console.log('Date element not found');
  }

  console.log('\\nAttendees:');
  if (attendeeNames.length > 0) {
    attendeeNames.forEach(name => {
      console.log(name);
    });
  } else {
    console.log('No attendees found or scraped.');
  }

  // Create comprehensive data object
  const meetupData = {
    location: {
      text: location,
      href: locationHref
    },
    date: date,
    attendees: attendeeNames,
    scrapedAt: new Date().toISOString(),
    attendeeCount: attendeeNames.length
  };

  downloadJSON(meetupData);

  // Show summary in alert
  const summary = `Successfully scraped meetup data!\\n\\nLocation: ${location || 'Not found'}\\nDate: ${date || 'Not found'}\\nAttendees: ${attendeeNames.length}\\n\\nCheck downloads for uwh_meetup_data.json`;
  alert(summary);
}
