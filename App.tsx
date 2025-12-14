import React from 'react';
import { GameCanvas } from './components/GameCanvas';

function App() {
  return (
    <div className="h-[100dvh] w-full bg-neutral-900 flex items-center justify-center font-sans selection:bg-yellow-500 selection:text-black overflow-hidden">
      <div className="w-full h-full md:h-auto md:p-4 flex flex-col items-center justify-center gap-6">
        <GameCanvas />
        <footer className="text-neutral-500 text-sm hidden md:block">
          Built with React & Canvas API
        </footer>
      </div>
    </div>
  );
}

export default App;