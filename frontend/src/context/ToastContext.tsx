"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  confirmModal: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, title }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, title?: string) => addToast("success", msg, title || "Success"),
    error: (msg: string, title?: string) => addToast("error", msg, title || "Error"),
    warning: (msg: string, title?: string) => addToast("warning", msg, title || "Warning"),
    info: (msg: string, title?: string) => addToast("info", msg, title || "Notice"),
  };

  const confirmModal = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve: (val: boolean) => {
          setConfirmState(null);
          resolve(val);
        },
      });
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirmModal }}>
      {children}

      {/* Floating Toast Stack */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const config = {
            success: {
              bg: "bg-emerald-50 border-emerald-300 text-emerald-900",
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
              bar: "bg-emerald-500",
            },
            error: {
              bg: "bg-rose-50 border-rose-300 text-rose-900",
              icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
              bar: "bg-rose-500",
            },
            warning: {
              bg: "bg-amber-50 border-amber-300 text-amber-900",
              icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
              bar: "bg-amber-500",
            },
            info: {
              bg: "bg-blue-50 border-blue-300 text-blue-900",
              icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
              bar: "bg-blue-500",
            },
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${config.bg}`}
            >
              {config.icon}
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-sm font-bold tracking-tight">{t.title}</p>}
                <p className="text-xs mt-0.5 leading-relaxed break-words">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0 text-current opacity-70 hover:opacity-100"
                aria-label={`Dismiss notification: ${t.title || t.message}`}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => confirmState.resolve(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-description"
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 z-10 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  confirmState.options.variant === "danger"
                    ? "bg-rose-100 text-rose-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                <AlertTriangle className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 id="confirm-modal-title" className="text-lg font-bold text-gray-900">
                  {confirmState.options.title || "Confirmation"}
                </h3>
                <p id="confirm-modal-description" className="text-sm text-gray-600 mt-1 whitespace-pre-line leading-relaxed">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {confirmState.options.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${
                  confirmState.options.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {confirmState.options.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
