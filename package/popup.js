// UWH Attendance Scraper Extension
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');

  const button = document.querySelector('#scrape-button');
  const sendButton = document.querySelector('#send-api-button');
  const statusDiv = document.querySelector('#status');

  if (!button || !sendButton || !statusDiv) {
    console.error('Required elements not found:', { button, sendButton, statusDiv });
    return;
  }

  console.log('Elements found, adding event listeners');

  // Helper function to show status
  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'status-error' : 'status-success';
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  // Original scrape functionality
  button.addEventListener('click', function() {
    console.log('Download button clicked');
    showStatus('Starting scrape...');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Tab query error:', chrome.runtime.lastError);
        showStatus('Error: ' + chrome.runtime.lastError.message, true);
        return;
      }

      console.log('Executing scrape script on tab:', tabs[0].id);

      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: scrapeAttendance
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Script execution error:', chrome.runtime.lastError);
          showStatus('Error: ' + chrome.runtime.lastError.message, true);
        } else {
          alert('made it here');
          console.log('Script executed successfully:', results);
          showStatus('Data downloaded successfully!');
        }
      });
    });
  });

  // New API send functionality - move API calls to popup context
  sendButton.addEventListener('click', function() {
    console.log('Send to API button clicked');
    showStatus('Starting scrape and API send...');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Tab query error:', chrome.runtime.lastError);
        showStatus('Error: ' + chrome.runtime.lastError.message, true);
        return;
      }

      console.log('Executing scrape script on tab:', tabs[0].id);

      // First scrape the data
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: scrapeDataOnly
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Script execution error:', chrome.runtime.lastError);
          showStatus('Error: ' + chrome.runtime.lastError.message, true);
          //return;
        }
        alert(results);

        if (results && results[0] && results[0].result) {
          const meetupData = results[0].result;
          console.log('Scraped data received:', meetupData);

          // Now send to API from popup context
          sendToUWHAPI(meetupData)
            .then(result => {
              if (result.success) {
                showStatus(`✅ Success! Game ID: ${result.gameId}, Attendees: ${meetupData.attendees.length}`);
              } else {
                showStatus(`❌ API Error: ${result.error}`, true);
                // Fallback to download
                alert('p;owow');
                downloadJSON(meetupData);
              }
            })
            .catch(error => {
              console.error('API Error:', error);
              showStatus(`❌ API Error: ${error.message}`, true);
              // Fallback to download
              alert('jwooww');
              downloadJSON(meetupData);
            });
        } else {
          showStatus('No data received from scraper', true);
        }
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
    // configuration - update these values for your setup
    const api_base_url = 'http://localhost:8000/api/v1';
    const api_username = 'apitest';  // update with your username
    const api_password = 'testpass123';  // update with your password

    const auth = btoa(`${api_username}:${api_password}`);

    // Step 1: Create or find players
    /*
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
    */

    // Step 2: Create the game
    const gameData = {
      ...meetupData.apiData,
    };

    const gameResponse = await fetch(`${API_BASE_URL}/game/`, {
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
      //playersCreated: playerIds.length,
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
  alert('download JSON');
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

// New scraping function that only returns data (for API workflow)
function scrapeDataOnly() {
  console.log('Scraping UWH Meetup data (data only)...');

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
  alert(location);

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
  //const gameDateTime = parseMeetupDateTime(date);
  // Default to current date if parsing fails
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);
  endDate.setHours(now.getHours() + 2); // Default 2-hour duration

  /*
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
*/

  const gameDateTime = {
    start: startDate.toISOString().replace('T', ' ').slice(0, 19),
    end: endDate.toISOString().replace('T', ' ').slice(0, 19)
  };

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
      //attendee_names: attendeeNames,
      notes: `Scraped from Meetup: ${location} - ${date}`,
      shared_time_minutes: 0
    }
  };

  console.log('Scraped data:', meetupData);

  alert(meetupData);
  // Return data instead of downloading
  //return meetupData;
    // configuration - update these values for your setup
    const api_base_url = 'http://localhost:8000/api/v1';
    const api_username = 'apitest';  // update with your username
    const api_password = 'testpass123';  // update with your password

    const auth = btoa(`${api_username}:${api_password}`);
    const gameData = {
      ...meetupData.apiData,
    };

  alert(JSON.stringify(gameData));
  /*
    fetch(`${API_BASE_URL}/game/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gameData)
    });
  */
  alert('holdup');
}

// Helper function to parse meetup date/time (needs to be available in content script context)
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

// Original scrape function (for backward compatibility)
function scrapeAttendance() {
  console.log('Scraping UWH Meetup data...');
  console.log('HEREEEE');
  alert('Booboom');

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
    //locationHref = locationElement.href || '';
    console.log('Location found:', location);
    //console.log('Location href:', locationHref);
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
    location: location,
    date: date,
    attendees: attendeeNames,
    scrapedAt: new Date().toISOString(),
    attendeeCount: attendeeNames.length
  };

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

  // Show summary in alert
  const summary = `Successfully scraped meetup data!\\n\\nLocation: ${location || 'Not found'}\\nDate: ${date || 'Not found'}\\nAttendees: ${attendeeNames.length}\\n\\nCheck downloads for uwh_meetup_data.json`;
  alert(summary);
}
