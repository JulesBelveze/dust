import type { ConnectorNode } from "@dust-tt/types";

import {
  fetchIntercomTeam,
  fetchIntercomTeams,
  getIntercomClient,
} from "@connectors/connectors/intercom/lib/intercom_api";
import {
  getTeamInternalId,
  getTeamsInternalId,
} from "@connectors/connectors/intercom/lib/utils";
import type { ConnectorPermissionRetriever } from "@connectors/connectors/interface";
import { IntercomTeam } from "@connectors/lib/models/intercom";
import logger from "@connectors/logger/logger";
import { ConnectorModel } from "@connectors/resources/storage/models/connector_model";

export async function allowSyncTeam({
  connector,
  teamId,
}: {
  connector: ConnectorModel;
  teamId: string;
}): Promise<IntercomTeam> {
  let team = await IntercomTeam.findOne({
    where: {
      connectorId: connector.id,
      teamId: teamId,
    },
  });
  if (team?.permission === "none") {
    await team.update({
      permission: "read",
    });
  }
  if (!team) {
    const teamOnIntercom = await fetchIntercomTeam(
      connector.connectionId,
      teamId
    );
    if (teamOnIntercom) {
      team = await IntercomTeam.create({
        connectorId: connector.id,
        teamId: teamOnIntercom.id,
        name: teamOnIntercom.name,
        permission: "read",
      });
    }
  }

  if (!team) {
    logger.error(
      { connector, teamId },
      "[Intercom] Failed to sync team. Team not found."
    );
    throw new Error("Team not found.");
  }

  return team;
}

export async function revokeSyncTeam({
  connector,
  teamId,
}: {
  connector: ConnectorModel;
  teamId: string;
}): Promise<IntercomTeam | null> {
  const team = await IntercomTeam.findOne({
    where: {
      connectorId: connector.id,
      teamId: teamId,
    },
  });
  if (team?.permission === "read") {
    await team.update({
      permission: "none",
    });
  }
  return team;
}

export async function retrieveIntercomConversationsPermissions({
  connectorId,
  parentInternalId,
  filterPermission,
}: Parameters<ConnectorPermissionRetriever>[0]): Promise<ConnectorNode[]> {
  const connector = await ConnectorModel.findByPk(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Intercom] Connector not found.");
    throw new Error("Connector not found");
  }

  const intercomClient = await getIntercomClient(connector.connectionId);
  const isReadPermissionsOnly = filterPermission === "read";
  const isRootLevel = !parentInternalId;
  const teamsInternalId = getTeamsInternalId(connectorId);
  const nodes: ConnectorNode[] = [];

  const rootConversationNode: ConnectorNode = {
    provider: "intercom",
    internalId: teamsInternalId,
    parentInternalId: null,
    type: "channel",
    title: "Conversations",
    sourceUrl: null,
    expandable: true,
    preventSelection: true,
    permission: "none",
    dustDocumentId: null,
    lastUpdatedAt: null,
  };

  const teamsWithReadPermission = await IntercomTeam.findAll({
    where: {
      connectorId: connectorId,
      permission: "read",
    },
  });

  // If Root level we display the fake parent "Conversations"
  // If isReadPermissionsOnly = true, we retrieve the list of Teams from DB that have permission = "read"
  // If isReadPermissionsOnly = false, we retrieve the list of Teams from Intercom
  if (isReadPermissionsOnly) {
    if (isRootLevel && teamsWithReadPermission.length > 0) {
      nodes.push(rootConversationNode);
    }
    if (parentInternalId === teamsInternalId) {
      teamsWithReadPermission.forEach((team) => {
        nodes.push({
          provider: connector.type,
          internalId: getTeamInternalId(connectorId, team.teamId),
          parentInternalId: teamsInternalId,
          type: "folder",
          title: team.name,
          sourceUrl: null,
          expandable: false,
          permission: team.permission,
          dustDocumentId: null,
          lastUpdatedAt: null,
        });
      });
    }
  } else {
    if (isRootLevel) {
      nodes.push(rootConversationNode);
    }
    if (parentInternalId === teamsInternalId) {
      const teams = await fetchIntercomTeams(intercomClient);
      teams.forEach((team) => {
        const isTeamInDb = teamsWithReadPermission.some((teamFromDb) => {
          return teamFromDb.teamId === team.id;
        });
        nodes.push({
          provider: connector.type,
          internalId: getTeamInternalId(connectorId, team.id),
          parentInternalId: teamsInternalId,
          type: "folder",
          title: team.name,
          sourceUrl: null,
          expandable: false,
          permission: isTeamInDb ? "read" : "none",
          dustDocumentId: null,
          lastUpdatedAt: null,
        });
      });
    }
  }
  nodes.sort((a, b) => {
    return a.title.localeCompare(b.title);
  });

  return nodes;
}
