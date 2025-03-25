import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../api/config';

interface Video {
  id: string;
  title: string;
  url: string;
  thumbnail_url?: string;
  likes?: number;
  comments?: number;
}

const Videos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        console.log('Fetching videos...');
        const response = await api.get('/api/videos');
        console.log('Videos response:', response.data);
        
        if (!Array.isArray(response.data)) {
          throw new Error('Invalid response format');
        }
        
        const validVideos = response.data.filter(video => 
          video && video.id && typeof video.id === 'string'
        );
        
        if (validVideos.length === 0) {
          throw new Error('No valid videos found');
        }
        
        setVideos(validVideos);
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  const handleVideoTap = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;

    if (playingVideoId === videoId) {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    } else {
      if (playingVideoId && videoRefs.current[playingVideoId]) {
        const currentVideo = videoRefs.current[playingVideoId];
        if (currentVideo) {
          currentVideo.pause();
          currentVideo.currentTime = 0;
        }
      }
      setPlayingVideoId(videoId);
      video.currentTime = 0;
      video.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center p-4">
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-md mx-auto">
        {videos.map((video) => {
          const videoUrl = video?.id ? `${API_BASE_URL}/api/videos/${video.id}/stream` : '';
          const thumbnailUrl = video?.id ? `${API_BASE_URL}/api/videos/${video.id}/thumbnail` : '';
          const isPlaying = playingVideoId === video.id;

          if (!videoUrl) return null;

          return (
            <div 
              key={video.id} 
              className="relative aspect-[9/16] mb-4 bg-gray-900 overflow-hidden"
            >
              {/* Video Player */}
              <div className="absolute inset-0 flex items-center justify-center">
                <video
                  ref={(el) => {
                    if (el) {
                      videoRefs.current[video.id] = el;
                      el.setAttribute('playsinline', '');
                      el.setAttribute('webkit-playsinline', '');
                    }
                  }}
                  src={videoUrl}
                  className="w-full h-full object-contain bg-black"
                  style={{ maxHeight: '100%', maxWidth: '100%' }}
                  loop
                  playsInline
                  muted
                  poster={thumbnailUrl}
                  onClick={() => handleVideoTap(video.id)}
                />

                {/* Play Button Overlay */}
                {!isPlaying && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"
                    onClick={() => handleVideoTap(video.id)}
                  >
                    <div className="rounded-full bg-white bg-opacity-50 p-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Video Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                  <h3 className="text-white text-lg font-semibold mb-2">
                    {video.title || 'Untitled Video'}
                  </h3>
                  
                  {/* Interaction Buttons */}
                  <div className="flex items-center space-x-4">
                    <button className="flex items-center space-x-1 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span>{video.likes || 0}</span>
                    </button>
                    
                    <button className="flex items-center space-x-1 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{video.comments || 0}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Videos; 