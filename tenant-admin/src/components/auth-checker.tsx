"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthChecker() {
  const router = useRouter();

  useEffect(() => {
    // Check for token expiration on client side
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        
        if (response.status === 401) {
          router.push("/login?error=expired");
        }
      } catch (error) {
        // Silently fail - server-side checks will handle it
      }
    };

    // Check auth periodically (every 5 minutes)
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    
    // Also check on focus
    window.addEventListener("focus", checkAuth);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkAuth);
    };
  }, [router]);

  return null;
}

