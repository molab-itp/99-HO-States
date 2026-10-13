// Port of UserEvent.swift.
import { profileName } from './profile.js';

const KINDS = {
  created: { verb: 'joined', icon: 'person-plus-fill' },
  signedIn: { verb: 'signed in', icon: 'person-check-fill' },
  signedOut: { verb: 'signed out', icon: 'person-x-fill' },
  deleted: { verb: 'was deleted', icon: 'person-dash-fill' },
};

/** Something that happened to another user while the list was open, shown as a banner. */
export function userEvent(kind, profile) {
  const { verb, icon } = KINDS[kind];
  return { id: crypto.randomUUID(), kind, message: `${profileName(profile)} ${verb}`, icon };
}
