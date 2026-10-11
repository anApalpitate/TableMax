export {};
declare global {
  interface Window {
    tablemaxPackages?: {
      pick(): Promise<{ name: string; base64: string } | null>;
    };
  }
}
