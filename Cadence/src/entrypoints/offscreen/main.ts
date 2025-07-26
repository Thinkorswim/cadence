console.log('Offscreen document loaded for audio playback');

// Listen for messages from the background script
browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  if (message.action === 'playSound' && message.soundFile) {
    playSoundOffscreen(message.soundFile, message.volume);
    sendResponse({ success: true });
  }
});

function playSoundOffscreen(soundFile: string, volume: number = 0.7) {
  try {
    const audio = new Audio(soundFile.startsWith('/') ? soundFile : `/${soundFile}`);
    audio.volume = Math.max(0, Math.min(1, volume)); // Clamp volume between 0 and 1
    
    audio.play().catch(error => {
      console.error('Error playing sound:', error);
    });
  } catch (error) {
    console.error('Error creating audio element:', error);
  }
}
 