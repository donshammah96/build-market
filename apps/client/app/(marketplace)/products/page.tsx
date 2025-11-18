"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  rating: number;
  reviews: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    "all",
    "furniture",
    "lighting",
    "hardware",
    "flooring",
    "paint",
    "plumbing",
  ];

  useEffect(() => {
    // TODO: Fetch products from search-service
    // Mock data for now
    setTimeout(() => {
      setProducts([
        {
          id: "1",
          name: "Modern Sofa",
          price: 899.99,
          category: "furniture",
          rating: 4.5,
          reviews: 128,
        },
        {
          id: "2",
          name: "LED Pendant Light",
          price: 149.99,
          category: "lighting",
          rating: 4.8,
          reviews: 89,
        },
        {
          id: "3",
          name: "Oak Hardwood Flooring",
          price: 5.99,
          category: "flooring",
          rating: 4.6,
          reviews: 234,
        },
        {
          id: "4",
          name: "Cabinet Hardware Set",
          price: 29.99,
          category: "hardware",
          rating: 4.3,
          reviews: 56,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Shop Products</h1>

      {/* Category Filter */}
      <div className="mb-8">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                selectedCategory === category
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-64 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/(marketplace)/products/${product.id}`}
              className="group"
            >
              <div className="bg-gray-200 h-64 rounded-lg mb-4 flex items-center justify-center group-hover:shadow-lg transition-shadow">
                <span className="text-gray-400">Product Image</span>
              </div>
              
              <h3 className="font-semibold text-lg mb-1 group-hover:text-blue-600">
                {product.name}
              </h3>
              
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center text-yellow-500">
                  <span className="text-sm">★</span>
                  <span className="text-sm ml-1">{product.rating}</span>
                </div>
                <span className="text-gray-500 text-sm">
                  ({product.reviews} reviews)
                </span>
              </div>
              
              <p className="font-bold text-xl">${product.price}</p>
            </Link>
          ))}
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="text-gray-600">
            No products found in this category.
          </p>
        </div>
      )}
    </div>
  );
}

