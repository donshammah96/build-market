type DashboardProfession =
  "GENERAL_CONTRACTOR" | "HARDWARE" | "REAL_ESTATE_AGENT";

function mockDashboardApis(profession: DashboardProfession) {
  cy.intercept("GET", "**/api/user/profile", {
    statusCode: 200,
    body: {
      data: {
        user: {
          id: "user-1",
          clerkId: "clerk_1",
          email: "qa@example.com",
          firstName: "QA",
          lastName: "User",
          phone: "+254700000000",
          avatar: null,
          role: "professional",
          isProfileComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        profile: {
          userId: "user-1",
          companyName: "Build Market QA",
          profession,
          licenseNumber: "LIC-123",
          yearsExperience: 7,
          servicesOffered: ["construction"],
          portfolioUrl: null,
          website: null,
          bio: "QA profile",
          city: "Nairobi",
          county: "Nairobi",
          country: "Kenya",
          verified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        completion: {
          percentage: 100,
          isComplete: true,
          missingRequired: [],
          missingRequiredLabels: [],
          missingOptional: [],
          filledFields: ["companyName", "profession"],
        },
      },
    },
  }).as("profileStatus");

  cy.intercept("GET", "**/api/professional-portal/dashboard/metrics*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        totalRevenue: 9200000,
        activeLeads: 12,
        activeProjects: 6,
        clientRating: 4.8,
        totalSales: 13200000,
        pendingOrders: 14,
        totalProducts: 148,
        storeViews: 18340,
        activeListings: 9,
        propertyInquiries: 21,
        propertyViews: 1400,
        closings: 3,
      },
    },
  }).as("dashboardMetrics");

  cy.intercept("GET", "**/api/professional-portal/calendar*", {
    statusCode: 200,
    body: {
      success: true,
      data: [
        {
          id: "event-1",
          title: "Client Site Visit",
          startDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          status: "scheduled",
        },
      ],
    },
  }).as("calendar");

  cy.intercept("GET", "**/api/professional-portal/leads*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        leads: [
          {
            id: "lead-1",
            clientName: "Pamela Njeru",
            projectType: "kitchen_renovation",
            budget: "450000",
            location: "Westlands",
            status: "NEW",
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "lead-2",
            clientName: "Don Shammah",
            projectType: "office_fitout",
            budget: "2100000",
            location: "Mombasa Road",
            status: "PROPOSAL",
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "lead-3",
            clientName: "Terry Wanjiru",
            projectType: "bathroom_upgrade",
            budget: "280000",
            location: "Kilimani",
            status: "LOST",
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
    },
  }).as("leads");

  cy.intercept("GET", "**/api/projects*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        items: [
          {
            id: "project-1",
            title: "Karen Villa Build",
            status: "IN_PROGRESS",
            endDate: new Date(
              Date.now() + 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            startDate: new Date(
              Date.now() - 10 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            createdAt: new Date().toISOString(),
            client: {
              id: "client-project-1",
              firstName: "Njeri",
              lastName: "Family",
              email: "njeri@example.com",
            },
          },
          {
            id: "project-2",
            title: "CBD Office Retrofit",
            status: "ON_HOLD",
            endDate: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            startDate: new Date(
              Date.now() - 14 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            createdAt: new Date().toISOString(),
            client: {
              id: "client-project-2",
              firstName: "Sifa",
              lastName: "Logistics",
              email: "sifa@example.com",
            },
          },
        ],
      },
    },
  }).as("projects");

  cy.intercept("GET", "**/api/professional-portal/portfolio*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        portfolios: [
          {
            id: "portfolio-1",
            title: "Modern Living Room Finish",
            images: [
              "https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=640&q=80",
            ],
            projectType: "interior_design",
          },
          {
            id: "portfolio-2",
            title: "Commercial Interior Lighting",
            images: [
              "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=640&q=80",
            ],
            projectType: "commercial",
          },
          {
            id: "portfolio-3",
            title: "Stonework Exterior Entry",
            images: [
              "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640&q=80",
            ],
            projectType: "exterior",
          },
          {
            id: "portfolio-4",
            title: "Bathroom Marble Upgrade",
            images: [
              "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=640&q=80",
            ],
            projectType: "bathroom",
          },
        ],
      },
    },
  }).as("portfolio");

  cy.intercept("GET", "**/api/stores/me*", {
    statusCode: 200,
    body: {
      success: true,
      data: [
        {
          id: "store-1",
          name: "BuildPro Supplies",
          totalProducts: 148,
          totalOrders: 396,
          pendingOrders: 12,
          totalRevenue: 9230000,
          views: 18240,
        },
      ],
    },
  }).as("stores");

  cy.intercept("GET", "**/api/professional-portal/orders*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        items: [
          {
            id: "ord-1",
            customerName: "Evannas Construction",
            items: 5,
            total: 189000,
            status: "pending",
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "ord-2",
            customerName: "Shammah Interiors",
            items: 2,
            total: 72000,
            status: "processing",
            createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
    },
  }).as("orders");

  cy.intercept("GET", "**/api/professional-portal/inventory/alerts*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        data: [
          {
            id: "prod-1",
            productId: "prod-1",
            productName: "Roofing Sheets 3m",
            currentStock: 4,
            threshold: 8,
            status: "low_stock",
          },
          {
            id: "prod-2",
            productId: "prod-2",
            productName: "Tile Adhesive 20kg",
            currentStock: 0,
            threshold: 6,
            status: "out_of_stock",
          },
        ],
      },
    },
  }).as("inventoryAlerts");

  cy.intercept("GET", "**/api/professional-portal/products/top*", {
    statusCode: 200,
    body: {
      success: true,
      data: [
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
      ],
    },
  }).as("topProducts");

  cy.intercept("GET", "**/api/properties/my-listings*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        properties: [
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
        ],
      },
    },
  }).as("properties");

  cy.intercept("GET", "**/api/notifications*", {
    statusCode: 200,
    body: {
      success: true,
      data: [],
    },
  }).as("notifications");

  cy.intercept("GET", "**/api/professional-portal/inquiries*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        data: [
          {
            id: "inq-1",
            property: { title: "4 Bedroom Maisonette" },
            clientName: "Don Nyareso",
            clientPhone: "+254711111111",
            message: "Is this still available?",
            status: "NEW",
            createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          },
        ],
      },
    },
  }).as("propertyInquiries");

  cy.intercept("GET", "**/api/professional-portal/pipeline*", {
    statusCode: 200,
    body: {
      success: true,
      data: {
        stages: [
          { id: "viewing", count: 7, value: 24000000 },
          { id: "offer", count: 3, value: 10300000 },
          { id: "closing", count: 2, value: 7200000 },
        ],
        totalValue: 41500000,
      },
    },
  }).as("pipeline");
}

function visitAndCapturePro(
  profession: DashboardProfession,
  viewport: { width: number; height: number },
  label: string,
) {
  cy.viewport(viewport.width, viewport.height);
  mockDashboardApis(profession);

  cy.visit("/professional-portal/dashboard");
  cy.wait(["@profileStatus", "@dashboardMetrics", "@calendar"]);
  cy.get("main", { timeout: 20000 })
    .contains(/^Overview$/)
    .should("be.visible");
  cy.get("body").then(($body) => {
    if ($body.text().includes("Reject All")) {
      cy.contains("button", "Reject All").click({ force: true });
    }
  });
  cy.wait(800);
  cy.screenshot(
    `professional-dashboard-${label}-${viewport.width}x${viewport.height}`,
    {
      capture: "fullPage",
    },
  );
}

describe("Professional Dashboard visual verification", () => {
  it("captures desktop and small-mobile for service-provider widgets", () => {
    visitAndCapturePro(
      "GENERAL_CONTRACTOR",
      { width: 1366, height: 1024 },
      "service-provider-desktop",
    );
    visitAndCapturePro(
      "GENERAL_CONTRACTOR",
      { width: 390, height: 844 },
      "service-provider-mobile",
    );
  });

  it("captures desktop and small-mobile for seller-store widgets", () => {
    visitAndCapturePro(
      "HARDWARE",
      { width: 1366, height: 1024 },
      "seller-store-desktop",
    );
    visitAndCapturePro(
      "HARDWARE",
      { width: 390, height: 844 },
      "seller-store-mobile",
    );
  });

  it("captures desktop and small-mobile for seller-property widgets", () => {
    visitAndCapturePro(
      "REAL_ESTATE_AGENT",
      { width: 1366, height: 1024 },
      "seller-property-desktop",
    );
    visitAndCapturePro(
      "REAL_ESTATE_AGENT",
      { width: 390, height: 844 },
      "seller-property-mobile",
    );
  });
});
