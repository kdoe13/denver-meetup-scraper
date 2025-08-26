import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options
import time
import ssl
import urllib.request
import os

# Fix SSL certificate verification for macOS
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Set environment variable to use system certificates
os.environ['SSL_CERT_FILE'] = '/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/site-packages/certifi/cacert.pem'

# 1. Initialize ChromeOptions
options = Options()

# 2. Specify the user data directory and profile directory
# IMPORTANT: Replace the path with your actual Chrome User Data Directory
# Use raw strings (r"...") for Windows paths to avoid issues with backslashes
user_data_dir = "/Users/kdoege/Library/Application Support/Google/Chrome"

options.add_argument(f"--user-data-dir={user_data_dir}")


# Optional: Add any other desired Chrome options
# For example, to run in headless mode (no visible browser UI)
# options.add_argument("--headless")
# options.add_argument("--disable-gpu") # Recommended for headless mode

# 3. Use ChromeDriverManager to get the correct chromedriver path
# and pass the options to the Chrome driver
try:
    # Initialize with version_main to avoid some SSL issues
    driver = uc.Chrome(options=options, version_main=None)

    print(f"Current URL: {driver.current_url}")

    # Keep the browser open for a few seconds to observe
    time.sleep(15)

except Exception as e:
    print(f"An error occurred: {e}")

finally:
    # Close the browser when done
    if 'driver' in locals() and driver: # Check if driver was successfully initialized
        driver.quit()
