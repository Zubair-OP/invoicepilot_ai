"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                Invoice<span className="text-green-600">Pilot</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 mb-4">
              Professional invoicing for freelancers and businesses. Fast, clean, and compliant.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Product</h3>
            <ul className="space-y-2">
              <li><Link href="/#features" className="text-sm text-gray-500 hover:text-gray-900">Features</Link></li>
              <li><Link href="/#pricing" className="text-sm text-gray-500 hover:text-gray-900">Pricing</Link></li>
              <li><Link href="/templates" className="text-sm text-gray-500 hover:text-gray-900">Templates</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Company</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-gray-500 hover:text-gray-900">About</Link></li>
              <li><Link href="/contact" className="text-sm text-gray-500 hover:text-gray-900">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Invoice Pilot. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
