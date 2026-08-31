import React, { useState, useEffect, useRef, useCallback } from "react";

export type MpesaModalState =
  "IDLE" | "INITIATING" | "PENDING_PIN" | "SUCCESS" | "FAILED" | "TIMEOUT";

export interface MpesaStkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amountKES: number;
  purpose:
    "SUBSCRIPTION_RENEWAL" | "LEAD_CREDIT_PURCHASE" | "BOOST_PURCHASE" | string;
  initialPhone?: string;
  onInitiateCheckout: (
    phoneNumber: string,
  ) => Promise<{ checkoutRequestId: string; error?: string } | null>;
  onPollStatus?: (checkoutRequestId: string) => Promise<{
    status: "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT";
    resultDesc?: string;
  }>;
  onSuccess?: () => void;
  pollIntervalMs?: number;
  timeoutSeconds?: number;
}

export function validateKenyanPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return (
    /^(\+?254|0)(7|1)\d{8}$/.test(cleaned) || /^254(7|1)\d{8}$/.test(cleaned)
  );
}

/**
 * MpesaStkModal provides a unified M-Pesa STK Push state machine
 * with phone validation, prompt notification, polling, timeout, and retry handling.
 */
export const MpesaStkModal: React.FC<MpesaStkModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  amountKES,
  purpose,
  initialPhone = "",
  onInitiateCheckout,
  onPollStatus,
  onSuccess,
  pollIntervalMs = 3000,
  timeoutSeconds = 60,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [phoneError, setPhoneError] = useState("");
  const [state, setState] = useState<MpesaModalState>("IDLE");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState(timeoutSeconds);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber(initialPhone);
      setState("IDLE");
      setPhoneError("");
      setErrorMessage("");
      setCountdown(timeoutSeconds);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
  }, [isOpen, initialPhone, timeoutSeconds]);

  const stopTimers = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  const handleStartPolling = useCallback(
    (id: string) => {
      let elapsedSeconds = 0;

      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            stopTimers();
            setState("TIMEOUT");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      pollTimerRef.current = setInterval(async () => {
        elapsedSeconds += pollIntervalMs / 1000;
        if (!onPollStatus) return;

        try {
          const res = await onPollStatus(id);
          if (res.status === "SUCCESS") {
            stopTimers();
            setState("SUCCESS");
            if (onSuccess) onSuccess();
          } else if (res.status === "FAILED") {
            stopTimers();
            setState("FAILED");
            setErrorMessage(
              res.resultDesc || "M-Pesa transaction was declined or canceled.",
            );
          } else if (
            res.status === "TIMEOUT" ||
            elapsedSeconds >= timeoutSeconds
          ) {
            stopTimers();
            setState("TIMEOUT");
          }
        } catch {
          // Keep polling until countdown expires
        }
      }, pollIntervalMs);
    },
    [onPollStatus, onSuccess, pollIntervalMs, stopTimers, timeoutSeconds],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateKenyanPhone(phoneNumber)) {
      setPhoneError(
        "Please enter a valid Safaricom number (e.g. 0712345678 or 254712345678)",
      );
      return;
    }
    setPhoneError("");
    setState("INITIATING");
    setErrorMessage("");

    try {
      const res = await onInitiateCheckout(phoneNumber);
      if (!res || res.error || !res.checkoutRequestId) {
        setState("FAILED");
        setErrorMessage(
          res?.error ||
            "Failed to initiate M-Pesa STK Push. Please verify the phone number.",
        );
        return;
      }

      setCheckoutRequestId(res.checkoutRequestId);
      setState("PENDING_PIN");
      setCountdown(timeoutSeconds);
      handleStartPolling(res.checkoutRequestId);
    } catch (err) {
      setState("FAILED");
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }
  };

  const handleRetry = () => {
    stopTimers();
    setState("IDLE");
    setErrorMessage("");
    setCountdown(timeoutSeconds);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mpesa-modal-title"
    >
      <div className="w-full max-w-md bg-[#FAF9F5] border border-[#DFDACB] rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Header with Blueprint chrome */}
        <div className="bg-[#16233B] text-[#FAF9F5] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#3F6B4E] flex items-center justify-center font-bold text-base">
              M
            </div>
            <div>
              <h3
                id="mpesa-modal-title"
                className="font-bold text-sm tracking-tight text-white"
              >
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-neutral-300">{subtitle}</p>
              )}
            </div>
          </div>

          {state !== "PENDING_PIN" && state !== "INITIATING" && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-1"
              aria-label="Close modal"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* STATE 1: IDLE / INPUT */}
          {state === "IDLE" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-[#F0EFEB] rounded-lg border border-[#DFDACB] flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-600">
                  Total Payable
                </span>
                <span className="text-lg font-black text-[#16233B] font-mono">
                  KES {amountKES.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Safaricom M-Pesa Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (phoneError) setPhoneError("");
                    }}
                    placeholder="0712345678 or 254712345678"
                    className="w-full px-3 py-2 bg-white border border-[#DFDACB] rounded font-mono text-sm focus:outline-none focus:border-[#16233B] focus:ring-1 focus:ring-[#16233B]"
                    autoFocus
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-[#A8452B] font-medium mt-1">
                    {phoneError}
                  </p>
                )}
                <p className="text-[11px] text-neutral-500 mt-1">
                  An instant M-Pesa PIN prompt will be sent to this phone.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 px-4 py-2 border border-[#DFDACB] rounded text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 px-4 py-2 bg-[#3F6B4E] hover:bg-[#32563E] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Pay KES {amountKES.toLocaleString()}
                </button>
              </div>
            </form>
          )}

          {/* STATE 2: INITIATING */}
          {state === "INITIATING" && (
            <div className="py-8 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-[#16233B] border-t-transparent rounded-full animate-spin" />
              <h4 className="text-sm font-bold text-[#16233B]">
                Connecting to Safaricom Daraja...
              </h4>
              <p className="text-xs text-neutral-500">
                Sending prompt to {phoneNumber}
              </p>
            </div>
          )}

          {/* STATE 3: PENDING PIN (MUST-FIX: PROMINENT PHONE PROMPT STATE) */}
          {state === "PENDING_PIN" && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#EAF4EE] border-2 border-[#3F6B4E] flex items-center justify-center animate-pulse">
                <svg
                  className="w-7 h-7 text-[#3F6B4E]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-[#16233B]">
                  Check your phone now
                </h4>
                <p className="text-xs text-neutral-600 mt-1 max-w-xs mx-auto">
                  A prompt for{" "}
                  <strong className="text-[#16233B]">
                    KES {amountKES.toLocaleString()}
                  </strong>{" "}
                  has been sent to{" "}
                  <strong className="font-mono text-[#16233B]">
                    {phoneNumber}
                  </strong>
                  . Enter your M-Pesa PIN to complete payment.
                </p>
              </div>

              <div className="p-3 bg-[#FAF9F5] border border-[#DFDACB] rounded-lg inline-flex items-center gap-2 font-mono text-xs text-neutral-600">
                <span className="w-2 h-2 rounded-full bg-[#3F6B4E] animate-ping" />
                Waiting for Safaricom confirmation... ({countdown}s)
              </div>

              <div className="text-[11px] text-neutral-400">
                Do not refresh or close this tab while waiting.
              </div>
            </div>
          )}

          {/* STATE 4: SUCCESS */}
          {state === "SUCCESS" && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#EAF4EE] border-2 border-[#3F6B4E] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#3F6B4E]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-[#16233B]">
                  Payment Received!
                </h4>
                <p className="text-xs text-neutral-600 mt-1">
                  KES {amountKES.toLocaleString()} confirmed via M-Pesa. Your{" "}
                  {purpose.toLowerCase().replace(/_/g, " ")} is now active.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-[#16233B] hover:bg-[#233557] text-[#FAF9F5] rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* STATE 5: FAILED */}
          {state === "FAILED" && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#FDF2F0] border-2 border-[#A8452B] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#A8452B]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-[#A8452B]">
                  Payment Not Completed
                </h4>
                <p className="text-xs text-neutral-600 mt-1 max-w-xs mx-auto">
                  {errorMessage ||
                    "The transaction was canceled, timed out, or entered an incorrect PIN."}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 px-4 py-2 border border-[#DFDACB] rounded text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-2/3 px-4 py-2 bg-[#A8452B] hover:bg-[#8C3620] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Retry Payment
                </button>
              </div>
            </div>
          )}

          {/* STATE 6: TIMEOUT (MUST-FIX: CLEAR RECONCILIATION GUIDANCE) */}
          {state === "TIMEOUT" && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#FFF8E6] border-2 border-[#D97706] flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-[#D97706]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-[#16233B]">
                  Confirmation Taking Longer Than Usual
                </h4>
                <p className="text-xs text-neutral-600 mt-1 max-w-xs mx-auto">
                  If you entered your M-Pesa PIN, your payment will
                  automatically settle via background reconciliation within a
                  few minutes. You don&apos;t need to pay again.
                </p>
                {checkoutRequestId && (
                  <p className="text-[10px] font-mono text-neutral-400 mt-2">
                    Tracking Ref: {checkoutRequestId}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 px-4 py-2 bg-[#16233B] hover:bg-[#233557] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  I&apos;ll Check Later
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="w-1/2 px-4 py-2 border border-[#DFDACB] hover:bg-neutral-100 text-neutral-800 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
