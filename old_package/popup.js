// UWH Attendance Scraper Extension
document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('button');
  
  button.addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Execute content script to scrape the page
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: scrapeAttendance
      });
    });
  });
});

// Function that will be injected into the page to scrape attendance data
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
  
  console.log('\nAttendees:');
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
  
  // Download the data as JSON
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
  const summary = `Successfully scraped meetup data!\n\nLocation: ${location || 'Not found'}\nDate: ${date || 'Not found'}\nAttendees: ${attendeeNames.length}\n\nCheck downloads for uwh_meetup_data.json`;
  alert(summary);
}
