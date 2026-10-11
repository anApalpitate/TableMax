import type { HostPresentationServices } from './types';
let services: HostPresentationServices | undefined;
export const avatarChoices: { id: string; name: string; src: string }[] = [];
export function configureGameHost(value: HostPresentationServices) {
  if (services && services !== value)
    throw new Error('Game host is already configured');
  services = value;
  avatarChoices.splice(0, avatarChoices.length, ...value.avatarChoices);
}
export function presentationServices() {
  if (!services) throw new Error('Game host services are not configured');
  return services;
}
