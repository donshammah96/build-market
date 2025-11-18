"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/stores/cartStore";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-gray-600 mb-8">
          Add some items to your cart to get started
        </p>
        <Link
          href="/(marketplace)/products"
          className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 border-b border-gray-200 py-4"
            >
              <div className="w-24 h-24 bg-gray-200 rounded-lg"></div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.name}</h3>
                <p className="text-gray-600">${item.price}</p>
                
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-2 py-1 border rounded"
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2 py-1 border rounded"
                    >
                      +
                    </button>
                  </div>
                  
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              
              <div className="font-semibold">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-gray-50 p-6 rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4">Order Summary</h2>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${getTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
          </div>
          
          <div className="border-t border-gray-300 pt-4 mb-6">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${getTotal().toFixed(2)}</span>
            </div>
          </div>
          
          <Link
            href="/(shop)/checkout"
            className="block w-full bg-black text-white text-center px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}

