import { getApiUrl, getAuthHeaders } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import MfaPanel from "@/components/mfa-panel";

type SetupState = {
  qrCodeDataUrl?: string;
  secret?: string;
  error?: string;
};

type VerifyState = {
  enabled?: boolean;
  error?: string;
};

export default async function MfaPage() {
  await requireAuth();

  async function setupAction(
    _prevState: SetupState,
    _formData: FormData,
  ): Promise<SetupState> {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/auth/mfa/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
      });
      if (!res.ok) {
        return { error: "Failed to generate MFA secret." };
      }
      const data = (await res.json()) as { qrCodeDataUrl?: string; secret?: string };
      return { qrCodeDataUrl: data.qrCodeDataUrl, secret: data.secret };
    } catch {
      return { error: "Failed to generate MFA secret." };
    }
  }

  async function verifyAction(
    _prevState: VerifyState,
    formData: FormData,
  ): Promise<VerifyState> {
    "use server";
    const token = String(formData.get("token") ?? "").trim();
    if (!token) {
      return { error: "Enter a valid code." };
    }
    try {
      const res = await fetch(`${getApiUrl()}/auth/mfa/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        return { error: "Invalid code. Try again." };
      }
      return { enabled: true };
    } catch {
      return { error: "Invalid code. Try again." };
    }
  }

  return <MfaPanel setupAction={setupAction} verifyAction={verifyAction} />;
}

