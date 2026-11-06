import type { App } from '../app';
import type { MatchInfo, MatchLink } from '../game/match';
import type { Action, BattleState } from '../rules/battle';
import { BattleScreen } from './battle';
import { LabScreen } from './lab';
import { OptionsScreen } from './options';
import { ResultsScreen } from './results';
import { SetupScreen, type SetupKind } from './setup';
import { TitleScreen } from './title';
import { HelpScreen } from './help';
import { OnlineScreen } from './online';
import { CampaignScreen } from './campaign';

/** Screen navigation (one app, one active screen). */
let app: App;

export function initFlow(a: App) {
  app = a;
}

export function goTitle() {
  app.go(new TitleScreen(app));
}

/** kept for the screens copied from BBL FIGHTERZ (lab, options) */
export const goMenu = goTitle;

export function goSetup(kind: SetupKind) {
  app.go(new SetupScreen(app, kind));
}

export function goBattle(info: MatchInfo, state?: BattleState, log: Action[] = [], link: MatchLink | null = null) {
  app.go(new BattleScreen(app, info, state, log, link));
}

export function goResults(info: MatchInfo, state: BattleState) {
  app.go(new ResultsScreen(app, info, state));
}

export function goLab() {
  app.go(new LabScreen(app));
}

export function goOptions() {
  app.go(new OptionsScreen(app));
}

export function goHelp() {
  app.go(new HelpScreen(app));
}

export function goOnline(room: string | null = null) {
  app.go(new OnlineScreen(app, room));
}

export function goCampaign() {
  app.go(new CampaignScreen(app));
}

export function getApp(): App {
  return app;
}
