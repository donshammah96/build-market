import React from "react";

export interface LeadCreditWalletProps {
  balance: number;
  discountPct?: number;
  unitPriceKES?: number;
  onBuyCreditsClick?: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * LeadCreditWallet displays marketplace lead credits balance, active discount,
 * and purchase triggers for M-Pesa STK top-up.
 */
export const LeadCreditWallet: React.FC<LeadCreditWalletProps> = ({
  balance,
  discountPct = 0,
  unitPriceKES = 500,
  onBuyCreditsClick,
  isLoading = false,
  className = "",
}) => {
  const isLowBalance = balance <= 1;
  const discountedPrice = Math.round(unitPriceKES * (1 - discountPct / 100));

  return (
    <div
      className={`p-4 rounded-lg border border-[#DFDACB] bg-[#FAF9F5] flex flex-col gap-3 font-sans ${className}`}
      aria-label={`Lead credits balance: ${balance} credits available`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#16233B] text-[#FAF9F5] flex items-center justify-center font-bold text-sm font-mono">
            LC
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-500 block">
              Lead Credit Wallet
            </span>
            <span className="text-xl font-extrabold text-[#16233B] font-mono">
              {isLoading ? "..." : balance}{" "}
              <span className="text-xs font-normal text-neutral-500">
                Credits
              </span>
            </span>
          </div>
        </div>

        {discountPct > 0 && (
          <span className="px-2 py-0.5 text-[11px] font-bold text-[#3F6B4E] bg-[#EAF4EE] border border-[#BDE0CB] rounded">
            {discountPct}% Plan Discount
          </span>
        )}
      </div>

      <div className="text-xs text-neutral-600 flex items-center justify-between border-t border-[#EAE6DC] pt-2">
        <span>Standard Rate: KES {unitPriceKES} / credit</span>
        {discountPct > 0 && (
          <span className="font-semibold text-[#16233B]">
            Your Rate: KES {discountedPrice}
          </span>
        )}
      </div>

      {isLowBalance && (
        <div className="text-[11px] font-medium text-[#A8452B] bg-[#FDF2F0] p-1.5 rounded border border-[#F5C2BC]">
          ⚠️ Low credits balance. Top up to instantly receive high-confidence
          lead matches.
        </div>
      )}

      {onBuyCreditsClick && (
        <button
          type="button"
          onClick={onBuyCreditsClick}
          className="w-full mt-1 px-3 py-2 bg-[#A8452B] hover:bg-[#8C3620] text-[#FAF9F5] text-xs font-bold uppercase tracking-wider rounded transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Buy Lead Credits
        </button>
      )}
    </div>
  );
};
