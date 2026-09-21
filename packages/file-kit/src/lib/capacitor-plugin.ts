import { Capacitor, registerPlugin, type Plugin } from '@capacitor/core';

type CapacitorPluginRegistry = {
  Plugins?: Record<string, Plugin | undefined>;
};

/**
 * Capacitor keeps plugin proxies in a process-wide registry. Reuse that proxy
 * when another kit has already registered the same native plugin.
 */
export function registerCapacitorPluginOnce<T extends Plugin>(pluginName: string): T {
  const registry = Capacitor as unknown as CapacitorPluginRegistry;
  const existingPlugin = registry.Plugins?.[pluginName];
  if (existingPlugin) {
    return existingPlugin as T;
  }

  return registerPlugin<T>(pluginName);
}
