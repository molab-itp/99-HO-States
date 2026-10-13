import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../services/AuthContext.jsx';
import AppVersionLabel from './AppVersionLabel.jsx';

const CODE_LENGTH = 6;

/** Email a 6-digit code, Sign in with Apple, or continue as a guest. */
export default function SignInView() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  /** Non-null once a code has been sent; the address it was sent to. */
  const [codeSentTo, setCodeSentTo] = useState(null);
  const [code, setCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const codeField = useRef(null);

  const trimmedEmail = email.trim().toLowerCase();

  // Focus the code field when it appears, and again after a wrong code clears it.
  useEffect(() => {
    if (codeSentTo && !isWorking) codeField.current?.focus();
  }, [codeSentTo, isWorking]);

  async function sendCode(event) {
    event?.preventDefault();
    if (!trimmedEmail.includes('@')) return;
    const address = trimmedEmail;
    setIsWorking(true);
    if (await auth.sendSignInEmail(address)) {
      setCodeSentTo(address);
      setCode('');
    }
    setIsWorking(false);
  }

  async function verify(digits) {
    if (!codeSentTo || digits.length !== CODE_LENGTH || isWorking) return;
    setIsWorking(true);
    const ok = await auth.verifyCode(digits, codeSentTo);
    setIsWorking(false);
    if (!ok) setCode('');
  }

  function changeCode(text) {
    // Keep digits only (pasted codes may carry spaces); submit once complete.
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) verify(digits);
  }

  async function working(action) {
    setIsWorking(true);
    await action();
    setIsWorking(false);
  }

  const emailStep = (
    <form className="sign-in-step" onSubmit={sendCode}>
      <input
        className="text-field"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button className="button button-prominent button-large" type="submit" disabled={!trimmedEmail.includes('@')}>
        Email Me a Sign-In Code
      </button>
      <button className="button button-apple button-large" type="button" onClick={() => working(auth.signInWithApple)}>
        <Icon name="apple" size={17} />
        Sign in with Apple
      </button>
      <button className="button button-bordered button-large" type="button" onClick={() => working(auth.signInAsGuest)}>
        Continue as Guest
      </button>
    </form>
  );

  const codeStep = (
    <form
      className="sign-in-step"
      onSubmit={(event) => {
        event.preventDefault();
        verify(code);
      }}
    >
      <input
        ref={codeField}
        className="text-field code-field"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        aria-label="Sign-in code"
        value={code}
        onChange={(event) => changeCode(event.target.value)}
      />
      <button className="button button-prominent button-large" type="submit" disabled={code.length !== CODE_LENGTH}>
        Sign In
      </button>
      <div className="sign-in-links">
        <button
          className="link-button"
          type="button"
          onClick={() => {
            setCodeSentTo(null);
            setCode('');
            auth.setErrorMessage(null);
          }}
        >
          Use a different email
        </button>
        <button className="link-button" type="button" onClick={() => sendCode()}>
          Resend code
        </button>
      </div>
    </form>
  );

  return (
    // The fieldset is `.disabled(isWorking)` for everything inside it.
    <fieldset className="sign-in" disabled={isWorking}>
      <div className="sign-in-content">
        <div className="sign-in-hero">
          <Icon className="sign-in-icon" name={codeSentTo ? 'envelope-check-fill' : 'people-fill'} size={64} />
          <h1>{codeSentTo ? 'Check your email' : 'HO Users'}</h1>
          <p>
            {codeSentTo
              ? `Enter the ${CODE_LENGTH}-digit code sent to ${codeSentTo}.`
              : 'Sign in to see who else is here.'}
          </p>
        </div>

        {codeSentTo ? codeStep : emailStep}

        {auth.errorMessage && <p className="error-text">{auth.errorMessage}</p>}

        <AppVersionLabel />
      </div>
    </fieldset>
  );
}
