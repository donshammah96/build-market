"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface OrderDetails {
  id: string;
  date: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  shipping: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  trackingNumber?: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch order details from order-service
    // Mock data for now
    setTimeout(() => {
      setOrder({
        id: params.id as string,
        date: "2024-10-28",
        status: "delivered",
        total: 1299.99,
        items: [
          { id: "1", name: "Modern Sofa", price: 899.99, quantity: 1 },
          { id: "2", name: "Coffee Table", price: 299.99, quantity: 1 },
          { id: "3", name: "Table Lamp", price: 100.00, quantity: 1 },
        ],
        shipping: {
          name: "John Doe",
          address: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zipCode: "94102",
        },
        trackingNumber: "1Z999AA10123456784",
      });
      setLoading(false);
    }, 1000);
  }, [params.id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Order not found</h1>
        <Link href="/(shop)/orders" className="text-blue-600 hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/(shop)/orders"
        className="text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Back to orders
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Order {order.id}</h1>
        <p className="text-gray-600">
          Placed on {new Date(order.date).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Status */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="font-bold text-xl mb-4">Order Status</h2>
            <div className="flex items-center gap-4">
              <div
                className={`px-4 py-2 rounded-full font-medium ${
                  order.status === "delivered"
                    ? "bg-green-100 text-green-800"
                    : order.status === "shipped"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </div>
              {order.trackingNumber && (
                <div className="text-sm">
                  <span className="text-gray-600">Tracking: </span>
                  <span className="font-mono">{order.trackingNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="font-bold text-xl mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-gray-600 text-sm">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-bold mb-4">Shipping Address</h3>
            <div className="text-gray-700">
              <p>{order.shipping.name}</p>
              <p>{order.shipping.address}</p>
              <p>
                {order.shipping.city}, {order.shipping.state}{" "}
                {order.shipping.zipCode}
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-bold mb-4">Order Summary</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span>$0.00</span>
              </div>
            </div>
            <div className="border-t border-gray-300 pt-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button className="w-full bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800">
              Track Package
            </button>
            <button className="w-full border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

