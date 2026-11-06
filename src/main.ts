import './ui/styles.css';
import './ui/mobile-menus.css';
import './ui/controllers.css';
import './ui/tactics.css';
import { App } from './app';
import { initKeyLabels } from './input/input';
import { roomFromUrl } from './net/peer';
import * as flow from './screens/flow';
import { goOnline, goTitle, initFlow } from './screens/flow';
import { syncTouchUi } from './ui/dom';

function boot() {
  const app = new App();
  initFlow(app);
  syncTouchUi();
  void initKeyLabels();
  const room = roomFromUrl();
  if (room) goOnline(room);
  else goTitle();
  // handy for debugging from the console / tests
  (window as unknown as { bbl: App }).bbl = app;
  if (location.search.includes('debug')) (window as unknown as { bblFlow: typeof flow }).bblFlow = flow;
}

try {
  boot();
} catch (e) {
  console.error(e);
  document.getElementById('ui')!.innerHTML =
    '<div class="screen"><div class="h1">OUPS</div><div class="status err">Ton navigateur ne supporte pas WebGL ou une erreur est survenue.<br>' + String(e) + '</div></div>';
}
