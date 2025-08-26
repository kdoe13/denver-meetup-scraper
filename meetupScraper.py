from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import time # For waits

# --- Configuration ---
MEETUP_URL = "https://www.meetup.com/login" # Or the event page if you can access it directly
USERNAME = "kdoe13@gmail.com"
PASSWORD = "cuRzuP68MWP44!oI"
EVENT_URL = "https://www.meetup.com/denver-underwater-hockey/events/308756369/" # Replace with your event URL

options = Options()
user_data_dir = "/Users/kdoege/Library/Application Support/Google/Chrome/Default"
options.add_argument(f"--user-data-dir={user_data_dir}")
# --- Initialize WebDriver ---
# For Chrome:
driver = webdriver.Chrome(options=options)
# For Firefox:
# driver = webdriver.Firefox()

try:
    # 3. Navigate to the specific event page
    driver.get(EVENT_URL)
    time.sleep(5)

    # Wait for the event page to load and attendees list to be visible
   # WebDriverWait(driver, 15).until(
   #     EC.presence_of_element_located((By.CLASS_NAME, "list-of-attendees-class")) # Replace with an actual class name for the attendee list container
   # )

    # 4. (Optional) Click buttons to expand the attendee list if it's paginated or hidden
    # Example: Find a "See all attendees" button and click it
    try:
        see_all_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[@id:'attendees-btn']"))
        )
        see_all_button.click()
        time.sleep(2) # Give it a moment to load after clicking
    except:
        print("No 'See all attendees' button found or needed.")

    try:
        see_all_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'continue with free plan']"))
        )
        see_all_button.click()
        time.sleep(2) # Give it a moment to load after clicking
    except:
        print("No 'continue with free plan' button found or needed.")

    # 5. Get the HTML of the page (or just the relevant section)
    page_source = driver.page_source

    # 6. Parse the HTML with BeautifulSoup
    soup = BeautifulSoup(page_source, 'html.parser')

    # 7. Scrape the names
    # You'll need to inspect the HTML of the Meetup event page to find the correct CSS selectors or tags
    # for attendee names. Look for common tags like <div>, <span>, <a> with specific classes.
    attendee_names = []
    # Example: if names are in <span> tags with class "member-name" inside a list item
    for name_element in soup.select("button[data-event-label='attendee-card'] p"): # Adjust selectors
        name = name_element.get_text(strip=True)
        if name:
            attendee_names.append(name)

    print("\nAttendees:")
    if attendee_names:
        for name in attendee_names:
            print(name)
    else:
        print("No attendees found or scraped.")

except Exception as e:
    print(f"An error occurred: {e}")

finally:
    # Close the browser
    driver.quit()
