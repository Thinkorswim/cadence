import { useState, useEffect } from 'react'
import '~/assets/global.css';

function Blocked() {
  const [selectedQuote, setSelectedQuote] = useState({
    quote: 'Focus on being productive instead of busy.',
    author: "Tim Ferriss"
  });
  const [blockedSite, setBlockedSite] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBlockedSite(params.get('site') || '');
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <img src="/images/logo.svg" alt="Cadence Logo" className="w-16 h-16 mx-auto mb-2" />
          <h1 className="text-4xl font-bold text-primary mb-10">Cadence</h1>
          {blockedSite && (
            <p className="text-xl text-muted-foreground mb-6">
              Access to <span className="font-semibold text-foreground">{blockedSite}</span> is blocked during focus sessions
            </p>
          )}
        </div>


      </div>
    </div>
  );
}

export default Blocked;
