from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from datetime import datetime
import os
import shutil
from pathlib import Path
import cv2
import numpy as np
from io import BytesIO
import mux_python
from mux_python.rest import ApiException
from dotenv import load_dotenv
import requests
import asyncio
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Speed Dating API")

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Client Host: {request.client.host}")
    logger.info(f"Headers: {dict(request.headers)}")
    try:
        response = await call_next(request)
        logger.info(f"Response Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        raise

# Configure Mux client
configuration = mux_python.Configuration()
configuration.username = os.getenv('MUX_TOKEN_ID')
configuration.password = os.getenv('MUX_TOKEN_SECRET')

# Initialize Mux API clients
assets_api = mux_python.AssetsApi(mux_python.ApiClient(configuration))
uploads_api = mux_python.DirectUploadsApi(mux_python.ApiClient(configuration))

# Configure CORS with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://early-bats-wave.loca.lt",  # Your localtunnel domain
        "http://localhost:3000",               # Local development
        "http://localhost:5173",               # Vite default port
        "https://*.loca.lt",                   # Any localtunnel domain
        "https://*.ngrok-free.app",            # Any ngrok domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Length", "Accept-Ranges", "Content-Range"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Add CORS headers to all responses
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Log CORS-related information
    logger.info("CORS Debug:", {
        "request_origin": request.headers.get("origin"),
        "request_method": request.method,
        "response_status": response.status_code,
        "cors_headers": {
            "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
            "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
            "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers"),
            "Access-Control-Allow-Credentials": response.headers.get("Access-Control-Allow-Credentials"),
        }
    })
    
    return response

@app.get("/")
async def root():
    return {
        "message": "Speed Dating API is running",
        "version": "1.0.0",
        "endpoints": {
            "GET /": "This information",
            "GET /api/videos": "List all videos",
            "GET /api/videos/{video_id}": "Get a specific video",
            "POST /api/videos/upload": "Upload a new video",
            "POST /api/videos/{video_id}/like": "Like a video",
            "POST /api/videos/{video_id}/comment": "Comment on a video"
        }
    }

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create thumbnails directory if it doesn't exist
THUMBNAIL_DIR = Path("thumbnails")
THUMBNAIL_DIR.mkdir(exist_ok=True)

# Mount the uploads directory to serve static files with custom configuration
app.mount("/uploads", StaticFiles(directory="uploads", check_dir=False), name="uploads")

# In-memory storage (replace with database in production)
videos = []

def scan_uploads_directory():
    """Scan the uploads directory and rebuild the videos list."""
    print("Scanning uploads directory...")
    try:
        for file_path in UPLOAD_DIR.glob("*"):
            if file_path.is_file() and file_path.suffix.lower() in ['.mp4', '.mov', '.quicktime']:
                video_id = file_path.name
                # Check if video is already in the list
                if not any(v["id"] == video_id for v in videos):
                    # Generate thumbnail if it doesn't exist
                    thumbnail_path = THUMBNAIL_DIR / f"{file_path.stem}_thumb.jpg"
                    if not thumbnail_path.exists():
                        thumbnail_path = generate_thumbnail(file_path)

                    # Add video to the list
                    video = {
                        "id": video_id,
                        "url": f"/api/videos/{video_id}/stream",
                        "created_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                        "likes": 0,
                        "comments": [],
                        "thumbnail": f"/api/videos/{video_id}/thumbnail" if thumbnail_path else None
                    }
                    videos.append(video)
                    print(f"Added video from uploads: {video_id}")

        print(f"Found {len(videos)} videos in uploads directory")
    except Exception as e:
        print(f"Error scanning uploads directory: {str(e)}")

# Scan uploads directory on startup
scan_uploads_directory()

def generate_thumbnail(video_path: Path) -> Path:
    """Generate a thumbnail from a video file."""
    try:
        print(f"Generating thumbnail for video: {video_path}")
        
        # Open the video file
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print(f"Failed to open video file: {video_path}")
            return None
            
        # Get the total number of frames
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames == 0:
            print(f"Video has no frames: {video_path}")
            return None
            
        # Seek to 1/3 of the video
        target_frame = max(1, total_frames // 3)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        
        # Read the frame
        success, frame = cap.read()
        if not success:
            print(f"Failed to read video frame at position {target_frame}")
            return None
            
        # Release the video capture
        cap.release()
        
        # Create thumbnail path
        thumbnail_path = THUMBNAIL_DIR / f"{video_path.stem}_thumb.jpg"
        
        # Save the frame as JPEG
        success = cv2.imwrite(str(thumbnail_path), frame)
        if not success:
            print(f"Failed to save thumbnail: {thumbnail_path}")
            return None
            
        print(f"Thumbnail generated successfully: {thumbnail_path}")
        return thumbnail_path
    except Exception as e:
        print(f"Error generating thumbnail: {str(e)}")
        return None

@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    try:
        print(f"Receiving video upload: {file.filename}")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"video_{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / filename
        
        print(f"Saving video to: {file_path}")
        
        # Save the file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Generate thumbnail
        thumbnail_path = generate_thumbnail(file_path)
        
        # Create video response
        video = {
            "id": filename,
            "url": f"/api/videos/{filename}/stream",
            "created_at": datetime.now().isoformat(),
            "likes": 0,
            "comments": [],
            "thumbnail": f"/api/videos/{filename}/thumbnail" if thumbnail_path else None
        }
        
        print(f"Video processed successfully: {video}")
        videos.append(video)
        return video
        
    except Exception as e:
        print(f"Error uploading video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/videos")
async def get_videos():
    try:
        logger.info("Fetching all videos")
        logger.info(f"Current videos in memory: {len(videos)}")
        
        # Rescan uploads directory to ensure we have all videos
        scan_uploads_directory()
        
        logger.info(f"Videos after scan: {len(videos)}")
        logger.info(f"Video IDs: {[v['id'] for v in videos]}")
        
        return videos
    except Exception as e:
        logger.error(f"Error in get_videos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/videos/{video_id}/thumbnail")
async def get_video_thumbnail(video_id: str):
    try:
        # Find the video
        video_path = UPLOAD_DIR / video_id
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video not found")
            
        # Check if thumbnail exists
        thumbnail_path = THUMBNAIL_DIR / f"{video_path.stem}_thumb.jpg"
        if not thumbnail_path.exists():
            # Generate thumbnail if it doesn't exist
            thumbnail_path = generate_thumbnail(video_path)
            if not thumbnail_path:
                raise HTTPException(status_code=500, detail="Failed to generate thumbnail")
        
        return FileResponse(thumbnail_path, media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error serving thumbnail: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/videos/{video_id}")
async def get_video(video_id: str):
    try:
        print(f"Fetching video: {video_id}")
        video = next((v for v in videos if v["id"] == video_id), None)
        if not video:
            print(f"Video not found in database: {video_id}")
            raise HTTPException(status_code=404, detail="Video not found")
            
        # Check if video file exists
        video_path = UPLOAD_DIR / video_id
        if not video_path.exists():
            print(f"Video file not found at path: {video_path}")
            raise HTTPException(status_code=404, detail="Video file not found")
            
        print(f"Video found: {video}")
        return video
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/videos/{video_id}/stream")
async def stream_video(video_id: str, request: Request):
    try:
        video_path = UPLOAD_DIR / video_id
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video not found")

        # Get file size
        file_size = video_path.stat().st_size

        # Handle range requests
        range_header = request.headers.get("range")
        
        if range_header:
            start_str, end_str = range_header.replace("bytes=", "").split("-")
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
            content_length = end - start + 1

            # Create video stream
            async def video_stream():
                with open(video_path, "rb") as video:
                    video.seek(start)
                    data = video.read(content_length)
                    yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": "video/mp4",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache",
            }

            return StreamingResponse(
                video_stream(),
                status_code=206,
                headers=headers
            )
        else:
            # Return the entire file
            return FileResponse(
                video_path,
                media_type="video/mp4",
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(file_size),
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache",
                }
            )

    except Exception as e:
        print(f"Error streaming video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/videos/{video_id}/like")
async def like_video(video_id: str):
    video = next((v for v in videos if v["id"] == video_id), None)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video["likes"] += 1
    return {"likes": video["likes"]}

@app.post("/api/videos/{video_id}/comment")
async def add_comment(video_id: str, comment: dict):
    video = next((v for v in videos if v["id"] == video_id), None)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video["comments"].append(comment["text"])
    return {"comments": video["comments"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 