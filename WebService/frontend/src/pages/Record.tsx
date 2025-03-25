import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Videocam, Stop, PlayArrow, Check } from '@mui/icons-material';
import { useReactMediaRecorder } from 'react-media-recorder';
import api, { API_BASE_URL } from '../api/config';
import axios from 'axios';

declare global {
  interface Window {
    ReactIsReady?: boolean;
    listeners?: Record<string, any>;
    _videoUrl?: string;
    _hasVideo?: boolean;
    _videoBlob?: Blob;
    reactState?: Record<string, any>;
    webkit?: {
      messageHandlers: {
        videoRecorder?: {
          postMessage: (message: any) => void;
        };
        logger?: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
}

// Initialize React ready state
if (typeof window !== 'undefined') {
  window.ReactIsReady = false;
}

const Record: React.FC = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [isNativeRecording, setIsNativeRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  const {
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    previewStream,
  } = useReactMediaRecorder({
    video: true,
    audio: true,
    onStop: async (blobUrl) => {
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoBlob(blob);
        setVideoFileName(`web_video_${Date.now()}.mp4`);
        setVideoUrl(url);
        setHasVideo(true);
      } catch (error) {
        console.error('Error processing web recording:', error);
      }
    },
  });

  // Single useEffect for all event listeners and initialization
  useEffect(() => {
    console.log('React: Component mounted, setting ready state');
    
    // Set initial state
    window.ReactIsReady = true;
    if (!window.listeners) {
      window.listeners = {};
    }
    console.log('React: Ready state initialized:', window.ReactIsReady);

    const handleVideoRecorded = (event: CustomEvent) => {
      console.log('React: Received video event');
      const { videoData, fileName, mimeType } = event.detail;
      console.log('React: Processing video with filename:', fileName, 'mimeType:', mimeType);
      
      try {
        // Clean up any existing video state
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
        setVideoBlob(null);
        setVideoFileName('');
        setVideoUrl(null);
        window._videoUrl = undefined;
        window._hasVideo = false;
        window._videoBlob = undefined;
        
        // Process the new video
        console.log('React: Converting base64 to blob, data length:', videoData.length);
        const base64Data = videoData.includes('base64,') ? videoData.split('base64,')[1] : videoData;
        const blob = base64ToBlob(base64Data, mimeType || 'video/quicktime');
        console.log('React: Created blob:', { size: blob.size, type: blob.type });
        
        // Create blob URL
        const url = URL.createObjectURL(blob);
        console.log('React: Created blob URL:', url);
        
        // Update state
        setVideoBlob(blob);
        setVideoFileName(fileName || `ios_video_${Date.now()}.mov`);
        setVideoUrl(url);
        setHasVideo(true);
        setIsNativeRecording(false);
        setIsRecording(false);
        
        // Update global state for debugging
        window._videoBlob = blob;
        window._videoUrl = url;
        window._hasVideo = true;
        window.reactState = { hasVideo: true, fileName, blobSize: blob.size };
        
        // Update video element if available
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.load();
        }
      } catch (error) {
        console.error('React Error: Failed to process video:', error);
        setIsNativeRecording(false);
        setIsRecording(false);
        setHasVideo(false);
      }
    };

    const handleStopRecording = () => {
      console.log('React: Native recording stopped');
      setIsNativeRecording(false);
      setIsRecording(false);
    };

    const handleRecordingCancelled = () => {
      console.log('React: Native recording cancelled');
      setIsNativeRecording(false);
      setIsRecording(false);
      setHasVideo(false);
      setVideoBlob(null);
      setVideoFileName('');
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
    };

    // Track event listener registration
    window.listeners.videoRecorded = handleVideoRecorded;
    window.listeners.stopVideoRecording = handleStopRecording;
    window.listeners.recordingCancelled = handleRecordingCancelled;
    
    // Register event listeners
    window.addEventListener('videoRecorded', handleVideoRecorded as EventListener);
    window.addEventListener('stopVideoRecording', handleStopRecording as EventListener);
    window.addEventListener('recordingCancelled', handleRecordingCancelled as EventListener);
    
    console.log('React: Event listeners registered for native recording');

    // Cleanup function
    return () => {
      console.log('React: Cleaning up event listeners');
      window.removeEventListener('videoRecorded', handleVideoRecorded as EventListener);
      window.removeEventListener('stopVideoRecording', handleStopRecording as EventListener);
      window.removeEventListener('recordingCancelled', handleRecordingCancelled as EventListener);
      if (window.listeners) {
        delete window.listeners.videoRecorded;
        delete window.listeners.stopVideoRecording;
        delete window.listeners.recordingCancelled;
      }
      window.ReactIsReady = false;
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]); // Only depend on videoUrl for cleanup

  const handleStartRecording = () => {
    console.log('React: Starting recording');
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.videoRecorder) {
      console.log('React: Using native iOS recording');
      try {
        window.webkit.messageHandlers.videoRecorder.postMessage({ action: 'startRecording' });
        setIsNativeRecording(true);
        setIsRecording(true);
      } catch (error) {
        console.error('React Error: Failed to start native recording:', error);
      }
    } else {
      console.log('React: Native recording not available');
      // Do not fall back to web recording
      alert('Video recording is only available in the iOS app');
    }
  };

  const handleStopRecording = () => {
    console.log('React: Stopping recording');
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.videoRecorder) {
      console.log('React: Stopping native iOS recording');
      window.webkit.messageHandlers.videoRecorder.postMessage({ action: 'stopRecording' });
    } else {
      console.log('React: Stopping web recording');
      stopRecording();
    }
    // Don't set states here - they will be set by the event listeners
  };

  const handleSubmit = async () => {
    console.log('React: Submit button clicked', {
      hasVideoBlob: !!videoBlob,
      videoFileName,
      hasVideo,
      isRecording,
      isNativeRecording,
      timestamp: new Date().toISOString()
    });

    if (!videoBlob || !videoFileName) {
      console.error('React Error: Missing video data for submission', {
        hasBlob: !!videoBlob,
        hasFileName: !!videoFileName,
        globalHasVideo: window._hasVideo,
        globalBlob: !!window._videoBlob,
        reactState: window.reactState
      });
      return;
    }

    try {
      console.log('React: Creating FormData for upload');
      const formData = new FormData();
      
      // Create a new blob with the correct MIME type
      const videoFile = new Blob([videoBlob], { type: 'video/mp4' });
      formData.append('file', videoFile, videoFileName);

      console.log('React: FormData contents:', {
        hasFile: formData.has('file'),
        fileName: videoFileName,
        blobSize: videoBlob.size,
        blobType: videoBlob.type
      });

      console.log('React: Starting video upload to:', `${API_BASE_URL}/api/videos/upload`);
      const result = await api.post('/api/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
          console.log('React: Upload progress:', {
            percent: percentCompleted,
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            timestamp: new Date().toISOString()
          });
        },
      });

      console.log('React: Upload successful:', result.data);
      navigate(`/watch/${result.data.id}`);
    } catch (error: any) {
      console.error('React Error: Error uploading video:', {
        error,
        message: error.message,
        config: error.config,
        response: error.response,
        timestamp: new Date().toISOString()
      });
      // Add user-friendly error handling here if needed
    }
  };

  // Set up preview stream
  React.useEffect(() => {
    if (previewStream && previewRef.current) {
      previewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    console.log('React: Starting base64 to blob conversion', {
      inputLength: base64.length,
      mimeType,
      hasPrefix: base64.includes('base64,'),
      timestamp: new Date().toISOString()
    });

    try {
      // Remove data URL prefix if present
      const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
      console.log('React: Processed base64 data', {
        originalLength: base64.length,
        processedLength: base64Data.length,
        timestamp: new Date().toISOString()
      });
      
      const byteCharacters = atob(base64Data);
      console.log('React: Decoded base64 to bytes', {
        byteLength: byteCharacters.length,
        timestamp: new Date().toISOString()
      });
      
      const byteArrays = [];
      const sliceSize = 512;
      
      for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: mimeType });
      console.log('React: Blob created successfully', {
        size: blob.size,
        type: blob.type,
        arrayCount: byteArrays.length,
        timestamp: new Date().toISOString()
      });
      
      return blob;
    } catch (error) {
      console.error('React Error: Failed to convert base64 to blob:', error);
      throw error;
    }
  };

  // Add debug logging for render conditions
  const submitButtonVisible = hasVideo && !isRecording && !isNativeRecording;
  console.log('React: Render state', {
    hasVideo,
    isRecording,
    isNativeRecording,
    submitButtonVisible,
    videoUrl: !!videoUrl,
    videoBlob: !!videoBlob,
    videoFileName: !!videoFileName,
    timestamp: new Date().toISOString()
  });

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          py: 4,
        }}
      >
        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Record Your Introduction
          </Typography>
          <Typography variant="body1" paragraph>
            Please answer these questions in your video (max 45 seconds):
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Videocam color="primary" />
              </ListItemIcon>
              <ListItemText primary="What's your favorite Disney character?" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Videocam color="primary" />
              </ListItemIcon>
              <ListItemText primary="If you could instantly master one new skill, what would it be and why?" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Videocam color="primary" />
              </ListItemIcon>
              <ListItemText primary="What's your favorite way to spend a free afternoon?" />
            </ListItem>
          </List>
        </Paper>

        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Box sx={{ mb: 2 }}>
            <video
              ref={videoRef}
              src={videoUrl || mediaBlobUrl}
              autoPlay
              playsInline
              muted
              style={{ 
                width: '100%', 
                maxHeight: '400px', 
                display: hasVideo ? 'block' : 'none',
                backgroundColor: '#000',
                borderRadius: '8px'
              }}
            />
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              style={{ 
                width: '100%', 
                maxHeight: '400px', 
                display: isRecording ? 'block' : 'none',
                backgroundColor: '#000',
                borderRadius: '8px'
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            {!isRecording && !hasVideo && !isNativeRecording && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Videocam />}
                onClick={handleStartRecording}
              >
                Start Recording
              </Button>
            )}
            {(isRecording || isNativeRecording) && (
              <Button
                variant="contained"
                color="error"
                startIcon={<Stop />}
                onClick={handleStopRecording}
              >
                Stop Recording
              </Button>
            )}
            {hasVideo && !isRecording && !isNativeRecording && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={() => videoRef.current?.play()}
                >
                  Play
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Check />}
                  onClick={handleSubmit}
                >
                  Submit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    setHasVideo(false);
                    setIsRecording(false);
                    setIsNativeRecording(false);
                    if (videoUrl) {
                      URL.revokeObjectURL(videoUrl);
                      setVideoUrl(null);
                    }
                  }}
                >
                  Record Again
                </Button>
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Record; 