import React from "react";
import { ListingsWidget } from "@/components/dashboard/widgets/seller-property/ListingsWidget";
import { PipelineWidget } from "@/components/dashboard/widgets/seller-property/PipelineWidget";
import { InventoryAlertsWidget } from "@/components/dashboard/widgets/seller-store/InventoryAlertsWidget";
import { OrdersWidget } from "@/components/dashboard/widgets/seller-store/OrdersWidget";
import { ProductsWidget } from "@/components/dashboard/widgets/seller-store/ProductsWidget";
import { StoreOverviewWidget } from "@/components/dashboard/widgets/seller-store/StoreOverviewWidget";
import { LeadsWidget } from "@/components/dashboard/widgets/service-provider/LeadsWidget";
import { PortfolioWidget } from "@/components/dashboard/widgets/service-provider/PortfolioWidget";
import { ProjectsWidget } from "@/components/dashboard/widgets/service-provider/ProjectsWidget";

function DashboardWidgetsVisualHarness() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[1440px] space-y-8">
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Service Provider
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <LeadsWidget
                leads={[
                  {
                    id: "lead-1",
                    name: "Pamela Njeru",
                    project: "Kitchen Renovation",
                    budget: "KSh 450,000",
                    location: "Westlands, Nairobi",
                    status: "new",
                    receivedAt: "2h ago",
                  },
                  {
                    id: "lead-2",
                    name: "Don Shammah",
                    project: "Office Fit-out",
                    budget: "KSh 2,100,000",
                    location: "Mombasa Road, Nairobi",
                    status: "proposal",
                    receivedAt: "5h ago",
                  },
                  {
                    id: "lead-3",
                    name: "Terry Wanjiru",
                    project: "Bathroom Upgrade",
                    budget: "KSh 280,000",
                    location: "Kilimani, Nairobi",
                    status: "lost",
                    receivedAt: "1d ago",
                  },
                ]}
              />
            </div>
            <PortfolioWidget
              items={[
                {
                  id: "port-1",
                  title: "Modern Living Room Finish",
                  imageUrl:
                    "https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=640&q=80",
                },
                {
                  id: "port-2",
                  title: "Commercial Interior Lighting",
                  imageUrl:
                    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=640&q=80",
                },
                {
                  id: "port-3",
                  title: "Stonework Exterior Entry",
                  imageUrl:
                    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640&q=80",
                },
                {
                  id: "port-4",
                  title: "Bathroom Marble Upgrade",
                  imageUrl:
                    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=640&q=80",
                },
                {
                  id: "port-5",
                  title: "Roofing Project",
                  imageUrl:
                    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=640&q=80",
                },
              ]}
            />
          </div>
          <ProjectsWidget
            projects={[
              {
                id: "proj-1",
                title: "Karen Villa Build",
                client: "Shammah Family",
                progress: 74,
                status: "on_track",
                dueDate: "Apr 16",
              },
              {
                id: "proj-2",
                title: "CBD Office Retrofit",
                client: "Evannas Logistics",
                progress: 52,
                status: "attention",
                dueDate: "Apr 03",
              },
            ]}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Seller Store
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <StoreOverviewWidget
              store={{
                id: "store-1",
                name: "BuildPro Supplies",
                totalProducts: 148,
                totalOrders: 396,
                pendingOrders: 12,
                totalRevenue: 9230000,
                views: 18240,
              }}
            />
            <OrdersWidget
              orders={[
                {
                  id: "ord-1",
                  customerName: "Nyareso Construction",
                  items: 5,
                  total: 189000,
                  status: "pending",
                  createdAt: new Date(
                    Date.now() - 2 * 60 * 60 * 1000,
                  ).toISOString(),
                },
                {
                  id: "ord-2",
                  customerName: "Shammah Interiors",
                  items: 2,
                  total: 72000,
                  status: "processing",
                  createdAt: new Date(
                    Date.now() - 7 * 60 * 60 * 1000,
                  ).toISOString(),
                },
              ]}
            />
            <div className="space-y-6">
              <ProductsWidget
                products={[
                  {
                    id: "prod-1",
                    name: "Cement Grade 42.5",
                    price: 1450,
                    soldCount: 320,
                    revenue: 464000,
                    imageUrl:
                      "https://images.unsplash.com/photo-1596704017254-9a06bd6ce9c7?w=300&q=80",
                  },
                  {
                    id: "prod-2",
                    name: "Rebar 16mm",
                    price: 2100,
                    soldCount: 148,
                    revenue: 310800,
                  },
                ]}
              />
              <InventoryAlertsWidget
                alerts={[
                  {
                    id: "prod-1",
                    productName: "Roofing Sheets 3m",
                    slug: "roofing-sheets-3m",
                    sku: "RS3M-001",
                    currentStock: 4,
                    threshold: 8,
                    status: "low_stock",
                    store: { id: "store-1", name: "BuildPro Supplies" },
                  },
                  {
                    id: "prod-2",
                    productName: "Tile Adhesive 20kg",
                    slug: "tile-adhesive-20kg",
                    sku: "TA20-002",
                    currentStock: 0,
                    threshold: 6,
                    status: "out_of_stock",
                    store: { id: "store-1", name: "BuildPro Supplies" },
                  },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Seller Property
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ListingsWidget
                properties={[
                  {
                    id: "property-1",
                    title: "4 Bedroom Maisonette",
                    price: 28500000,
                    location: "Runda, Nairobi",
                    type: "house",
                    status: "active",
                    views: 126,
                    inquiries: 9,
                    images: [
                      "https://images.unsplash.com/photo-1600607687644-c7f34b5063ec?w=640&q=80",
                    ],
                  },
                  {
                    id: "property-2",
                    title: "2 Bedroom Apartment",
                    price: 12000000,
                    location: "Kileleshwa, Nairobi",
                    type: "apartment",
                    status: "pending",
                    views: 94,
                    inquiries: 6,
                    images: [
                      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=640&q=80",
                    ],
                  },
                ]}
              />
            </div>
            <PipelineWidget
              totalValue={41500000}
              stages={[
                {
                  id: "viewing",
                  label: "Viewings Scheduled",
                  count: 7,
                  value: 24000000,
                  icon: () => null,
                  color: "text-primary bg-primary/10",
                },
                {
                  id: "offer",
                  label: "Offers Pending",
                  count: 3,
                  value: 10300000,
                  icon: () => null,
                  color: "text-muted-foreground bg-muted",
                },
                {
                  id: "closing",
                  label: "Ready to Close",
                  count: 2,
                  value: 7200000,
                  icon: () => null,
                  color: "text-accent-foreground bg-accent",
                },
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

describe("Dashboard widgets visual verification", () => {
  it("captures desktop layout", () => {
    cy.viewport(1366, 1024);
    cy.mount(<DashboardWidgetsVisualHarness />);
    cy.wait(500);
    cy.screenshot("dashboard-widgets-desktop-1366x1024", {
      capture: "fullPage",
    });
  });

  it("captures small-mobile layout", () => {
    cy.viewport(390, 844);
    cy.mount(<DashboardWidgetsVisualHarness />);
    cy.wait(500);
    cy.screenshot("dashboard-widgets-mobile-390x844", {
      capture: "fullPage",
    });
  });
});
