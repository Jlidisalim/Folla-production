/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/SyncClerkEmail.tsx
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import api from "@/lib/api";

export default function SyncClerkEmail() {
  const { user } = useUser();

  useEffect(() => {
    const doSync = async () => {
      if (!user) {
        localStorage.removeItem("clerkId");
        localStorage.removeItem("clientEmail");
        localStorage.removeItem("clientPhone");
        // remove axios header
        try {
          delete (api as any).defaults.headers.common["x-clerk-id"];
          delete (api as any).defaults.headers.common["x-user-email"];
          delete (api as any).defaults.headers.common["x-user-phone"];
        } catch {}
        return;
      }

      const clerkId = user.id;
      const email =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress ||
        null;
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.fullName ||
        null;
      const storedPhone = localStorage.getItem("clientPhone");
      const phone =
        user.primaryPhoneNumber?.phoneNumber ||
        user.primaryPhoneNumber?.formattedNumber ||
        user.phoneNumbers?.[0]?.phoneNumber ||
        user.phoneNumbers?.[0]?.formattedNumber ||
        storedPhone ||
        null;

      if (clerkId) {
        try {
          // set localstorage (your interceptor reads these)
          localStorage.setItem("clerkId", clerkId);
          if (email) localStorage.setItem("clientEmail", email);
          if (phone) localStorage.setItem("clientPhone", phone);
          else localStorage.removeItem("clientPhone");

          // also set axios headers directly for immediate requests
          if ((api as any).defaults && (api as any).defaults.headers) {
            (api as any).defaults.headers.common["x-clerk-id"] = clerkId;
            if (email)
              (api as any).defaults.headers.common["x-user-email"] = email;
            if (phone)
              (api as any).defaults.headers.common["x-user-phone"] = phone;
            else delete (api as any).defaults.headers.common["x-user-phone"];
          }

          // call server to upsert client
          await api.post("/clients/sync", {
            clerkId,
            email,
            name,
            phone,
          });
        } catch (err) {
          console.error("Failed to sync clerk -> client:", err);
        }
      }
    };

    doSync();
  }, [user]);

  return null;
}
