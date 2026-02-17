import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

async function fetchDriverProfile(id: string) {
  try {
    const profile = await fetchJson<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      profilePicture?: string;
      idNumber?: string;
      passportNumber?: string;
      dateOfBirth?: string;
      licenseNumber?: string;
      licenseExpiry?: string;
      prdpNumber?: string;
      prdpExpiry?: string;
      medicalCertificateExpiry?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankBranchCode?: string;
      accountHolderName?: string;
      salary?: number;
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    }>(`/tenant/drivers/${id}/profile`);
    return profile;
  } catch (error) {
    console.error('Error fetching driver profile:', error);
    return null;
  }
}

async function fetchDriverDocuments(id: string) {
  try {
    const documents = await fetchJson<Array<{
      id: string;
      documentType: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      createdAt: string;
      notes?: string;
    }>>(`/tenant/drivers/${id}/documents`);
    return documents ?? [];
  } catch (error) {
    console.error('Error fetching driver documents:', error);
    return [];
  }
}

export default async function DriverProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const profile = await fetchDriverProfile(id);
  const documents = await fetchDriverDocuments(id);

  if (!profile) {
    notFound();
  }

  async function updateProfile(formData: FormData) {
    "use server";
    const data: Record<string, any> = {};
    const fields = [
      "idNumber", "passportNumber", "dateOfBirth", "licenseNumber", "licenseExpiry",
      "prdpNumber", "prdpExpiry", "medicalCertificateExpiry", "bankName",
      "bankAccountNumber", "bankBranchCode", "accountHolderName", "salary",
      "address", "emergencyContactName", "emergencyContactPhone"
    ];
    for (const field of fields) {
      const value = formData.get(field);
      if (value && String(value).trim()) {
        data[field] = String(value).trim();
      }
    }
    if (data.salary) {
      data.salary = parseFloat(data.salary);
    }
    const { id } = await params;
    await fetch(`${getApiUrl()}/tenant/drivers/${id}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(data),
    });
    revalidatePath(`/drivers/${id}`);
  }

  async function deleteDocument(formData: FormData) {
    "use server";
    const documentId = String(formData.get("documentId") ?? "");
    if (!documentId) return;
    const { id } = await params;
    await fetch(`${getApiUrl()}/tenant/drivers/${id}/documents/${documentId}`, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    revalidatePath(`/drivers/${id}`);
  }

  async function uploadDocument(formData: FormData) {
    "use server";
    const { id } = await params;
    const file = formData.get("file") as File | null;
    const documentType = String(formData.get("documentType") ?? "");
    const notes = String(formData.get("notes") ?? "");
    
    if (!file || !documentType) {
      return;
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("documentType", documentType);
    if (notes) {
      uploadFormData.append("notes", notes);
    }

    await fetch(`${getApiUrl()}/tenant/drivers/${id}/documents`, {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
      },
      body: uploadFormData,
    });
    revalidatePath(`/drivers/${id}`);
  }

  async function uploadProfilePicture(formData: FormData) {
    "use server";
    const { id } = await params;
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return;
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    await fetch(`${getApiUrl()}/tenant/drivers/${id}/profile/picture`, {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
      },
      body: uploadFormData,
    });
    revalidatePath(`/drivers/${id}`);
  }

  async function deleteProfilePicture(formData: FormData) {
    "use server";
    const { id } = await params;
    await fetch(`${getApiUrl()}/tenant/drivers/${id}/profile/picture`, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    revalidatePath(`/drivers/${id}`);
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0];
    } catch {
      return dateStr;
    }
  }

  function formatCurrency(amount?: number) {
    if (amount == null) return "";
    return `R ${amount.toFixed(2)}`;
  }

  const documentTypeLabels: Record<string, string> = {
    id_document: "ID Document",
    passport: "Passport",
    drivers_license: "Driver's License",
    prdp_certificate: "PRDP Certificate",
    medical_certificate: "Medical Certificate",
    bank_statement: "Bank Statement",
    proof_of_address: "Proof of Address",
    other: "Other",
  };

  const profilePictureUrl = profile.profilePicture ? `/api/drivers/${id}/picture` : null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/drivers"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to Drivers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Driver Profile: {profile.firstName} {profile.lastName}
        </h1>
      </div>

      {/* Profile Picture Section */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Profile Picture
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="h-32 w-32 rounded-full object-cover border-4 border-teal-500 shadow-lg"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-4xl font-bold text-white shadow-lg">
                {profile.firstName[0]?.toUpperCase()}{profile.lastName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <form action={uploadProfilePicture} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Upload Profile Picture
                </label>
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="input w-full px-3 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/30 dark:file:text-teal-300"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  JPEG, PNG, GIF, or WebP (max 5MB)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary text-sm"
                >
                  Upload Picture
                </button>
                {profilePictureUrl && (
                  <form action={deleteProfilePicture}>
                    <button
                      type="submit"
                      className="btn btn-secondary text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Remove Picture
                    </button>
                  </form>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <form action={updateProfile} className="space-y-6">
        {/* Personal Information */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Personal Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                First Name
              </label>
              <input
                type="text"
                value={profile.firstName}
                disabled
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last Name
              </label>
              <input
                type="text"
                value={profile.lastName}
                disabled
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Phone Number
              </label>
              <input
                type="text"
                value={profile.phoneNumber ?? ""}
                disabled
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                ID Number
              </label>
              <input
                type="text"
                name="idNumber"
                defaultValue={profile.idNumber ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="South African ID Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Passport Number
              </label>
              <input
                type="text"
                name="passportNumber"
                defaultValue={profile.passportNumber ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                defaultValue={formatDate(profile.dateOfBirth)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Address
              </label>
              <textarea
                name="address"
                defaultValue={profile.address ?? ""}
                rows={3}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Full address"
              />
            </div>
          </div>
        </div>

        {/* License & PRDP Information */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            License & PRDP Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                License Number
              </label>
              <input
                type="text"
                name="licenseNumber"
                defaultValue={profile.licenseNumber ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                License Expiry
              </label>
              <input
                type="date"
                name="licenseExpiry"
                defaultValue={formatDate(profile.licenseExpiry)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                PRDP Number
              </label>
              <input
                type="text"
                name="prdpNumber"
                defaultValue={profile.prdpNumber ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                PRDP Expiry
              </label>
              <input
                type="date"
                name="prdpExpiry"
                defaultValue={formatDate(profile.prdpExpiry)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Medical Certificate Expiry
              </label>
              <input
                type="date"
                name="medicalCertificateExpiry"
                defaultValue={formatDate(profile.medicalCertificateExpiry)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>
        </div>

        {/* Banking Information */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Banking Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Bank Name
              </label>
              <input
                type="text"
                name="bankName"
                defaultValue={profile.bankName ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Account Number
              </label>
              <input
                type="text"
                name="bankAccountNumber"
                defaultValue={profile.bankAccountNumber ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Branch Code
              </label>
              <input
                type="text"
                name="bankBranchCode"
                defaultValue={profile.bankBranchCode ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Account Holder Name
              </label>
              <input
                type="text"
                name="accountHolderName"
                defaultValue={profile.accountHolderName ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Salary (R)
              </label>
              <input
                type="number"
                step="0.01"
                name="salary"
                defaultValue={profile.salary ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Emergency Contact
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Contact Name
              </label>
              <input
                type="text"
                name="emergencyContactName"
                defaultValue={profile.emergencyContactName ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Contact Phone
              </label>
              <input
                type="text"
                name="emergencyContactPhone"
                defaultValue={profile.emergencyContactPhone ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Documents
          </h2>
          
          {/* Upload Form */}
          <form action={uploadDocument} className="mb-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Document Type
                </label>
                <select
                  name="documentType"
                  required
                  className="input mt-1 w-full px-3 py-2 text-sm"
                >
                  <option value="">Select type...</option>
                  <option value="id_document">ID Document</option>
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="prdp_certificate">PRDP Certificate</option>
                  <option value="medical_certificate">Medical Certificate</option>
                  <option value="bank_statement">Bank Statement</option>
                  <option value="proof_of_address">Proof of Address</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  File
                </label>
                <input
                  type="file"
                  name="file"
                  required
                  className="input mt-1 w-full px-3 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/30 dark:file:text-teal-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  name="notes"
                  className="input mt-1 w-full px-3 py-2 text-sm"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Upload Document
            </button>
          </form>

          {documents.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {documentTypeLabels[doc.documentType] ?? doc.documentType}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {doc.fileName} • {(doc.fileSize / 1024).toFixed(1)} KB
                      {doc.notes && ` • ${doc.notes}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${process.env.API_URL ?? "http://localhost:3000"}/tenant/drivers/${id}/documents/${doc.id}/download`}
                      target="_blank"
                      className="text-sm text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                    >
                      Download
                    </a>
                    <form action={deleteDocument}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

