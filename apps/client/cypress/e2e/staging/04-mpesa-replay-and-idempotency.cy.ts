describe("Staging E2E: M-Pesa STK Replay and Idempotency Flow", () => {
  beforeEach(() => {
    cy.initStagingRun("mpesa-replay", "cypress-mpesa-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("processes STK callback once and deduplicates replay safely", () => {
    // 1. Seed pending M-Pesa transaction bound to this run
    cy.seedStagingMpesa({
      amount: 100,
      phoneNumber: "254708374149",
    }).then((seedResult) => {
      const checkoutRequestId = seedResult.checkoutRequestId;
      const merchantRequestId = seedResult.merchantRequestId;

      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: merchantRequestId,
            CheckoutRequestID: checkoutRequestId,
            ResultCode: 0,
            ResultDesc: "The service request is processed successfully.",
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 100 },
                { Name: "MpesaReceiptNumber", Value: `NLX${Date.now().toString().slice(-7)}` },
                { Name: "TransactionDate", Value: 20260903070000 },
                { Name: "PhoneNumber", Value: 254708374149 },
              ],
            },
          },
        },
      };

      // 2. Post callback first time (initial settlement processing)
      cy.request({
        method: "POST",
        url: "/api/webhooks/mpesa/stk-callback",
        body: callbackPayload,
        failOnStatusCode: false,
      }).then((firstRes) => {
        expect([200, 202]).to.include(firstRes.status);
      });

      // 3. Post duplicate callback (idempotent replay)
      cy.request({
        method: "POST",
        url: "/api/webhooks/mpesa/stk-callback",
        body: callbackPayload,
        failOnStatusCode: false,
      }).then((replayRes) => {
        expect(replayRes.status).to.eq(202);
      });

      // 4. Verify projection: the event is owned by this run and replay did
      // not create a second durable callback record.
      cy.getStagingProjection().then((proj) => {
        expect(proj.fixtures.mpesaTransactions).to.have.length(1);
        expect(proj.fixtures.mpesaCallbackEvents).to.have.length(1);
        expect(proj.fixtures.mpesaCallbackEvents[0].processingStatus).to.be.oneOf([
          "RECEIVED",
          "PROCESSED",
        ]);
      });
    });
  });
});
