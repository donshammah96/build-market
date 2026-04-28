type OnboardingViewport = {
  label: "desktop" | "mobile";
  width: number;
  height: number;
};

const VIEWPORTS: OnboardingViewport[] = [
  { label: "desktop", width: 1366, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];

const ONBOARDING_READY_PROBE_COMMAND = `node -e "const http=require('http');const target='http://localhost:3500/onboarding';const max=15;const delay=3000;const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));(async()=>{for(let i=1;i<=max;i++){const ok=await new Promise((resolve)=>{const req=http.get(target,(res)=>{res.resume();resolve((res.statusCode||500)<500);});req.setTimeout(15000,()=>{req.destroy();resolve(false);});req.on('error',()=>resolve(false));});if(ok){process.exit(0);}await sleep(delay);}process.exit(1);})();"`;

function waitForOnboardingHttpReady() {
  cy.exec(ONBOARDING_READY_PROBE_COMMAND, {
    timeout: 180_000,
    failOnNonZeroExit: true,
    log: false,
  });
}

function dismissCookieBannerIfPresent() {
  cy.get("body").then(($body) => {
    if ($body.text().includes("Reject All")) {
      cy.contains("button", "Reject All").click({ force: true });
    }
  });
}

function visitAndCapture(
  stepLabel: string,
  url: string,
  headingText: string,
  viewport: OnboardingViewport,
) {
  cy.viewport(viewport.width, viewport.height);
  cy.mockClerkAuth();
  cy.mockOnboardingApi();
  waitForOnboardingHttpReady();

  cy.visit(url, {
    timeout: 180_000,
    retryOnNetworkFailure: true,
    retryOnStatusCodeFailure: true,
    onBeforeLoad(win) {
      (win as { __clerk_frontend_api?: string }).__clerk_frontend_api = "test";
    },
  });
  cy.contains("h1", headingText, { timeout: 20000 }).should("be.visible");

  dismissCookieBannerIfPresent();
  cy.wait(800);

  cy.screenshot(
    `onboarding-${stepLabel}-${viewport.label}-${viewport.width}x${viewport.height}`,
    {
      capture: "fullPage",
    },
  );
}

describe("Onboarding visual verification", () => {
  it("captures role selection for desktop and mobile", () => {
    VIEWPORTS.forEach((viewport) => {
      visitAndCapture(
        "role-select",
        "/onboarding",
        "Build your legacy.",
        viewport,
      );
    });
  });

  it("captures homeowner details step for desktop and mobile", () => {
    VIEWPORTS.forEach((viewport) => {
      visitAndCapture(
        "homeowner-details",
        "/onboarding?role=client&step=2",
        "Tell us about your dream.",
        viewport,
      );
      cy.contains("Your County").should("be.visible");
      cy.contains("Project Type").should("be.visible");
    });
  });

  it("captures professional details step for desktop and mobile", () => {
    VIEWPORTS.forEach((viewport) => {
      visitAndCapture(
        "professional-details",
        "/onboarding?role=professional&step=2",
        "Showcase your expertise.",
        viewport,
      );
      cy.contains("What do you do?").should("be.visible");
      cy.contains("Search All Professions").should("be.visible");
    });
  });
});
