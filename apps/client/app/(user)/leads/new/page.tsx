"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Upload,
  Sparkles,
  ShieldCheck,
  Building2,
  MapPin,
  Coins,
  FileCheck,
  Loader2,
  HardHat,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import {
  scoreLeadV3,
  type LandOwnershipStatus,
  type ArchitecturalStage,
  type BudgetReadiness,
} from "@build/lead-qualification";
import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  useCreateMarketplaceLead,
  useUpdateMarketplaceQualification,
  useAttachMarketplaceLeadDocument,
  useSubmitMarketplaceLead,
} from "@/hooks/useMarketplaceLeads";

const KENYAN_COUNTIES = [
  "Nairobi",
  "Kiambu",
  "Machakos",
  "Kajiado",
  "Mombasa",
  "Kilifi",
  "Nakuru",
  "Uasin Gishu",
  "Kisumu",
  "Nyeri",
  "Meru",
  "Laikipia",
  "Murang'a",
  "Kakamega",
  "Trans Nzoia",
  "Kwale",
];

const PROJECT_TYPES = [
  {
    id: "residential_villa",
    label: "Residential Villa / Maisonette",
    icon: Building2,
    desc: "Stand-alone multi-room home",
  },
  {
    id: "residential_bungalow",
    label: "Bungalow",
    icon: Building2,
    desc: "Single-story family home",
  },
  {
    id: "commercial_apartments",
    label: "Apartment Building / Multi-Unit",
    icon: Building2,
    desc: "Rental units / high density",
  },
  {
    id: "renovation_extension",
    label: "Renovation & Extension",
    icon: HardHat,
    desc: "Remodeling or adding floors",
  },
  {
    id: "commercial_retail",
    label: "Commercial Office / Retail",
    icon: Building2,
    desc: "Shop, godown, or office space",
  },
];

const LAND_STATUS_OPTIONS: Array<{
  id: LandOwnershipStatus;
  label: string;
  score: string;
  desc: string;
}> = [
  {
    id: "OWNED_TITLED",
    label: "Title Deed in Hand (Clean Freehold / Leasehold)",
    score: "High Confidence",
    desc: "You have verified registered ownership in your name",
  },
  {
    id: "OWNED_ALLOTMENT_LETTER",
    label: "Allotment Letter / Share Certificate",
    score: "Medium Confidence",
    desc: "Plot allotment from county or registered housing scheme",
  },
  {
    id: "PURCHASING_IN_PROGRESS",
    label: "Sale Agreement Executed (Under Transfer)",
    score: "Medium Confidence",
    desc: "Purchase process active with deposit paid",
  },
  {
    id: "FAMILY_LAND",
    label: "Family / Ancestral Land (Succession in progress)",
    score: "Medium Confidence",
    desc: "Family land being surveyed or in succession court process",
  },
  {
    id: "NONE",
    label: "Currently Searching for Land to Buy",
    score: "Low Confidence",
    desc: "Not yet acquired land for the project",
  },
];

const ARCHITECTURAL_STAGE_OPTIONS: Array<{
  id: ArchitecturalStage;
  label: string;
  desc: string;
}> = [
  {
    id: "COUNTY_APPROVED",
    label: "Fully Approved Architectural & Structural Drawings",
    desc: "Ready for contractor mobilization with county stamped permits",
  },
  {
    id: "APPROVED_DRAWINGS",
    label: "Drawings Complete — Under County Review",
    desc: "Architectural & engineering plans submitted for approval",
  },
  {
    id: "CONCEPT_ONLY",
    label: "Concept Sketches / Planning Phase",
    desc: "Initial layout or working with an architect on concept",
  },
  {
    id: "NO_PLANS",
    label: "No Drawings — Need Architectural Design First",
    desc: "Looking for an architect/designer to start from scratch",
  },
];

const BUDGET_READINESS_OPTIONS: Array<{
  id: BudgetReadiness;
  label: string;
  desc: string;
}> = [
  {
    id: "PROOF_OF_FUNDS",
    label: "100% Cash / Equity Ready (Proof of Funds)",
    desc: "Funds allocated and ready for milestone disbursements",
  },
  {
    id: "FINANCING_APPROVED",
    label: "Bank Construction Mortgage Pre-Approved",
    desc: "Formal bank commitment letter in place",
  },
  {
    id: "FINANCING_PENDING",
    label: "Sacco Loan / Phased Savings Plan",
    desc: "Financing will be drawn in construction stages",
  },
  {
    id: "SELF_DECLARED_WITH_RANGE",
    label: "Self-Declared Target Budget Range",
    desc: "Estimated budget range specified by homeowner",
  },
  {
    id: "UNVERIFIED_ESTIMATE",
    label: "Exploring Costs & Quotations First",
    desc: "Looking for initial Bill of Quantities / estimates",
  },
];

export default function NewMarketplaceLeadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

  // Form State
  const [projectCounty, setProjectCounty] = useState("Nairobi");
  const [projectType, setProjectType] = useState("residential_villa");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [landStatus, setLandStatus] =
    useState<LandOwnershipStatus>("OWNED_TITLED");
  const [architecturalStage, setArchitecturalStage] =
    useState<ArchitecturalStage>("CONCEPT_ONLY");
  const [budgetReadiness, setBudgetReadiness] =
    useState<BudgetReadiness>("PROOF_OF_FUNDS");
  const [budgetMin, setBudgetMin] = useState("5000000");
  const [budgetMax, setBudgetMax] = useState("15000000");

  const [uploadedDocs, setUploadedDocs] = useState<
    Array<{ type: string; name: string; fileKey: string; scanStatus: string }>
  >([]);

  // Mutations
  const createLeadMutation = useCreateMarketplaceLead();
  const updateQualMutation = useUpdateMarketplaceQualification();
  const attachDocMutation = useAttachMarketplaceLeadDocument();
  const submitLeadMutation = useSubmitMarketplaceLead();

  // Real-time pure scoring calculation preview
  const liveScore = useMemo(() => {
    return scoreLeadV3({
      landOwnershipStatus: landStatus,
      landOwnershipVerified: uploadedDocs.some((d) => d.scanStatus === "clean"),
      architecturalStage,
      budgetReadiness,
      budgetRangeMin: Number(budgetMin) || 0,
      budgetRangeMax: Number(budgetMax) || 0,
      projectType,
    });
  }, [
    landStatus,
    architecturalStage,
    budgetReadiness,
    budgetMin,
    budgetMax,
    projectType,
    uploadedDocs,
  ]);

  // Step 1 Submission: Create Draft Lead
  const handleStep1Next = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title for your project");
      return;
    }

    if (!createdLeadId) {
      createLeadMutation.mutate(
        {
          input: {
            projectCounty,
            projectType,
            title,
            description:
              description || "Homeowner construction project inquiry",
          },
        },
        {
          onSuccess: (data) => {
            setCreatedLeadId(data.leadId);
            setStep(2);
          },
          onError: (err) => {
            toast.error(err.message || "Failed to initialize project intake");
          },
        },
      );
    } else {
      setStep(2);
    }
  };

  // Step 2 & 3 & 4 Navigation
  const handleSaveQualificationStep = async (nextStepNumber: number) => {
    if (!createdLeadId) return;

    updateQualMutation.mutate(
      {
        leadId: createdLeadId,
        input: {
          landOwnershipStatus: landStatus,
          architecturalStage,
          budgetReadiness,
          budgetRangeMin: Number(budgetMin) || undefined,
          budgetRangeMax: Number(budgetMax) || undefined,
        },
      },
      {
        onSuccess: () => {
          setStep(nextStepNumber);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to update project details");
        },
      },
    );
  };

  // Step 5: Document Upload Simulation
  const handleSimulateDocUpload = (
    type: "TITLE_DEED" | "APPROVED_DRAWINGS" | "PROOF_OF_FUNDS",
  ) => {
    if (!createdLeadId) return;

    const mockFileKey = `marketplace/${createdLeadId}/${type.toLowerCase()}_${Date.now()}.pdf`;
    const docName =
      type === "TITLE_DEED"
        ? "Title_Deed_Certificate.pdf"
        : type === "APPROVED_DRAWINGS"
          ? "Architectural_Drawings_v2.pdf"
          : "Proof_of_Funds_Bank_Letter.pdf";

    attachDocMutation.mutate(
      {
        leadId: createdLeadId,
        input: {
          type,
          fileKey: mockFileKey,
        },
      },
      {
        onSuccess: (res) => {
          setUploadedDocs((prev) => [
            ...prev,
            {
              type,
              name: docName,
              fileKey: mockFileKey,
              scanStatus: res.scanStatus,
            },
          ]);
          toast.success(`${docName} uploaded & virus scan initiated`);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to attach document");
        },
      },
    );
  };

  // Step 6: Final Submission
  const handleFinalSubmit = () => {
    if (!createdLeadId) return;

    submitLeadMutation.mutate(
      { leadId: createdLeadId },
      {
        onSuccess: () => {
          toast.success("Project qualified and submitted successfully!");
          router.push(`/leads/${createdLeadId}`);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to submit project");
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col justify-between">
      <div>
        <ClientNavbar />
        <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/leads"
              className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to My Projects
            </Link>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                  New Construction Project Intake
                </h1>
                <p className="text-zinc-600 mt-1">
                  Qualify your construction project to get matched with verified
                  architects, engineers, and general contractors.
                </p>
              </div>
              {/* Readiness Score Pill Widget */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                <div className="text-right">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    AI Readiness Score
                  </div>
                  <div className="text-lg font-bold text-zinc-900 flex items-center justify-end gap-1.5">
                    <span>{Math.round(liveScore.confidenceScore * 100)}%</span>
                    <Badge
                      variant={
                        liveScore.confidenceLabel === "high"
                          ? "default"
                          : liveScore.confidenceLabel === "medium"
                            ? "secondary"
                            : "outline"
                      }
                      className="capitalize text-xs font-semibold"
                    >
                      {liveScore.confidenceLabel}
                    </Badge>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Header */}
          <div className="grid grid-cols-6 gap-2 mb-8 text-center text-xs font-medium">
            {[
              { num: 1, label: "Scope & Location" },
              { num: 2, label: "Land & Title" },
              { num: 3, label: "Architecture" },
              { num: 4, label: "Budget" },
              { num: 5, label: "Documents" },
              { num: 6, label: "AI Review" },
            ].map((s) => (
              <div
                key={s.num}
                className={`py-2 px-1 border-b-2 transition-all ${
                  step === s.num
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : step > s.num
                      ? "border-emerald-300 text-zinc-700"
                      : "border-zinc-200 text-zinc-400"
                }`}
              >
                <span className="hidden sm:inline">Step {s.num}: </span>
                {s.label}
              </div>
            ))}
          </div>

          {/* Wizard Body */}
          <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
            {/* STEP 1: Scope & Location */}
            {step === 1 && (
              <>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Step 1: Project Scope & Location
                  </CardTitle>
                  <CardDescription>
                    Provide project details and the site location in Kenya.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-2">
                      Project Title *
                    </label>
                    <Input
                      placeholder="e.g. 4-Bedroom Modern Villa in Karen"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-base"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Site County in Kenya *
                      </label>
                      <select
                        value={projectCounty}
                        onChange={(e) => setProjectCounty(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-white border border-zinc-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        {KENYAN_COUNTIES.map((c) => (
                          <option key={c} value={c}>
                            {c} County
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Project Category *
                      </label>
                      <select
                        value={projectType}
                        onChange={(e) => setProjectType(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-white border border-zinc-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        {PROJECT_TYPES.map((pt) => (
                          <option key={pt.id} value={pt.id}>
                            {pt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-zinc-800 mb-2">
                      Brief Description / Requirements
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe your vision, special requirements, floor count, or desired finishes..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleStep1Next}
                      disabled={createLeadMutation.isPending || !title.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {createLeadMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Next: Land Ownership <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* STEP 2: Land & Title Readiness */}
            {step === 2 && (
              <>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Step 2: Land Ownership & Title Verification (40% Factor
                    Weight)
                  </CardTitle>
                  <CardDescription>
                    Professionals prioritize projects with verified title deeds
                    and clear site ownership.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {LAND_STATUS_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          landStatus === opt.id
                            ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600"
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="landStatus"
                          value={opt.id}
                          checked={landStatus === opt.id}
                          onChange={() => setLandStatus(opt.id)}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-900 text-sm">
                              {opt.label}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {opt.score}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-between pt-6 border-t border-zinc-100">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={() => handleSaveQualificationStep(3)}
                      disabled={updateQualMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {updateQualMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Next: Architectural Stage{" "}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* STEP 3: Architectural Stage */}
            {step === 3 && (
              <>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Compass className="w-5 h-5 text-emerald-600" />
                    Step 3: Architectural & Engineering Readiness (25% Factor
                    Weight)
                  </CardTitle>
                  <CardDescription>
                    Tell us what designs or regulatory county approvals you have
                    in place.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {ARCHITECTURAL_STAGE_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          architecturalStage === opt.id
                            ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600"
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="architecturalStage"
                          value={opt.id}
                          checked={architecturalStage === opt.id}
                          onChange={() => setArchitecturalStage(opt.id)}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-zinc-900 text-sm">
                            {opt.label}
                          </span>
                          <p className="text-xs text-zinc-500 mt-1">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-between pt-6 border-t border-zinc-100">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={() => handleSaveQualificationStep(4)}
                      disabled={updateQualMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {updateQualMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Next: Budget & Funding <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* STEP 4: Budget & Funding */}
            {step === 4 && (
              <>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Coins className="w-5 h-5 text-emerald-600" />
                    Step 4: Budget & Financing Readiness (35% Factor Weight)
                  </CardTitle>
                  <CardDescription>
                    Define your funding model and target construction cost
                    range.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {BUDGET_READINESS_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                          budgetReadiness === opt.id
                            ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600"
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="budgetReadiness"
                          value={opt.id}
                          checked={budgetReadiness === opt.id}
                          onChange={() => setBudgetReadiness(opt.id)}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-zinc-900 text-sm">
                            {opt.label}
                          </span>
                          <p className="text-xs text-zinc-500 mt-1">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Target Budget Min (KES)
                      </label>
                      <Input
                        type="number"
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                        placeholder="5000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-800 mb-2">
                        Target Budget Max (KES)
                      </label>
                      <Input
                        type="number"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        placeholder="15000000"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-6 border-t border-zinc-100">
                    <Button variant="outline" onClick={() => setStep(3)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={() => handleSaveQualificationStep(5)}
                      disabled={updateQualMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {updateQualMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Next: Document Uploads <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* STEP 5: Document Uploads & Virus Scanning */}
            {step === 5 && (
              <>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Upload className="w-5 h-5 text-emerald-600" />
                    Step 5: Verification Document Uploads
                  </CardTitle>
                  <CardDescription>
                    Upload proof of land ownership, approved drawings, or bills
                    of quantities for instant verification and score boost.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border border-dashed border-zinc-300 p-4 text-center hover:border-emerald-500 transition-colors">
                      <FileCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <div className="font-semibold text-sm text-zinc-900">
                        Title Deed / Certificate
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 mb-3">
                        PDF or scanned copy (Freehold/Leasehold)
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSimulateDocUpload("TITLE_DEED")}
                        disabled={attachDocMutation.isPending}
                        className="w-full text-xs"
                      >
                        Upload Title Deed
                      </Button>
                    </Card>

                    <Card className="border border-dashed border-zinc-300 p-4 text-center hover:border-emerald-500 transition-colors">
                      <Compass className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <div className="font-semibold text-sm text-zinc-900">
                        Architectural Drawings
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 mb-3">
                        Plans, elevations or concept drawings
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleSimulateDocUpload("APPROVED_DRAWINGS")
                        }
                        disabled={attachDocMutation.isPending}
                        className="w-full text-xs"
                      >
                        Upload Drawings
                      </Button>
                    </Card>

                    <Card className="border border-dashed border-zinc-300 p-4 text-center hover:border-emerald-500 transition-colors">
                      <Coins className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <div className="font-semibold text-sm text-zinc-900">
                        Proof of Funds / BQ
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 mb-3">
                        Bank letter, savings or mortgage commitment
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleSimulateDocUpload("PROOF_OF_FUNDS")
                        }
                        disabled={attachDocMutation.isPending}
                        className="w-full text-xs"
                      >
                        Upload Proof of Funds
                      </Button>
                    </Card>
                  </div>

                  {/* Uploaded Documents List */}
                  {uploadedDocs.length > 0 && (
                    <div className="mt-6 border border-zinc-200 rounded-xl p-4 bg-zinc-50">
                      <h4 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        Uploaded Files ({uploadedDocs.length})
                      </h4>
                      <div className="space-y-2">
                        {uploadedDocs.map((doc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-zinc-200 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="font-medium text-zinc-800">
                                {doc.name}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {doc.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="bg-emerald-100 text-emerald-800 text-[10px]"
                              >
                                Scan: {doc.scanStatus}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-6 border-t border-zinc-100">
                    <Button variant="outline" onClick={() => setStep(4)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={() => setStep(6)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      Next: AI Score Review <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* STEP 6: AI Score Review & Final Submission */}
            {step === 6 && (
              <>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    Step 6: AI Readiness Score & Submission
                  </CardTitle>
                  <CardDescription>
                    Review your qualification evaluation and submit to be routed
                    to top-rated verified professionals.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Scorecard Hero */}
                  <div className="bg-linear-to-br from-emerald-50 via-teal-50 to-emerald-100/50 rounded-2xl p-6 border border-emerald-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                          Deterministic Lead Confidence
                        </span>
                        <h3 className="text-2xl font-bold text-zinc-900 mt-1">
                          {liveScore.confidenceLabel.toUpperCase()} READINESS
                          LEVEL
                        </h3>
                        <p className="text-xs text-zinc-600 mt-1">
                          Scored via Engine {liveScore.ruleVersion} across Kenya
                          construction benchmark rules.
                        </p>
                      </div>
                      <div className="text-center sm:text-right">
                        <span className="text-4xl font-extrabold text-emerald-700">
                          {Math.round(liveScore.confidenceScore * 100)}%
                        </span>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          Overall Readiness
                        </div>
                      </div>
                    </div>

                    {/* Factor Breakdown Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-emerald-200/60">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>Land Ownership (40%)</span>
                          <span>
                            {Math.round(
                              (liveScore.breakdown.landWeightedScore ?? 0) *
                                100,
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          value={(liveScore.breakdown.landScore ?? 0) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>Architecture (25%)</span>
                          <span>
                            {Math.round(
                              (liveScore.breakdown.archWeightedScore ?? 0) *
                                100,
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          value={(liveScore.breakdown.archScore ?? 0) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>Budget Readiness (35%)</span>
                          <span>
                            {Math.round(
                              (liveScore.breakdown.budgetWeightedScore ?? 0) *
                                100,
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          value={(liveScore.breakdown.budgetScore ?? 0) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Privacy Notice */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Privacy Protected: </span>
                      Your personal phone and email remain masked during initial
                      matching. Contact details are only disclosed to verified
                      professionals who review your project requirements and
                      explicitly accept the assignment.
                    </div>
                  </div>

                  <div className="flex justify-between pt-6 border-t border-zinc-100">
                    <Button variant="outline" onClick={() => setStep(5)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Documents
                    </Button>
                    <Button
                      onClick={handleFinalSubmit}
                      disabled={submitLeadMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 px-6"
                    >
                      {submitLeadMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Submit Project For Matching{" "}
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </main>
      </div>
      <Footer />
    </div>
  );
}
