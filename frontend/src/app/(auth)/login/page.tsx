"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { FileText } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-gray-900">
          Invoice<span className="text-green-600">Pilot</span>
        </span>
      </Link>
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full shadow-lg",
            },
          }}
          routing="hash"
          signUpUrl="/register"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
