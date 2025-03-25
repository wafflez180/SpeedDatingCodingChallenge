import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Paper, Typography, IconButton, TextField, Button } from '@mui/material';
import { Favorite, FavoriteBorder, Send, ArrowBack } from '@mui/icons-material';
import api, { API_BASE_URL } from '../api/config';

interface Video {
  id: string;
  url: string;
  created_at: string;
  likes: number;
  comments: string[];
  mux_playback_id?: string;
  title?: string;
}

const Watch: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [comment, setComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const navigate = useNavigate();

  // Log component mount and cleanup
  useEffect(() => {
    console.log('React: Watch component mounted', { videoId });
    return () => {
      console.log('React: Watch component unmounted', { videoId });
    };
  }, [videoId]);

  // Add fullscreen prevention and custom controls
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleBeginFullscreen = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if ((videoElement as any).webkitExitFullscreen) {
        (videoElement as any).webkitExitFullscreen();
      }
      return false;
    };

    const handleEndFullscreen = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      // Toggle play/pause on tap
      if (videoElement.paused) {
        videoElement.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoElement.pause();
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    videoElement.addEventListener('webkitbeginfullscreen', handleBeginFullscreen, true);
    videoElement.addEventListener('webkitendfullscreen', handleEndFullscreen, true);
    videoElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);

    return () => {
      videoElement.removeEventListener('webkitbeginfullscreen', handleBeginFullscreen, true);
      videoElement.removeEventListener('webkitendfullscreen', handleEndFullscreen, true);
      videoElement.removeEventListener('touchstart', handleTouchStart);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
    };
  }, [videoRef.current]);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        console.log('React: Fetching video data for ID:', videoId);
        setIsLoading(true);
        setError(null);
        setVideoError(null);
        
        const response = await api.get(`/api/videos/${videoId}`);
        console.log('React: Video data received:', {
          data: response.data,
          url: `${API_BASE_URL}${response.data.url}`,
          timestamp: new Date().toISOString()
        });
        setVideo(response.data);
      } catch (error: any) {
        console.error('React Error: Failed to fetch video:', {
          error,
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          timestamp: new Date().toISOString()
        });
        setError('Failed to load video. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    if (videoId) {
      fetchVideo();
    }
  }, [videoId]);

  // Add video element event listeners
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const logVideoEvent = (event: string, detail?: any) => {
      console.log(`React: Video ${event}`, {
        currentTime: videoElement.currentTime,
        duration: videoElement.duration,
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
        error: videoElement.error,
        src: videoElement.src,
        playbackQuality: videoElement.getVideoPlaybackQuality?.(),
        ...detail,
        timestamp: new Date().toISOString()
      });
    };

    const events = {
      loadstart: () => logVideoEvent('loadstart'),
      loadedmetadata: () => logVideoEvent('loadedmetadata'),
      loadeddata: () => logVideoEvent('loadeddata'),
      progress: () => logVideoEvent('progress'),
      canplay: () => logVideoEvent('canplay'),
      canplaythrough: () => logVideoEvent('canplaythrough'),
      play: () => logVideoEvent('play'),
      pause: () => logVideoEvent('pause'),
      seeking: () => logVideoEvent('seeking'),
      seeked: () => logVideoEvent('seeked'),
      waiting: () => logVideoEvent('waiting'),
      playing: () => logVideoEvent('playing'),
      timeupdate: () => logVideoEvent('timeupdate'),
      ended: () => logVideoEvent('ended'),
      error: (e: Event) => logVideoEvent('error', { error: videoElement.error })
    };

    // Add all event listeners
    Object.entries(events).forEach(([event, handler]) => {
      videoElement.addEventListener(event, handler);
    });

    return () => {
      // Remove all event listeners
      Object.entries(events).forEach(([event, handler]) => {
        videoElement.removeEventListener(event, handler);
      });
    };
  }, [videoRef.current]);

  // Handle video loading and errors
  const handleVideoLoad = () => {
    console.log('React: Video loaded successfully', {
      video: videoRef.current ? {
        duration: videoRef.current.duration,
        readyState: videoRef.current.readyState,
        networkState: videoRef.current.networkState,
        src: videoRef.current.src,
        error: videoRef.current.error,
        paused: videoRef.current.paused,
        currentTime: videoRef.current.currentTime,
      } : null,
      timestamp: new Date().toISOString()
    });
    setIsVideoLoading(false);
    setVideoError(null);

    // Try to play the video automatically
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log('React: Auto-play failed:', error);
      });
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget;
    console.error('React Error: Video playback error:', {
      error: videoElement.error,
      networkState: videoElement.networkState,
      readyState: videoElement.readyState,
      src: videoElement.src,
      currentTime: videoElement.currentTime,
      event: e,
      timestamp: new Date().toISOString()
    });
    setIsVideoLoading(false);
    setVideoError('Failed to load video. Please try refreshing the page.');
  };

  const handleLike = async () => {
    if (!videoId || !video) return;

    try {
      console.log('React: Sending like for video:', videoId);
      const response = await api.post(`/api/videos/${videoId}/like`);
      console.log('React: Like response:', response.data);
      
      setVideo(prev => prev ? { ...prev, likes: response.data.likes } : null);
      setIsLiked(true);
    } catch (error) {
      console.error('React Error: Failed to like video:', error);
      // Show a toast or snackbar here if you want to notify the user
    }
  };

  const handleComment = async () => {
    if (!videoId || !video || !comment.trim()) return;

    try {
      setIsCommentSubmitting(true);
      setCommentError(null);
      console.log('React: Posting comment for video:', videoId);
      
      const response = await api.post(`/api/videos/${videoId}/comment`, {
        text: comment.trim()
      });
      
      console.log('React: Comment response:', response.data);
      setVideo(prev => prev ? { ...prev, comments: response.data.comments } : null);
      setComment('');
      
      // Focus back on the comment input for better UX
      if (commentInputRef.current) {
        commentInputRef.current.focus();
      }
    } catch (error) {
      console.error('React Error: Failed to post comment:', error);
      setCommentError('Failed to post comment. Please try again.');
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  // Handle comment submission with Enter key
  const handleCommentKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (comment.trim() && !isCommentSubmitting) {
        handleComment();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Typography variant="h6" color="error" gutterBottom>
            {error}
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Typography variant="h6" gutterBottom>
            Video not found
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => navigate('/videos')}
          >
            Back to Videos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Back button */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/videos')}
          sx={{ 
            mb: 2, 
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          Back to Videos
        </Button>

        <Paper 
          elevation={3} 
          sx={{ 
            bgcolor: 'background.paper',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
          }}
        >
          {/* Video Container */}
          <Box sx={{ position: 'relative', width: '100%', paddingTop: '56.25%', bgcolor: '#000' }}>
            {isVideoLoading && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default'
                }}
              >
                <div className="loading-spinner" />
              </Box>
            )}
            
            {videoError && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.default',
                  color: 'error.main',
                  flexDirection: 'column',
                  p: 2
                }}
              >
                <Typography variant="h6" component="p" gutterBottom>
                  {videoError}
                </Typography>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </Box>
            )}

            <video
              ref={videoRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000',
                cursor: 'pointer'
              }}
              playsInline
              controls
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              src={video ? `${API_BASE_URL}/api/videos/${video.id}/stream` : ''}
              poster={video ? `${API_BASE_URL}/api/videos/${video.id}/thumbnail` : ''}
            />
          </Box>

          {/* Video Info */}
          <Box sx={{ p: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Typography 
                variant="h4" 
                component="h1" 
                gutterBottom
                sx={{ 
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                {video?.title || 'Untitled Video'}
              </Typography>
              
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
                mb: 3
              }}>
                <Typography 
                  variant="body1" 
                  color="text.secondary"
                  sx={{ fontWeight: 500 }}
                >
                  {video?.created_at ? new Date(video.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : ''}
                </Typography>
                
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  px: 2,
                  py: 1
                }}>
                  <IconButton 
                    onClick={handleLike}
                    color={isLiked ? 'primary' : 'default'}
                    sx={{ mr: 1 }}
                  >
                    {isLiked ? <Favorite /> : <FavoriteBorder />}
                  </IconButton>
                  <Typography 
                    variant="body1" 
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {video?.likes || 0} likes
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Comments Section */}
            <Box sx={{ mt: 4 }}>
              <Typography 
                variant="h5" 
                gutterBottom
                sx={{ 
                  fontWeight: 600,
                  color: 'text.primary',
                  mb: 3
                }}
              >
                Comments ({video?.comments?.length || 0})
              </Typography>
              
              <Box sx={{ display: 'flex', mb: 3, gap: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  variant="outlined"
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyPress={handleCommentKeyPress}
                  inputRef={commentInputRef}
                  error={!!commentError}
                  helperText={commentError}
                  disabled={isCommentSubmitting}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.default'
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleComment}
                  disabled={!comment.trim() || isCommentSubmitting}
                  sx={{ 
                    minWidth: 120,
                    height: 'fit-content',
                    alignSelf: 'flex-start'
                  }}
                  endIcon={<Send />}
                >
                  {isCommentSubmitting ? 'Posting...' : 'Post'}
                </Button>
              </Box>

              <Box sx={{ mt: 3 }}>
                {video?.comments?.length === 0 ? (
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      textAlign: 'center',
                      py: 4
                    }}
                  >
                    No comments yet. Be the first to comment!
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {video?.comments?.map((comment, index) => (
                      <Paper 
                        key={index} 
                        variant="outlined" 
                        sx={{ 
                          p: 3,
                          bgcolor: 'background.default',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="body1">
                          {comment}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>
      </Container>
    </div>
  );
};

export default Watch; 