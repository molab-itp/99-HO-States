/** `ProgressView()`. */
export default function Spinner({ large = false }) {
  return <span className={large ? 'spinner spinner-large' : 'spinner'} role="progressbar" aria-label="Loading" />;
}
