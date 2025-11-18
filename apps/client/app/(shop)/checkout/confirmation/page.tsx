"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCartStore } from "@/stores/cartStore";

export default function ConfirmationPage() {
  const { clearCart } = useCartStore();

  useEffect(() => {
    // Clear cart after successful order
    clearCart();
  }, [clearCart]);

  return (
    <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-gray-600">
          Thank you for your purchase. Your order has been received and is being
          processed.
        </p>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg mb-8 text-left">
        <h2 className="font-bold mb-2">What's Next?</h2>
        <ul className="space-y-2 text-gray-600">
          <li>• You'll receive an order confirmation email shortly</li>
          <li>• We'll notify you when your order ships</li>
          <li>• Track your order status in your account</li>
        </ul>
      </div>

      <div className="flex gap-4 justify-center">
        <Link
          href="/(shop)/orders"
          className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
        >
          View Orders
        </Link>
        <Link
          href="/(marketplace)/products"
          className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

