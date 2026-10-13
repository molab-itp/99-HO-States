import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import NavBar from '../components/NavBar.jsx';
import Spinner from '../components/Spinner.jsx';
import { profileName, relativeTime } from '../models/profile.js';
import { makeProfilePhoto } from '../models/profilePhoto.js';
import { useAuth } from '../services/AuthContext.jsx';
import * as photos from '../services/profilePhotoService.js';
import PhotoCropView from './PhotoCropView.jsx';

/**
 * One user, with their full-size photo. On your own profile you can choose, crop or remove it; a
 * cropped photo keeps its original, which you can crop again or restore.
 *
 * `profile` is the list's copy, so `onPhotoChanged` (which reloads the list) is also what brings
 * the new photo here.
 */
export default function ProfileDetailView({ profile, isCurrentUser, onBack, onPhotoChanged }) {
  const { client } = useAuth();
  /** An uncropped photo waiting in the cropper: `{ blob, url, isNew }`. */
  const [cropSource, setCropSource] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  /** Runs `operation` with the spinner up, showing its error if it fails. */
  async function run(operation) {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      await operation();
    } catch (error) {
      setErrorMessage(error.message);
    }
    setIsWorking(false);
  }

  /** Runs a photo change, then reloads the list (and with it this profile, for the new paths). */
  function change(operation) {
    return run(async () => {
      await operation();
      await onPhotoChanged();
    });
  }

  /** `blob` is an upright JPEG, as `makeProfilePhoto` encodes it. `isNew`: just picked, so not in the bucket yet. */
  function showCropper(blob, isNew) {
    setCropSource({ blob, url: URL.createObjectURL(blob), isNew });
  }

  function closeCropper() {
    URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
  }

  /** Opens the cropper on a newly picked photo. Nothing is uploaded until the cropper is done. */
  function cropPicked(file) {
    run(async () => {
      const original = await makeProfilePhoto(file);
      showCropper(original.full, true);
    });
  }

  /**
   * Opens the cropper on the stored photo. It always starts from the original, so an earlier
   * crop can be widened again.
   */
  function cropCurrentPhoto() {
    run(async () => {
      const blob = await photos.originalData(client, profile);
      if (blob) showCropper(blob, false);
    });
  }

  /** `rect` is the crop in unit coordinates, or `null` for the whole photo. */
  function finishCrop(source, rect) {
    // The whole of a stored photo is its original.
    if (!rect && !source.isNew) {
      if (profile.photo_original_path) restoreOriginal(source.blob);
      return;
    }
    change(async () => {
      const photo = await makeProfilePhoto(source.blob, rect);
      if (source.isNew) {
        await photos.upload(client, photo, rect ? source.blob : null, profile);
      } else {
        await photos.applyCrop(client, photo, profile);
      }
    });
  }

  /** `blob` is the original, if it's already downloaded. */
  function restoreOriginal(blob = null) {
    change(async () => {
      const data = blob ?? (await photos.originalData(client, profile));
      if (!data) return;
      const original = await makeProfilePhoto(data);
      await photos.restoreOriginal(client, profile, original.thumb);
    });
  }

  const hasPhoto = profile.photo_path != null;

  return (
    <>
      <NavBar title={profileName(profile)} onBack={onBack} />
      <div className="detail">
        <div className="detail-photo">
          <Photo
            url={photos.publicURL(client, profile.photo_path)}
            placeholderURL={photos.publicURL(client, profile.photo_thumb_path) ?? profile.avatar_url}
          />
          {isWorking && (
            <span className="detail-photo-spinner">
              <Spinner large />
            </span>
          )}
        </div>

        {isCurrentUser && (
          <>
            <div className="button-row">
              {/* The system file picker; on a phone it offers the photo library and the camera. */}
              <label className={isWorking ? 'button button-prominent disabled' : 'button button-prominent'}>
                <Icon name="images" />
                {hasPhoto ? 'Change Photo' : 'Choose Photo'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={isWorking}
                  onChange={(event) => {
                    const file = event.target.files[0];
                    // So picking the same file again is still a change.
                    event.target.value = '';
                    if (file) cropPicked(file);
                  }}
                />
              </label>
              {hasPhoto && (
                <button
                  className="button button-bordered button-destructive-text"
                  disabled={isWorking}
                  onClick={() => change(() => photos.remove(client, profile))}
                >
                  <Icon name="trash" />
                  Remove
                </button>
              )}
            </div>

            {hasPhoto && (
              <div className="button-row">
                <button className="button button-bordered" disabled={isWorking} onClick={cropCurrentPhoto}>
                  <Icon name="crop" />
                  Crop
                </button>
                {profile.photo_original_path && (
                  <button className="button button-bordered" disabled={isWorking} onClick={() => restoreOriginal()}>
                    <Icon name="arrow-counterclockwise" />
                    Restore Original
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        {profile.display_name != null && profile.email && <p className="detail-email">{profile.email}</p>}
        {profile.last_seen_at && <p className="detail-active">Active {relativeTime(profile.last_seen_at)}</p>}
      </div>

      {cropSource && (
        <PhotoCropView
          imageURL={cropSource.url}
          onCancel={closeCropper}
          onDone={(rect) => {
            const source = cropSource;
            closeCropper();
            finishCrop(source, rect);
          }}
        />
      )}
    </>
  );
}

/** The full-size photo, with the thumbnail standing in while it downloads. */
function Photo({ url, placeholderURL }) {
  // Keyed by URL, so a new photo starts from its placeholder again.
  const [loadedURL, setLoadedURL] = useState(null);
  const [loadedPlaceholderURL, setLoadedPlaceholderURL] = useState(null);
  const isLoaded = url != null && loadedURL === url;
  const isPlaceholderLoaded = placeholderURL != null && loadedPlaceholderURL === placeholderURL;
  return (
    <>
      {!isLoaded && !isPlaceholderLoaded && <Icon className="detail-photo-empty" name="person-circle" size={160} />}
      {!isLoaded && placeholderURL && (
        <img
          key={placeholderURL}
          src={placeholderURL}
          alt=""
          hidden={!isPlaceholderLoaded}
          onLoad={() => setLoadedPlaceholderURL(placeholderURL)}
        />
      )}
      {url && <img key={url} src={url} alt="" hidden={!isLoaded} onLoad={() => setLoadedURL(url)} />}
    </>
  );
}
