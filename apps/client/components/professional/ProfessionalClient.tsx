"use client";

import { useEffect, useState } from "react";
import { Professionals } from "./Professionals";
import { ProfessionalCardData } from "../../types/professional";
import { getProfessionals } from "../../app/lib/actions";

export function ProfessionalsClient() {
  const [professionals, setProfessionals] = useState<ProfessionalCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfessionals() {
      try {
        const data = await getProfessionals(4, true);
        setProfessionals(data as ProfessionalCardData[]);
      } catch (error) {
        console.error("Error fetching professionals:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfessionals();
  }, []);

  if (loading) {
    return (
      <section id="professionals" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-slate-500">Loading professionals...</div>
        </div>
      </section>
    );
  }

  return <Professionals professionals={professionals} showViewAll={true} />;
}