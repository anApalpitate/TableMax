import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Prototype } from './Prototype';
import { GamePrototype } from './GamePrototype';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get('game') ===
    'pokemon-encounters' ? (
      <GamePrototype />
    ) : (
      <Prototype />
    )}
  </StrictMode>,
);
