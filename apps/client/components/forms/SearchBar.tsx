"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

const SearchBar = () => {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const response = await fetch(
        `api/search/autocomplete?q=${encodeURIComponent(query)}&type=all&limit=5`
      );
      const data = await response.json();

      if (data.success) {
        const allSuggestions = [
          ...(data.data.professionals || []),
          ...(data.data.stores || []),
          ...(data.data.products || []),
        ];
        setSuggestions(allSuggestions);
        setShowSuggestions(true);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("search", value);
    router.push(`/products?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="hidden sm:flex items-center gap-2 rounded-md ring-1 ring-gray-200 px-2 py-1 shadow-md">
      <Search className="w-4 h-4 text-gray-500" />
      <input
        id="search"
        type="text"
        value={query}
        placeholder="Search..."
        className="w-full px-4 py-2 border rounded-lg"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSearch(value);
          }
        }}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-50">
        {suggestions.map((item: any, index) => (
          <div
            key={index}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            onClick={() => {
              setQuery(item.name || item.title);
              setShowSuggestions(false);
            }}
          >
            <div className="font-medium">{item.name || item.title}</div>
            {item.rating && (
              <div className="text-sm text-gray-500">
                ⭐ {item.rating}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
};

export default SearchBar;