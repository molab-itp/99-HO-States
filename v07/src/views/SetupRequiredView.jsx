import Icon from '../components/Icon.jsx';

/** Shown when `.env.local` hasn't been filled in yet (see v07/README.md). */
export default function SetupRequiredView({ message }) {
  return (
    <div className="unavailable">
      <Icon name="gear-wide-connected" size={48} />
      <h1>Supabase not configured</h1>
      <p>{message}</p>
    </div>
  );
}
