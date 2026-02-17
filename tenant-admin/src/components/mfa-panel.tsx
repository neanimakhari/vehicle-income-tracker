"use client";

import { useFormState } from "react-dom";

type SetupState = {
  qrCodeDataUrl?: string;
  secret?: string;
  error?: string;
};

type VerifyState = {
  enabled?: boolean;
  error?: string;
};

type MfaPanelProps = {
  setupAction: (prevState: SetupState, formData: FormData) => Promise<SetupState>;
  verifyAction: (prevState: VerifyState, formData: FormData) => Promise<VerifyState>;
};

const initialSetupState: SetupState = {};
const initialVerifyState: VerifyState = {};

export default function MfaPanel({ setupAction, verifyAction }: MfaPanelProps) {
  const [setupState, setupFormAction] = useFormState(setupAction, initialSetupState);
  const [verifyState, verifyFormAction] = useFormState(verifyAction, initialVerifyState);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Multi-Factor Auth</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Scan the QR code with your authenticator app and verify the code to enable MFA.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Step 1: Generate Secret</h3>
        <form action={setupFormAction} className="mt-4 space-y-4">
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Generate QR Code
          </button>
          {setupState.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              {setupState.error}
            </div>
          ) : null}
          {setupState.qrCodeDataUrl ? (
            <div className="space-y-3">
              <img
                src={setupState.qrCodeDataUrl}
                alt="MFA QR code"
                className="h-48 w-48 rounded-md border border-zinc-200 bg-white p-2"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Secret: {setupState.secret}</p>
            </div>
          ) : null}
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Step 2: Verify Code</h3>
        <form action={verifyFormAction} className="mt-4 space-y-4">
          <input
            name="token"
            type="text"
            placeholder="123456"
            className="input w-full px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Enable MFA
          </button>
          {verifyState.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              {verifyState.error}
            </div>
          ) : null}
          {verifyState.enabled ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
              MFA enabled successfully.
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}


