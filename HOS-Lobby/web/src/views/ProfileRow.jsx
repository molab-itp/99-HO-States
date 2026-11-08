import Avatar from '../components/Avatar.jsx';
import { profileName, relativeTime } from '../models/profile.js';

/** `thumbURL` is the uploaded photo's thumbnail; falls back to an avatar from the sign-in provider, if any. */
export default function ProfileRow({ profile, isCurrentUser, thumbURL }) {
  return (
    <span className="profile-row">
      <Avatar url={thumbURL ?? profile.avatar_url} />
      <span className="profile-row-text">
        <span className="profile-row-name">
          <span className="profile-name">{profileName(profile)}</span>
          {isCurrentUser && <span className="you-badge">You</span>}
        </span>
        {profile.caption && <span className="profile-caption">{profile.caption}</span>}
        {/* The name already falls back to the email, so only repeat it under a real name. */}
        {profile.display_name != null && profile.email && <span className="profile-email">{profile.email}</span>}
        {profile.last_seen_at && <span className="profile-active">Active {relativeTime(profile.last_seen_at)}</span>}
      </span>
    </span>
  );
}
