"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Loading from "@/components/ui/Loading";

function BillingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams ? searchParams.toString() : "";
    const target = query ? `/dashboard/billing?${query}` : "/dashboard/billing";
    router.replace(target);
  }, [router, searchParams]);

  return <Loading size="lg" text="Redirecting to Billing..." />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Loading size="lg" text="Redirecting to Billing..." />}>
      <BillingRedirect />
    </Suspense>
  );
}
