"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_MAP: Record<string, string> = {
  buy: "SALE",
  rent: "RENT",
  commercial: "LEASE",
};

/**
 * Interactive search / filter hero for the properties landing page.
 * Extracted as a client component so that the parent page can remain
 * a Server Component.
 */
export default function PropertySearchHero() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("buy");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const type = TYPE_MAP[activeTab];
    if (type) params.set("type", type);
    if (category) params.set("category", category);
    const qs = params.toString();
    router.push(qs ? `/properties?${qs}` : "/properties");
  }, [activeTab, search, category, router]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="bg-white p-2 rounded-2xl shadow-2xl max-w-3xl mx-auto"
    >
      <Tabs defaultValue="buy" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-2 bg-zinc-100/50 p-1">
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="rent">Rent</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
        </TabsList>

        <div className="flex flex-col md:flex-row gap-2 p-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
            <Input
              placeholder="City, Neighborhood, or Address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 h-12 border-zinc-200 bg-zinc-50 focus:bg-white transition-colors"
            />
          </div>
          <div className="w-full md:w-48">
            <Select onValueChange={setCategory}>
              <SelectTrigger className="h-12 border-zinc-200 bg-zinc-50">
                <SelectValue placeholder="Property Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESIDENTIAL">House</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="LAND">Land</SelectItem>
                <SelectItem value="INDUSTRIAL">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="lg"
            onClick={handleSearch}
            className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            Search
          </Button>
        </div>
      </Tabs>
    </motion.div>
  );
}
