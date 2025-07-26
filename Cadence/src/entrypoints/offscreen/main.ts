browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  if (message.action === 'playSound' && message.soundFile) {
    playSoundOffscreen(message.soundFile, message.volume);
    sendResponse({ success: true });
  }
});

const playSoundOffscreen = (soundFile: string, volume: number = 0.7) => {
  try {
    const audio = new Audio(soundFile.startsWith('/') ? soundFile : `/${soundFile}`);
    audio.volume = Math.max(0, Math.min(1, volume));
    
    audio.play().catch(error => {
      console.error('Error playing sound:', error);
    });
  } catch (error) {
    console.error('Error creating audio element:', error);
  }
}
 