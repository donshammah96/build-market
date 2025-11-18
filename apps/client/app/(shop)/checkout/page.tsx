"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cartStore";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotal } = useCartStore();
  const [step, setStep] = useState<"shipping" | "payment" | "review">("shipping");

  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
  });

  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    nameOnCard: "",
  });

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("payment");
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("review");
  };

  const handlePlaceOrder = async () => {
    // TODO: Integrate with payment-service and order-service
    console.log("Order placed:", { shippingInfo, paymentInfo, items });
    router.push("/(shop)/checkout/confirmation");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      {/* Progress Steps */}
      <div className="flex justify-center mb-12">
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 ${
              step === "shipping" ? "text-black font-bold" : "text-gray-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === "shipping" ? "bg-black text-white" : "bg-gray-200"
              }`}
            >
              1
            </div>
            <span>Shipping</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <div
            className={`flex items-center gap-2 ${
              step === "payment" ? "text-black font-bold" : "text-gray-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === "payment" ? "bg-black text-white" : "bg-gray-200"
              }`}
            >
              2
            </div>
            <span>Payment</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300"></div>
          <div
            className={`flex items-center gap-2 ${
              step === "review" ? "text-black font-bold" : "text-gray-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === "review" ? "bg-black text-white" : "bg-gray-200"
              }`}
            >
              3
            </div>
            <span>Review</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Shipping Form */}
          {step === "shipping" && (
            <form onSubmit={handleShippingSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold">Shipping Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={shippingInfo.fullName}
                  onChange={(e) =>
                    setShippingInfo({ ...shippingInfo, fullName: e.target.value })
                  }
                />
                <input
                  type="email"
                  placeholder="Email"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={shippingInfo.email}
                  onChange={(e) =>
                    setShippingInfo({ ...shippingInfo, email: e.target.value })
                  }
                />
              </div>
              
              <input
                type="text"
                placeholder="Street Address"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                value={shippingInfo.address}
                onChange={(e) =>
                  setShippingInfo({ ...shippingInfo, address: e.target.value })
                }
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="City"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={shippingInfo.city}
                  onChange={(e) =>
                    setShippingInfo({ ...shippingInfo, city: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="State"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={shippingInfo.state}
                  onChange={(e) =>
                    setShippingInfo({ ...shippingInfo, state: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={shippingInfo.zipCode}
                  onChange={(e) =>
                    setShippingInfo({ ...shippingInfo, zipCode: e.target.value })
                  }
                />
              </div>
              
              <input
                type="tel"
                placeholder="Phone Number"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                value={shippingInfo.phone}
                onChange={(e) =>
                  setShippingInfo({ ...shippingInfo, phone: e.target.value })
                }
              />
              
              <button
                type="submit"
                className="w-full bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
              >
                Continue to Payment
              </button>
            </form>
          )}

          {/* Payment Form */}
          {step === "payment" && (
            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold">Payment Information</h2>
              
              <input
                type="text"
                placeholder="Card Number"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                value={paymentInfo.cardNumber}
                onChange={(e) =>
                  setPaymentInfo({ ...paymentInfo, cardNumber: e.target.value })
                }
              />
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="MM/YY"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={paymentInfo.expiryDate}
                  onChange={(e) =>
                    setPaymentInfo({ ...paymentInfo, expiryDate: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="CVV"
                  required
                  className="border border-gray-300 rounded-lg px-4 py-2"
                  value={paymentInfo.cvv}
                  onChange={(e) =>
                    setPaymentInfo({ ...paymentInfo, cvv: e.target.value })
                  }
                />
              </div>
              
              <input
                type="text"
                placeholder="Name on Card"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                value={paymentInfo.nameOnCard}
                onChange={(e) =>
                  setPaymentInfo({ ...paymentInfo, nameOnCard: e.target.value })
                }
              />
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep("shipping")}
                  className="flex-1 border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
                >
                  Review Order
                </button>
              </div>
            </form>
          )}

          {/* Review & Place Order */}
          {step === "review" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Review Your Order</h2>
              
              <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                <div>
                  <h3 className="font-bold mb-2">Shipping Address</h3>
                  <p>{shippingInfo.fullName}</p>
                  <p>{shippingInfo.address}</p>
                  <p>
                    {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
                  </p>
                  <p>{shippingInfo.phone}</p>
                </div>
                
                <div>
                  <h3 className="font-bold mb-2">Payment Method</h3>
                  <p>•••• •••• •••• {paymentInfo.cardNumber.slice(-4)}</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep("payment")}
                  className="flex-1 border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  className="flex-1 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
                >
                  Place Order
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 p-6 rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4">Order Summary</h2>
          
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} x {item.quantity}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-300 pt-4">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${getTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

