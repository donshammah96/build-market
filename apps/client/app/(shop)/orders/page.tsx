"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Order {
  id: string;
  date: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
  items: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch orders from order-service
    // Mock data for now
    setTimeout(() => {
      setOrders([
        {
          id: "ORD-001",
          date: "2024-10-28",
          status: "delivered",
          total: 1299.99,
          items: 3,
        },
        {
          id: "ORD-002",
          date: "2024-10-30",
          status: "shipped",
          total: 599.50,
          items: 2,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold mb-4">No orders yet</h2>
          <p className="text-gray-600 mb-8">
            When you place orders, they will appear here
          </p>
          <Link
            href="/(marketplace)/products"
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 inline-block"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/(shop)/orders/${order.id}`}
              className="block border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{order.id}</h3>
                  <p className="text-gray-600 text-sm">
                    Placed on {new Date(order.date).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    order.status
                  )}`}
                >
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-gray-600">
                  {order.items} {order.items === 1 ? "item" : "items"}
                </p>
                <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

