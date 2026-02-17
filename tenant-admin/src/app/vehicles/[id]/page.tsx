import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../../lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Car, FileText, Shield, User, Calendar } from "lucide-react";

function formatDateForInput(dateValue: string | null | undefined): string {
  if (!dateValue) return "";
  try {
    if (typeof dateValue === 'string') {
      // If it's already in YYYY-MM-DD format, return it
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      // Otherwise parse it
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split('T')[0];
    }
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split('T')[0];
  } catch {
    return "";
  }
}

async function fetchVehicle(id: string) {
  try {
    const vehicles = await fetchJson<Array<{
      id: string;
      label: string;
      registrationNumber: string;
      make: string | null;
      model: string | null;
      year: number | null;
      color: string | null;
      vin: string | null;
      engineNumber: string | null;
      licenseDiskNumber: string | null;
      licenseDiskExpiry: string | null;
      insuranceProvider: string | null;
      insurancePolicyNumber: string | null;
      insuranceAmount: number | null;
      insuranceExpiry: string | null;
      ownerName: string | null;
      ownerContact: string | null;
      ownerAddress: string | null;
      roadworthyCertificateNumber: string | null;
      roadworthyExpiry: string | null;
      permitNumber: string | null;
      permitExpiry: string | null;
      notes: string | null;
      isActive: boolean;
    }>>("/tenant/vehicles");
    
    if (!vehicles || !Array.isArray(vehicles)) {
      console.error('Failed to fetch vehicles or invalid response');
      return null;
    }
    
    return vehicles.find(v => v.id === id) ?? null;
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return null;
  }
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  if (!id) {
    notFound();
  }
  const vehicle = await fetchVehicle(id);

  if (!vehicle) {
    notFound();
  }

  async function updateVehicle(formData: FormData) {
    "use server";
    const payload: any = {};
    
    // Basic info
    const label = formData.get("label");
    if (label) payload.label = label;
    const registrationNumber = formData.get("registrationNumber");
    if (registrationNumber) payload.registrationNumber = registrationNumber;
    
    // Vehicle details
    const make = formData.get("make");
    if (make) payload.make = make;
    const model = formData.get("model");
    if (model) payload.model = model;
    const year = formData.get("year");
    if (year) payload.year = Number(year);
    const color = formData.get("color");
    if (color) payload.color = color;
    const vin = formData.get("vin");
    if (vin) payload.vin = vin;
    const engineNumber = formData.get("engineNumber");
    if (engineNumber) payload.engineNumber = engineNumber;
    
    // License disk
    const licenseDiskNumber = formData.get("licenseDiskNumber");
    if (licenseDiskNumber) payload.licenseDiskNumber = licenseDiskNumber;
    const licenseDiskExpiry = formData.get("licenseDiskExpiry");
    if (licenseDiskExpiry) payload.licenseDiskExpiry = licenseDiskExpiry;
    
    // Insurance
    const insuranceProvider = formData.get("insuranceProvider");
    if (insuranceProvider) payload.insuranceProvider = insuranceProvider;
    const insurancePolicyNumber = formData.get("insurancePolicyNumber");
    if (insurancePolicyNumber) payload.insurancePolicyNumber = insurancePolicyNumber;
    const insuranceAmount = formData.get("insuranceAmount");
    if (insuranceAmount) payload.insuranceAmount = Number(insuranceAmount);
    const insuranceExpiry = formData.get("insuranceExpiry");
    if (insuranceExpiry) payload.insuranceExpiry = insuranceExpiry;
    
    // Owner
    const ownerName = formData.get("ownerName");
    if (ownerName) payload.ownerName = ownerName;
    const ownerContact = formData.get("ownerContact");
    if (ownerContact) payload.ownerContact = ownerContact;
    const ownerAddress = formData.get("ownerAddress");
    if (ownerAddress) payload.ownerAddress = ownerAddress;
    
    // Additional docs
    const roadworthyCertificateNumber = formData.get("roadworthyCertificateNumber");
    if (roadworthyCertificateNumber) payload.roadworthyCertificateNumber = roadworthyCertificateNumber;
    const roadworthyExpiry = formData.get("roadworthyExpiry");
    if (roadworthyExpiry) payload.roadworthyExpiry = roadworthyExpiry;
    const permitNumber = formData.get("permitNumber");
    if (permitNumber) payload.permitNumber = permitNumber;
    const permitExpiry = formData.get("permitExpiry");
    if (permitExpiry) payload.permitExpiry = permitExpiry;
    
    // Notes
    const notes = formData.get("notes");
    if (notes) payload.notes = notes;

    await fetch(`${getApiUrl()}/tenant/vehicles/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(payload),
    });
    revalidatePath(`/vehicles/${id}`);
    revalidatePath("/vehicles");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/vehicles"
          className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vehicles
        </Link>
      </div>

      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Vehicle Details: {vehicle.label}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Registration: {vehicle.registrationNumber}
          </p>
        </div>
      </div>

      <form action={updateVehicle} className="space-y-6">
        {/* Basic Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Basic Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Label
              </label>
              <input
                type="text"
                name="label"
                defaultValue={vehicle.label}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Registration Number
              </label>
              <input
                type="text"
                name="registrationNumber"
                defaultValue={vehicle.registrationNumber}
                className="input w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Vehicle Details
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Make
              </label>
              <input
                type="text"
                name="make"
                defaultValue={vehicle.make || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Model
              </label>
              <input
                type="text"
                name="model"
                defaultValue={vehicle.model || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Year
              </label>
              <input
                type="number"
                name="year"
                defaultValue={vehicle.year || ""}
                className="input w-full"
                min="1900"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Color
              </label>
              <input
                type="text"
                name="color"
                defaultValue={vehicle.color || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                VIN (Chassis Number)
              </label>
              <input
                type="text"
                name="vin"
                defaultValue={vehicle.vin || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Engine Number
              </label>
              <input
                type="text"
                name="engineNumber"
                defaultValue={vehicle.engineNumber || ""}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* License Disk Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            License Disk Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                License Disk Number
              </label>
              <input
                type="text"
                name="licenseDiskNumber"
                defaultValue={vehicle.licenseDiskNumber || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                License Disk Expiry Date
              </label>
              <input
                type="date"
                name="licenseDiskExpiry"
                defaultValue={formatDateForInput(vehicle.licenseDiskExpiry)}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Insurance Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Insurance Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Insurance Provider
              </label>
              <input
                type="text"
                name="insuranceProvider"
                defaultValue={vehicle.insuranceProvider || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Policy Number
              </label>
              <input
                type="text"
                name="insurancePolicyNumber"
                defaultValue={vehicle.insurancePolicyNumber || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Insurance Amount (R)
              </label>
              <input
                type="number"
                name="insuranceAmount"
                defaultValue={vehicle.insuranceAmount || ""}
                className="input w-full"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Insurance Expiry Date
              </label>
              <input
                type="date"
                name="insuranceExpiry"
                defaultValue={formatDateForInput(vehicle.insuranceExpiry)}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Owner Information */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Owner Information
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Owner Name
              </label>
              <input
                type="text"
                name="ownerName"
                defaultValue={vehicle.ownerName || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Owner Contact
              </label>
              <input
                type="text"
                name="ownerContact"
                defaultValue={vehicle.ownerContact || ""}
                className="input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Owner Address
              </label>
              <textarea
                name="ownerAddress"
                defaultValue={vehicle.ownerAddress || ""}
                className="input w-full"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Additional Documentation */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Additional Documentation
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Roadworthy Certificate Number
              </label>
              <input
                type="text"
                name="roadworthyCertificateNumber"
                defaultValue={vehicle.roadworthyCertificateNumber || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Roadworthy Expiry Date
              </label>
              <input
                type="date"
                name="roadworthyExpiry"
                defaultValue={formatDateForInput(vehicle.roadworthyExpiry)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Permit Number
              </label>
              <input
                type="text"
                name="permitNumber"
                defaultValue={vehicle.permitNumber || ""}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Permit Expiry Date
              </label>
              <input
                type="date"
                name="permitExpiry"
                defaultValue={formatDateForInput(vehicle.permitExpiry)}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Additional Notes
          </h2>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              defaultValue={vehicle.notes || ""}
              className="input w-full"
              rows={4}
              placeholder="Any additional notes about this vehicle..."
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link
            href="/vehicles"
            className="btn btn-secondary"
          >
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
