import { useEffect } from "react";
import type { StoryProgress } from "./particleGeometry";
import { storyCues, storyMusic, type StoryMusic } from "./storyMusic";

// Fast enough for the riser to follow the scroll smoothly.
const CUE_POLL_MS = 80;

/** Plays the story soundtrack while About is mounted, following its scenes, transitions and star. */
export function useStoryMusic(scene: number, progress: StoryProgress, reduced: boolean, music: StoryMusic = storyMusic) {
  // Scene and cues are set before the music starts, so arriving mid-story lands no impact.
  useEffect(() => { music.setScene(scene); }, [music, scene]);

  // The progress ref changes every frame without React updates; sample it. The static
  // reading has no transitions: its scenes still land impacts and the last one opens fully.
  useEffect(() => {
    if (reduced) { music.setRise(0); music.setBloom(scene === 4 ? 1 : 0); return; }
    const sample = () => {
      const cues = storyCues(progress.current);
      music.setBloom(cues.bloom);
      music.setRise(cues.rise);
    };
    sample();
    const timer = window.setInterval(sample, CUE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [music, progress, reduced, scene]);

  useEffect(() => {
    music.start();
    return () => music.stop();
  }, [music]);
}
