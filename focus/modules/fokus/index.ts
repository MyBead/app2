// The native "Fokus" module (Android only). On web / Expo Go it is missing and the app shows a notice.
import { NativeModule, requireOptionalNativeModule } from 'expo';

type FokusEvents = { onChange: () => void };

declare class FokusNative extends NativeModule<FokusEvents> {
  getState(): string;
  setConfig(json: string): void;
  start(minutes: number): void;
  stop(): void;
  getLog(): string;
  clearLog(): void;
  getApps(): Promise<string>;
  openApp(pkg: string): boolean;
  openListenerSettings(): void;
  openDndSettings(): void;
  openAppSettings(): void;
  openExactAlarmSettings(): void;
  requestAddTile(): Promise<'added' | 'already' | 'declined' | 'unsupported' | 'error'>;
}

export default requireOptionalNativeModule<FokusNative>('Fokus');
