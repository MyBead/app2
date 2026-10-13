import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { backgroundCheck } from './refresh';

export const DEALS_TASK = 'okazje-check-deals';
/** Minutes. The OS treats it as a lower bound and may run the task less often. */
const INTERVAL_MINUTES = 4 * 60;

// Must run at module load (imported from the root layout) so the OS can wake the task headless.
TaskManager.defineTask(DEALS_TASK, async () => {
  try {
    await backgroundCheck();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function setBackgroundChecks(enabled: boolean): Promise<boolean> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  const registered = await TaskManager.isTaskRegisteredAsync(DEALS_TASK);
  if (enabled && !registered) await BackgroundTask.registerTaskAsync(DEALS_TASK, { minimumInterval: INTERVAL_MINUTES });
  if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(DEALS_TASK);
  return true;
}
