"use client";
import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  Film,
} from "lucide-react";
import type { Block } from "@/lib/composer/schema";

type VideoBlock = Extract<Block, { kind: "video" }>;

export function VideoPlayer({
  block,
  onComplete,
}: {
  block: VideoBlock;
  onComplete?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(block.startOverlay ?? true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handleStart() {
    setShowOverlay(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }

  function handleTogglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }

  function handleReplay() {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
    setIsCompleted(false);
  }

  function handleSkip() {
    if (videoRef.current) {
      videoRef.current.currentTime = videoRef.current.duration || 10;
    }
    handleEnded();
  }

  function handleEnded() {
    setIsPlaying(false);
    setIsCompleted(true);
    if (onComplete) {
      onComplete();
    }
  }

  // Simulated video playback when using demonstration placeholder (no real MP4 stream)
  useEffect(() => {
    if (!block.src && isPlaying && !isCompleted) {
      const timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 6) {
            clearInterval(timer);
            handleEnded();
            return 6;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPlaying, isCompleted, block.src]);

  return (
    <div className="video-player-container">
      {/* Video Title Header */}
      {block.title && (
        <div className="video-player-header">
          <Film className="video-title-icon" />
          <h4 className="video-title-text">{block.title}</h4>
        </div>
      )}

      {/* Video Viewport */}
      <div className="video-viewport">
        {block.src ? (
          <video
            ref={videoRef}
            src={block.src}
            poster={block.poster}
            playsInline
            className="video-element"
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
                setDuration(videoRef.current.duration || 0);
              }
            }}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          /* Animated Safety Video Simulation Surface */
          <div className="video-simulation-surface">
            {block.poster ? (
              <img src={block.poster} alt={block.title || "Video poster"} className="video-poster-img" />
            ) : (
              <div className="video-placeholder-graphic">
                <div className="graphic-scanline" />
                <div className="graphic-badge">
                  <Film className="graphic-icon" />
                  <span>SAFETY BRIEFING VIDEO STREAM</span>
                </div>
                <div className="graphic-time">
                  {isPlaying ? `00:0${currentTime} / 00:06` : "Ready to play (0:06)"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Start Overlay Button */}
        {showOverlay && (
          <div className="video-start-overlay">
            <button
              type="button"
              className="video-start-btn"
              onClick={handleStart}
              aria-label={block.startButtonLabel || "Start video"}
            >
              <div className="play-icon-glow">
                <Play className="play-svg" />
              </div>
              <span className="start-btn-label">
                {block.startButtonLabel || "Start Video"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Control Bar */}
      {!showOverlay && (
        <div className="video-controls-bar">
          <button
            type="button"
            className="control-icon-btn"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <Pause className="icon-svg" /> : <Play className="icon-svg" />}
          </button>

          <button
            type="button"
            className="control-icon-btn"
            onClick={handleReplay}
            title="Replay from start"
            aria-label="Replay video"
          >
            <RotateCcw className="icon-svg" />
          </button>

          {/* Progress Indicator */}
          <div className="video-progress-track">
            <div
              className="video-progress-fill"
              style={{
                width: `${block.src && duration ? (currentTime / duration) * 100 : (currentTime / 6) * 100}%`,
              }}
            />
          </div>

          {block.allowSkip && !isCompleted && (
            <button
              type="button"
              className="control-skip-btn"
              onClick={handleSkip}
              title="Skip video and unlock continue"
            >
              <span>Skip</span>
              <SkipForward className="skip-svg" />
            </button>
          )}

          {isCompleted && (
            <div className="video-completed-badge">
              <CheckCircle2 className="check-svg" />
              <span>Video Completed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
