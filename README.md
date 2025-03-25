# Speed Dating Video App

A TikTok-style video speed dating web application that allows users to record and watch introduction videos.

## Features

- Video recording with 45-second limit
- Guided questions for video introductions:
  - What's your favorite Disney character?
  - If you could instantly master one new skill, what would it be and why?
  - What's your favorite way to spend a free afternoon?
- TikTok-style video playback
- Like and comment functionality
- Mobile-first responsive design
- WebView compatibility for native apps

## Prerequisites

Before running the application, make sure you have the following installed:

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Python 3.8 or higher
- pip3 (comes with Python)
- uvicorn (`pip3 install uvicorn`)
- ngrok (`brew install ngrok` or download from https://ngrok.com)
- localtunnel (`npm install -g localtunnel`)

## Manual Setup

### 1. Backend Setup

1. Navigate to the backend directory:
```bash
cd WebService/backend
```

2. Install Python dependencies:
```bash
pip3 install -r requirements.txt
```

3. Start the backend server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be running at http://localhost:8000

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
```bash
cd WebService/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the frontend development server:
```bash
npm start
```

The frontend will be running at http://localhost:3000

### 3. Setup Tunneling Services

You'll need to run both ngrok (for backend) and localtunnel (for frontend) to make the services accessible externally.

#### Start ngrok for Backend

1. Open a new terminal and start ngrok for the backend:
```bash
ngrok http 8000
```

2. Copy the HTTPS URL provided by ngrok (e.g., https://xxxx-xx-xx-xxx-xx.ngrok-free.app)

#### Start localtunnel for Frontend

1. Open a new terminal and start localtunnel for the frontend:
```bash
lt --port 3000
```

2. Copy the URL provided by localtunnel (e.g., https://something.loca.lt)

### 4. Update Configuration

1. Update the frontend API configuration:
   - Open `WebService/frontend/src/api/config.ts`
   - Update the API_BASE_URL with your ngrok URL:
     ```typescript
     export const API_BASE_URL = 'https://your-ngrok-url.ngrok-free.app';
     ```
   - Update any Origin headers with your localtunnel URL:
     ```typescript
     config.headers['Origin'] = 'https://your-frontend-url.loca.lt';
     ```

2. Update the backend CORS configuration:
   - Open `WebService/backend/main.py`
   - Replace any existing localtunnel URLs with your new one:
     ```python
     origins = [
         "https://your-frontend-url.loca.lt",  # Replace existing .loca.lt URLs
         "https://your-ngrok-url.ngrok-free.app",  # Replace existing ngrok URLs
         "http://localhost:3000"
     ]
     ```

3. Update iOS WebAppURL:
   - Find all Swift files containing webAppURL or URL configurations:
     ```bash
     find . -type f -name "*.swift" -exec grep -l "webAppURL\|loca.lt\|ngrok" {} \;
     ```
   - In each file found, update the webAppURL to your new localtunnel URL:
     ```swift
     // Replace any existing URLs like "https://early-bats-wave.loca.lt"
     let webAppURL = "https://your-frontend-url.loca.lt"
     ```
   - Common files to check:
     - `SpeedDatingCodingChallenge/ViewController.swift`
     - `SpeedDatingCodingChallenge/WebViewConfig.swift`
     - Any other files that contain URL configurations

4. Verify URL Updates:
   - Search for any remaining old URLs:
     ```bash
     grep -r "early-bats-wave\|ngrok-free\|loca.lt" .
     ```
   - Make sure all URLs have been updated to your new ones

### 5. Verify Setup

1. Open your frontend localtunnel URL in a browser
2. Try recording a video
3. Verify that videos can be played back
4. Check that all API calls are working through the ngrok URL

## iOS App Setup

### Prerequisites
- Xcode 14.0 or later
- iOS 15.0+ deployment target
- macOS Monterey (12.0) or later

### Building and Running the iOS App

1. Open the Xcode project:
```bash
open SpeedDatingCodingChallenge.xcodeproj
```

2. Update WebApp URL Configuration:
   - Open `SpeedDatingCodingChallenge/ViewController.swift`
   - Update the webAppURL to your new localtunnel frontend URL:
     ```swift
     let webAppURL = "https://your-frontend-url.loca.lt"  // Replace with your localtunnel URL
     ```
   - Make sure to replace any other occurrences of old URLs (like early-bats-wave.loca.lt)

3. Select Target and Device:
   - Choose "SpeedDatingCodingChallenge" from the scheme menu
   - Select an iOS Simulator or connected device
   - Ensure the deployment target matches your device's iOS version

4. Build and Run:
   - Press Cmd + B to build the project
   - Press Cmd + R to run the app
   - Or use the Play button in Xcode's toolbar

### Troubleshooting iOS Build

1. If build fails:
   - Clean the build folder (Cmd + Shift + K)
   - Clean the build cache (Cmd + Shift + Alt + K)
   - Rebuild the project

2. If WebView fails to load:
   - Verify your localtunnel URL is accessible
   - Check the URL is correctly updated in all Swift files
   - Ensure App Transport Security settings allow your URLs

3. If app crashes:
   - Check Xcode console for error messages
   - Verify all WebView configurations are correct
   - Ensure the frontend service is running and accessible

4. Common WebView issues:
   - Enable debug logging in WebKit preferences
   - Check for CORS issues in the frontend console
   - Verify SSL certificates for your tunneled URLs

## Important URLs to Save

After setup, you'll have these URLs:
1. Frontend (Local): http://localhost:3000
2. Frontend (Public): Your localtunnel URL
3. Backend API (Local): http://localhost:8000
4. Backend API (Public): Your ngrok URL

## Troubleshooting

1. If ngrok fails to start:
   - Check if ngrok is authenticated with `ngrok authtoken YOUR_TOKEN`
   - Ensure port 8000 is not in use

2. If localtunnel fails:
   - Try restarting the service
   - Ensure port 3000 is not in use

3. If CORS errors occur:
   - Verify all URLs are correctly updated in both frontend and backend configs
   - Check that the protocols match (https:// vs http://)

4. If videos don't load:
   - Check the browser console for API errors
   - Verify the ngrok tunnel is active
   - Ensure the backend server is running

## Architecture

The application is built with:
- Frontend: React + TypeScript
- Backend: Python + FastAPI
- Video Processing: Native browser APIs
- WebView Integration: iOS SDK

## Limitations

- Video upload size is limited to 100MB
- Video playback requires a stable internet connection
- Some features may not work in older browsers

## Future Enhancements

1. Video Features
   - Video filters and effects
   - Background music options
   - Custom stickers and emojis

2. User Experience
   - Offline video caching
   - Video compression
   - Progressive loading

3. Matching System
   - AI-powered matching algorithm
   - Interest-based video recommendations
   - Location-based matching

4. Security
   - End-to-end encryption
   - Content moderation
   - Report system

TCA Architecture and general refactoring / clean up.