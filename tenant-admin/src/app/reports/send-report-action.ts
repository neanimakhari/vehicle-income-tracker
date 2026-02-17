"use server";

import { getApiUrl, getAuthHeaders } from "@/lib/api";

export async function sendMonthlyReportAction(startDate: string, endDate: string) {
  try {
    const response = await fetch(
      `${getApiUrl()}/tenant/reports/send-monthly-report?startDate=${startDate}&endDate=${endDate}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to send report");
    }

    const result = await response.json();
    return { success: true, email: result.email };
  } catch (error) {
    console.error("Error sending report:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

