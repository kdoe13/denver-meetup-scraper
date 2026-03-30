# 🔗 UWH Meetup Scraper → Django API Integration Guide

## 🎯 **What This Does**

Your Chrome extension can now automatically:

1. **Scrape meetup attendees** from the Meetup.com page
2. **Parse location and date** information  
3. **Create missing players** in your Django system
4. **Create a new game** with all attendees
5. **Send everything to your UWH API** seamlessly

---

## 🚀 **Quick Setup**

### **Step 1: Replace Your Files**

Replace your existing extension files with the enhanced versions:

```bash
# In your denver-meetup-scraper directory:
cp popup_enhanced.html popup.html
cp popup_enhanced.js popup.js  
cp manifest_enhanced.json manifest.json
```

### **Step 2: Configure API Credentials**

Edit `popup.js` and update these lines (around line 110):

```javascript
// Configuration - Update these values for your setup
const API_BASE_URL = 'http://localhost:8000/api/v1';  // Your API URL
const API_USERNAME = 'apitest';                        // Your API username  
const API_PASSWORD = 'testpass123';                    // Your API password
```

### **Step 3: Reload Extension**

1. Go to `chrome://extensions/`
2. Find "UWH Attendance Scraper" 
3. Click the **reload** button 🔄

### **Step 4: Test It!**

1. Go to a UWH Meetup page
2. Click the extension icon
3. Click **"🚀 Send to API"**
4. Watch it automatically create everything!

---

## 🏗️ **How It Works**

### **Data Flow:**
```
Meetup Page → Chrome Extension → Your Django API → Database
```

### **What Gets Created:**

1. **Users & Players**: 
   - Automatically creates Django User accounts for new attendees
   - Creates corresponding Player records with initial balances of $0

2. **Game Record**:
   - Maps location text to pool IDs (Carmody=1, VMAC=2, EPIC=3)
   - Parses dates and times from meetup text
   - Creates game with 2-hour default duration
   - Links all attendees to the game

3. **Fallback Behavior**:
   - If API fails, falls back to JSON download (original functionality)
   - Shows clear error messages with details

---

## 📊 **Location Mapping**

The extension automatically maps meetup locations to pool IDs:

| Meetup Location Contains | Pool ID | Pool Name |
|-------------------------|---------|-----------|
| "carmody"               | 1       | Carmody   |
| "vmac"                  | 2       | VMAC      |
| "epic"                  | 3       | EPIC      |
| *anything else*         | 1       | Carmody (default) |

---

## ⚙️ **API Endpoints Used**

Your extension will call these API endpoints:

```bash
# Search for existing players
GET /api/v1/players/?search=John+Doe

# Create new user (if needed)
POST /api/v1/users/
{
  "username": "johndoe",
  "first_name": "John", 
  "last_name": "Doe",
  "email": "johndoe@meetup.temp"
}

# Create new player (if needed)  
POST /api/v1/players/
{
  "user_id": 123,
  "initial_balance": 0,
  "initial_num_games": 0,
  "notes": "Created from meetup scraper: 2025-08-26T00:39:54.000Z"
}

# Create the game
POST /api/v1/games/
{
  "pool": 1,
  "starttime": "2025-08-26 19:00:00",
  "endtime": "2025-08-26 21:00:00", 
  "attendees": [1, 2, 3, 4],
  "notes": "Scraped from Meetup: Carmody Recreation Center - Monday, August 26",
  "shared_time_minutes": 0
}
```

---

## 🎨 **New Extension Interface**

Your extension popup now has two options:

### **🚀 Send to API** (NEW)
- Scrapes data and sends directly to your Django API
- Creates users, players, and games automatically
- Shows success/error messages with details
- Falls back to JSON download if API fails

### **💾 Download JSON** (Original)  
- Downloads scraped data as JSON file
- Same as your original functionality
- Useful for backup or manual processing

---

## 🔧 **Troubleshooting**

### **Common Issues & Solutions:**

#### **❌ "Authentication credentials were not provided"**
- **Fix**: Update `API_USERNAME` and `API_PASSWORD` in popup.js
- **Test**: Try the API in browser first: `http://localhost:8000/api/v1/`

#### **❌ "CORS policy" error**  
- **Fix**: Make sure your Django API allows requests from chrome-extension://
- **Temporary Fix**: Use localhost API URL, not 127.0.0.1

#### **❌ "User already exists" errors**
- **Normal**: Extension handles this gracefully and finds existing users
- **Fix**: No action needed - this is expected behavior

#### **❌ Date parsing issues**
- **Fix**: Check console logs for date parsing warnings
- **Manual**: Edit `parseMeetupDateTime()` function for your date format

### **Testing Steps:**

1. **Test API manually first:**
   ```bash
   curl -u apitest:testpass123 http://localhost:8000/api/v1/players/
   ```

2. **Check browser console:**
   - Open Developer Tools (F12)
   - Look for error messages in Console tab
   - Check Network tab for failed requests

3. **Verify database:**
   - Check if users/players were created: http://localhost:8000/admin/
   - Look at games list to see if data was saved

---

## 🎯 **Example Workflow**

### **Before (Manual Process):**
1. Visit meetup page
2. Click extension → Download JSON
3. Manually process JSON file
4. Manually create game in admin
5. Manually add players to game

### **After (Automated):**
1. Visit meetup page  
2. Click extension → **Send to API**
3. ✅ **Done!** Everything created automatically

---

## 🔮 **Future Enhancements**

You can easily extend this integration:

### **Add More Data Fields:**
- Extract meetup event descriptions
- Capture RSVP timestamps
- Parse skill level or team info

### **Smart Player Matching:**
- Match by email instead of just name
- Handle nickname variations
- Link to existing Django User accounts

### **Bulk Operations:**
- Process multiple meetups at once
- Update existing games instead of creating new ones
- Sync with meetup API directly

### **Enhanced Error Handling:**
- Retry failed API calls
- Queue operations for offline processing
- Validate data before sending

---

## 📋 **Configuration Reference**

### **Key Settings in `popup.js`:**

```javascript
// API Configuration
const API_BASE_URL = 'http://localhost:8000/api/v1';
const API_USERNAME = 'your_username';
const API_PASSWORD = 'your_password';

// Pool Mapping
const poolMapping = {
  'carmody': 1,  
  'vmac': 2,     
  'epic': 3      
};

// Game Duration (default 2 hours)
endDate.setHours(hours + 2, minutes, 0, 0);
```

### **Customize for Your Needs:**
- Change pool IDs to match your database
- Adjust game duration defaults
- Modify location parsing logic
- Add custom attendee processing

---

## ✅ **You're Ready!**

Your meetup scraper now has **full API integration** with your Django UWH system!

**No more manual data entry** - just scrape and go! 🚀

The extension will handle user creation, player management, and game setup automatically while providing clear feedback on what's happening behind the scenes.
