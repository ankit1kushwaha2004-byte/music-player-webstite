'use client';

import { useEffect, useState, useRef } from 'react';

export default function GlassMusicPlayer() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showAdminImport, setShowAdminImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Volume & Progress state
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef(null);

  // Load tracks from MySQL
  async function loadData() {
    try {
      const res = await fetch('/api/playlists');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setTracks(json.data);
      } else {
        setTracks([]);
      }
    } catch (err) {
      console.error('Failed to fetch tracks:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Initialize YouTube Iframe API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setupPlayer();
      };
    } else {
      setupPlayer();
    }
  }, [tracks]);

  // Timer loop for tracking playback progress
  useEffect(() => {
    const timer = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && isPlaying) {
        const curr = playerRef.current.getCurrentTime() || 0;
        const total = playerRef.current.getDuration() || 0;
        setCurrentTime(curr);
        setDuration(total);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const currentTrack = tracks[currentIndex] || null;

  const setupPlayer = () => {
    if (!window.YT || !tracks.length) return;

    if (!playerRef.current) {
      playerRef.current = new window.YT.Player('yt-audio-player', {
        height: '10',
        width: '10',
        videoId: tracks[0]?.youtube_id,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(volume);
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              handleNext(); // Track finished -> auto-play next
            } else if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
        },
      });
    }
  };

  const playTrackAtIndex = (index) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setCurrentTime(0);
    if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(tracks[index].youtube_id);
      playerRef.current.setVolume(volume);
      playerRef.current.playVideo();
    }
  };

  const togglePlay = () => {
    if (!playerRef.current || !playerRef.current.playVideo) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    const nextIdx = (currentIndex + 1) % tracks.length;
    playTrackAtIndex(nextIdx);
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    const prevIdx = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrackAtIndex(prevIdx);
  };

  // Skip / seek song position
  const handleSeek = (e) => {
    const seekTo = parseFloat(e.target.value);
    setCurrentTime(seekTo);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seekTo, true);
    }
  };

  // Volume slider handler
  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(val);
    }
  };

  // Convert seconds to MM:SS format
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleImportPlaylist = async (e) => {
    e.preventDefault();
    if (!importUrl) return;

    setIsImporting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl: importUrl }),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
        setImportUrl('');
        await loadData();
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('Failed to import.');
    } finally {
      setIsImporting(false);
    }
  };

  // Delete a single specific track
  const handleDeleteTrack = async (e, trackId, trackTitle, trackIndex) => {
    e.stopPropagation(); // Avoid playing song when clicking delete

    const confirmDelete = window.confirm(`Remove "${trackTitle}" from your playlist?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/tracks/${trackId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        if (trackIndex === currentIndex) {
          if (tracks.length > 1) {
            handleNext();
          } else {
            if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
              playerRef.current.stopVideo();
            }
            setIsPlaying(false);
          }
        }
        await loadData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete track.');
    }
  };

  return (
    <main
      className="relative min-h-screen w-full flex flex-col justify-between select-none overflow-hidden bg-cover bg-center font-sans"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.35)), url('/pexels-alexeydemidov-10887424.jpg')`,
      }}
    >
      {/* Liquid Glass Top Navigation Bar */}
      <header className="w-full flex items-center justify-between px-10 py-5 z-20">
        <div className="bg-white/10 hover:bg-white/15 backdrop-blur-2xl border border-white/30 rounded-2xl px-5 py-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_32px_rgba(0,0,0,0.15)] transition">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎵</span>
            <span className="text-white text-lg font-semibold tracking-wide drop-shadow-sm">
              Music
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-2xl border border-white/35 text-white/90 text-xs font-medium px-5 py-2 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_24px_rgba(0,0,0,0.15)] flex items-center gap-2 transition cursor-pointer"
          >
            <span>▼</span>
            <span>Playlist</span>
          </button>

          <button
            onClick={() => setShowAdminImport(!showAdminImport)}
            className="bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-2xl border border-white/35 text-white/90 text-xs font-medium px-5 py-2 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_24px_rgba(0,0,0,0.15)] flex items-center gap-2 transition cursor-pointer"
          >
            <span>⬇</span>
            <span>{showAdminImport ? 'Close URL' : 'Import'}</span>
          </button>
        </nav>
      </header>

      {/* Playlist Drawer with Modern SVG Trash Icon */}
      {showQueue && (
        <div className="fixed top-20 right-10 w-96 max-h-[70vh] bg-white/20 backdrop-blur-3xl border border-white/40 rounded-3xl p-5 z-40 overflow-y-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-3">
            <div>
              <h3 className="text-white font-semibold text-sm drop-shadow-sm">
                Current Playlist ({tracks.length})
              </h3>
              {tracks.length > 0 && (
                <p className="text-[10px] text-white/70 truncate max-w-[200px]">
                  {tracks[0].playlist_name}
                </p>
              )}
            </div>

            <button
              onClick={() => setShowQueue(false)}
              className="text-white/70 hover:text-white text-xs cursor-pointer ml-1"
            >
              ✕
            </button>
          </div>

          <ul className="divide-y divide-white/10">
            {tracks.length === 0 ? (
              <li className="text-white/60 text-xs py-4 text-center">
                No songs in the playlist.
              </li>
            ) : (
              tracks.map((t, idx) => (
                <li
                  key={t.track_id || idx}
                  onClick={() => playTrackAtIndex(idx)}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-between cursor-pointer transition group ${
                    currentIndex === idx
                      ? 'bg-white/30 text-white font-medium shadow-sm'
                      : 'text-white/80 hover:bg-white/15'
                  }`}
                >
                  <div className="truncate pr-3 flex-1">
                    <p className="text-xs truncate">{t.track_title}</p>
                    <p className="text-[10px] text-white/60 truncate">{t.channel_title}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                      Play
                    </span>

                    {/* Minimalist SVG Trash Button */}
                    <button
                      onClick={(e) => handleDeleteTrack(e, t.track_id, t.track_title, idx)}
                      className="text-white/60 hover:text-rose-300 hover:bg-rose-500/20 p-1.5 rounded-lg transition-all opacity-60 group-hover:opacity-100 cursor-pointer"
                      title="Delete this song"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Admin URL Import Popover (Shifted to Right) */}
      {showAdminImport && (
        <div className="fixed top-20 right-10 z-40 bg-white/20 backdrop-blur-3xl border border-white/40 p-4 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_20px_50px_rgba(0,0,0,0.3)] w-80">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white">Import YouTube Playlist</p>
            <button
              onClick={() => setShowAdminImport(false)}
              className="text-white/70 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleImportPlaylist} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="https://www.youtube.com/playlist?list=..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="bg-black/20 border border-white/30 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              disabled={isImporting}
              className="bg-white/30 hover:bg-white/40 text-white text-xs font-semibold py-1.5 rounded-lg border border-white/40 transition disabled:opacity-50 cursor-pointer"
            >
              {isImporting ? 'Importing...' : 'Sync to MySQL'}
            </button>
          </form>
        </div>
      )}

      <div className="flex-1"></div>

      {/* Floating Bottom Music Player Bar */}
      <footer className="w-full flex justify-center pb-8 px-4 z-30">
        <div className="bg-white/15 hover:bg-white/20 backdrop-blur-3xl border border-white/40 rounded-3xl px-6 py-4 flex flex-col gap-2.5 max-w-2xl w-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_20px_50px_rgba(0,0,0,0.35)] transition">
          {/* Main Controls Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Song Thumbnail & Metadata */}
            <div className="flex items-center gap-3 overflow-hidden max-w-[200px] sm:max-w-xs">
              <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-white/40 shadow-sm bg-black/20">
                <img
                  src={
                    currentTrack?.thumbnail_url ||
                    `https://img.youtube.com/vi/${currentTrack?.youtube_id}/default.jpg`
                  }
                  alt="Track art"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src =
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=100&q=80';
                  }}
                />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate drop-shadow-sm">
                  {currentTrack ? currentTrack.track_title : 'No track selected'}
                </p>
                <p className="text-xs text-white/70 truncate">
                  {currentTrack ? currentTrack.channel_title : 'YouTube Music'}
                </p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                className="text-white/80 hover:text-white hover:scale-110 active:scale-95 transition text-lg cursor-pointer"
                title="Previous Track"
              >
                ⏮
              </button>

              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white/30 hover:bg-white/40 active:scale-95 border border-white/50 text-white flex items-center justify-center transition shadow-md cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                <span className="text-sm">{isPlaying ? '❚❚' : '▶'}</span>
              </button>

              <button
                onClick={handleNext}
                className="text-white/80 hover:text-white hover:scale-110 active:scale-95 transition text-lg cursor-pointer"
                title="Next Track"
              >
                ⏭
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVolumeChange({ target: { value: volume > 0 ? 0 : 70 } })}
                className="text-white/80 hover:text-white text-sm cursor-pointer"
                title={volume === 0 ? 'Unmute' : 'Mute'}
              >
                {volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 accent-white h-1 bg-white/30 rounded-lg cursor-pointer appearance-none"
                title={`Volume: ${volume}%`}
              />
            </div>
          </div>

          {/* Interactive Scrubbing Bar (Seek Bar) */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[11px] text-white/80 font-mono w-9 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-white h-1.5 bg-white/30 hover:bg-white/40 rounded-lg cursor-pointer appearance-none"
            />
            <span className="text-[11px] text-white/80 font-mono w-9 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </footer>

      {/* Hidden YouTube Audio Iframe */}
      <div style={{ position: 'fixed', bottom: -500, left: -500, opacity: 0.001, pointerEvents: 'none' }}>
        <div id="yt-audio-player"></div>
      </div>
    </main>
  );
}