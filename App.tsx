import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { ChatInterface } from './components/ChatInterface';

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(false);

  return (
    <>
      {hasEntered ? (
        <ChatInterface />
      ) : (
        <LandingPage onEnter={() => setHasEntered(true)} />
      )}
    </>
  );
};

export default App;