import { scoreLeadV3 } from "@build/lead-qualification";
import { err, ok } from "@/app/lib/errors/result";
import { marketplaceLeadsRepository } from "./repository";
import {
  toClientLeadStatusDto,
  toDisclosedMarketplaceLeadDto,
  toMaskedMarketplaceLeadDto,
} from "./mappers";
import type {
  AttachMarketplaceLeadDocumentInput,
  ClientLeadStatusDTO,
  CreateMarketplaceLeadInput,
  DisclosedMarketplaceLeadDTO,
  MarketplaceLeadResult,
  MaskedMarketplaceLeadDTO,
  UpdateMarketplaceLeadQualificationInput,
} from "./contracts";

export const marketplaceLeadsService = {
  async createDraftLead(
    clientId: string,
    input: CreateMarketplaceLeadInput,
  ): Promise<MarketplaceLeadResult<ClientLeadStatusDTO>> {
    try {
      const lead = await marketplaceLeadsRepository.createLead(clientId, input);

      return ok(
        toClientLeadStatusDto(lead, null, {
          documentCount: 0,
          routingCount: 0,
        }),
      );
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to create draft lead",
        details: error,
      });
    }
  },

  async updateQualification(
    clientId: string,
    leadId: string,
    input: UpdateMarketplaceLeadQualificationInput,
  ): Promise<MarketplaceLeadResult<ClientLeadStatusDTO>> {
    try {
      const lead = await marketplaceLeadsRepository.findLeadForClient(
        leadId,
        clientId,
      );

      if (!lead) {
        return err({
          error: "not_found",
          message: "Lead not found or access denied",
        });
      }

      if (lead.status !== "DRAFT" && lead.status !== "NEEDS_INFO") {
        return err({
          error: "invalid_state",
          message: `Cannot update qualification in status ${lead.status}`,
        });
      }

      const qual = await marketplaceLeadsRepository.upsertQualification(
        leadId,
        input,
      );

      return ok(
        toClientLeadStatusDto(lead, {
          landOwnershipStatus: qual.landOwnershipStatus,
          architecturalStage: qual.architecturalStage,
          budgetReadiness: qual.budgetReadiness,
          budgetRangeMin: qual.budgetRangeMin,
          budgetRangeMax: qual.budgetRangeMax,
          confidenceScore: qual.confidenceScore,
          confidenceLabel: qual.confidenceLabel,
        }),
      );
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to update lead qualification",
        details: error,
      });
    }
  },

  async attachDocument(
    clientId: string,
    leadId: string,
    input: AttachMarketplaceLeadDocumentInput,
  ): Promise<
    MarketplaceLeadResult<{ documentId: string; scanStatus: string }>
  > {
    try {
      const lead = await marketplaceLeadsRepository.findLeadForClient(
        leadId,
        clientId,
      );

      if (!lead) {
        return err({
          error: "not_found",
          message: "Lead not found or access denied",
        });
      }

      const doc = await marketplaceLeadsRepository.attachDocument(
        leadId,
        input.type,
        input.fileKey,
      );

      return ok({
        documentId: doc.id,
        scanStatus: doc.scanStatus,
      });
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to attach lead document",
        details: error,
      });
    }
  },

  async submitLeadForQualification(
    clientId: string,
    leadId: string,
  ): Promise<MarketplaceLeadResult<ClientLeadStatusDTO>> {
    try {
      const lead = await marketplaceLeadsRepository.findLeadForClient(
        leadId,
        clientId,
      );

      if (!lead) {
        return err({
          error: "not_found",
          message: "Lead not found or access denied",
        });
      }

      if (lead.status !== "DRAFT" && lead.status !== "NEEDS_INFO") {
        return err({
          error: "invalid_state",
          message: `Lead cannot be submitted from status ${lead.status}`,
        });
      }

      // Execute deterministic score engine
      const hasVerifiedDocs = lead.documents.some(
        (d) => d.scanStatus === "clean",
      );

      const scoreResult = scoreLeadV3({
        landOwnershipStatus: lead.qualification?.landOwnershipStatus,
        landOwnershipVerified: hasVerifiedDocs,
        architecturalStage: lead.qualification?.architecturalStage,
        budgetReadiness: lead.qualification?.budgetReadiness,
        budgetRangeMin: lead.qualification?.budgetRangeMin,
        budgetRangeMax: lead.qualification?.budgetRangeMax,
        projectType: lead.projectType,
      });

      // Update scored qualification
      const scoredQual =
        await marketplaceLeadsRepository.updateScoredQualification(leadId, {
          confidenceScore: scoreResult.confidenceScore,
          confidenceLabel: scoreResult.confidenceLabel,
          scoringRuleVersion: scoreResult.ruleVersion,
          breakdownJson: scoreResult.breakdown as any,
          scoredAt: new Date(),
        });

      // Determine next status: QUALIFIED if score >= 0.45 or UNDER_REVIEW if low/needs review
      const nextStatus =
        scoreResult.confidenceScore >= 0.45 ? "QUALIFIED" : "UNDER_REVIEW";

      const updatedLead = await marketplaceLeadsRepository.updateLead(leadId, {
        status: nextStatus,
      });

      return ok(
        toClientLeadStatusDto(
          updatedLead,
          {
            landOwnershipStatus: scoredQual.landOwnershipStatus,
            architecturalStage: scoredQual.architecturalStage,
            budgetReadiness: scoredQual.budgetReadiness,
            budgetRangeMin: scoredQual.budgetRangeMin,
            budgetRangeMax: scoredQual.budgetRangeMax,
            confidenceScore: scoredQual.confidenceScore,
            confidenceLabel: scoredQual.confidenceLabel,
          },
          {
            documentCount: updatedLead.documents.length,
            routingCount: lead.routingEvents.length,
          },
        ),
      );
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to submit lead for qualification",
        details: error,
      });
    }
  },

  async getClientLeadStatus(
    clientId: string,
    leadId: string,
  ): Promise<MarketplaceLeadResult<ClientLeadStatusDTO>> {
    try {
      const lead = await marketplaceLeadsRepository.findLeadForClient(
        leadId,
        clientId,
      );

      if (!lead) {
        return err({
          error: "not_found",
          message: "Lead not found or access denied",
        });
      }

      return ok(toClientLeadStatusDto(lead));
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to get lead status",
        details: error,
      });
    }
  },

  async listClientLeads(
    clientId: string,
  ): Promise<MarketplaceLeadResult<ClientLeadStatusDTO[]>> {
    try {
      const leads =
        await marketplaceLeadsRepository.listLeadsForClient(clientId);

      const items = leads.map((lead) => toClientLeadStatusDto(lead));

      return ok(items);
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to list client leads",
        details: error,
      });
    }
  },

  async listMaskedLeadsForProfessional(
    professionalId: string,
  ): Promise<MarketplaceLeadResult<MaskedMarketplaceLeadDTO[]>> {
    try {
      const events =
        await marketplaceLeadsRepository.listRoutingEventsForProfessional(
          professionalId,
        );

      const items = events.map((ev) => toMaskedMarketplaceLeadDto(ev));

      return ok(items);
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to list routed leads",
        details: error,
      });
    }
  },

  async acceptRoutedLead(
    professionalId: string,
    routingEventId: string,
  ): Promise<MarketplaceLeadResult<DisclosedMarketplaceLeadDTO>> {
    try {
      const acceptedEvent = await marketplaceLeadsRepository.acceptRoutingEvent(
        routingEventId,
        professionalId,
      );

      if (!acceptedEvent) {
        return err({
          error: "not_found",
          message: "Routing event not found or unauthorized",
        });
      }

      const fullRecord =
        await marketplaceLeadsRepository.findRoutingEventWithDisclosedLead(
          routingEventId,
          professionalId,
        );

      if (!fullRecord) {
        return err({
          error: "internal",
          message: "Failed to retrieve disclosed lead details",
        });
      }

      return ok(toDisclosedMarketplaceLeadDto(fullRecord));
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to accept routed lead",
        details: error,
      });
    }
  },

  async declineRoutedLead(
    professionalId: string,
    routingEventId: string,
  ): Promise<MarketplaceLeadResult<{ success: true }>> {
    try {
      await marketplaceLeadsRepository.declineRoutingEvent(
        routingEventId,
        professionalId,
      );
      return ok({ success: true });
    } catch (error) {
      return err({
        error: "internal",
        message: "Failed to decline lead",
        details: error,
      });
    }
  },
};
