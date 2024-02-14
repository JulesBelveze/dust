import type {
  ConnectorNode,
  ConnectorPermission,
  ConnectorsAPIError,
  ModelId,
  Result,
} from "@dust-tt/types";
import { Op } from "sequelize";

import {
  allowSyncTeam,
  retrieveIntercomConversationsPermissions,
  revokeSyncTeam,
} from "@connectors/connectors/intercom/lib/conversation_permissions";
import {
  allowSyncCollection,
  allowSyncHelpCenter,
  retrieveIntercomHelpCentersPermissions,
  revokeSyncCollection,
  revokeSyncHelpCenter,
} from "@connectors/connectors/intercom/lib/help_center_permissions";
import {
  fetchIntercomWorkspace,
  getIntercomClient,
} from "@connectors/connectors/intercom/lib/intercom_api";
import {
  getHelpCenterArticleIdFromInternalId,
  getHelpCenterArticleInternalId,
  getHelpCenterCollectionIdFromInternalId,
  getHelpCenterCollectionInternalId,
  getHelpCenterIdFromInternalId,
  getHelpCenterInternalId,
  getTeamIdFromInternalId,
  getTeamInternalId,
} from "@connectors/connectors/intercom/lib/utils";
import {
  launchIntercomSyncWorkflow,
  stopIntercomSyncWorkflow,
} from "@connectors/connectors/intercom/temporal/client";
import type { ConnectorPermissionRetriever } from "@connectors/connectors/interface";
import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import {
  IntercomArticle,
  IntercomCollection,
  IntercomConversation,
  IntercomHelpCenter,
  IntercomTeam,
  IntercomWorkspace,
} from "@connectors/lib/models/intercom";
import { nangoDeleteConnection } from "@connectors/lib/nango_client";
import { Err, Ok } from "@connectors/lib/result";
import logger from "@connectors/logger/logger";
import { sequelizeConnection } from "@connectors/resources/storage";
import { ConnectorModel } from "@connectors/resources/storage/models/connector_model";
import type { DataSourceConfig } from "@connectors/types/data_source_config";
import type { NangoConnectionId } from "@connectors/types/nango_connection_id";

const { NANGO_INTERCOM_CONNECTOR_ID } = process.env;

export async function createIntercomConnector(
  dataSourceConfig: DataSourceConfig,
  connectionId: NangoConnectionId
): Promise<Result<string, Error>> {
  const nangoConnectionId = connectionId;

  if (!NANGO_INTERCOM_CONNECTOR_ID) {
    throw new Error("NANGO_INTERCOM_CONNECTOR_ID not set");
  }

  try {
    const connector = await ConnectorModel.create({
      type: "intercom",
      connectionId: nangoConnectionId,
      workspaceAPIKey: dataSourceConfig.workspaceAPIKey,
      workspaceId: dataSourceConfig.workspaceId,
      dataSourceName: dataSourceConfig.dataSourceName,
    });

    const intercomWorkspace = await fetchIntercomWorkspace(nangoConnectionId);

    if (!intercomWorkspace) {
      return new Err(new Error("Error retrieving intercom workspace"));
    }

    await IntercomWorkspace.create({
      connectorId: connector.id,
      intercomWorkspaceId: intercomWorkspace.id,
      name: intercomWorkspace.name,
      conversationsSlidingWindow: 90,
    });

    const workflowStarted = await launchIntercomSyncWorkflow(
      connector.id,
      null
    );
    if (workflowStarted.isErr()) {
      return new Err(workflowStarted.error);
    }
    return new Ok(connector.id.toString());
  } catch (e) {
    logger.error({ error: e }, "[Intercom] Error creating connector.");
    return new Err(e as Error);
  }
}

export async function updateIntercomConnector(
  connectorId: ModelId,
  {
    connectionId,
  }: {
    connectionId?: NangoConnectionId | null;
  }
): Promise<Result<string, ConnectorsAPIError>> {
  if (!NANGO_INTERCOM_CONNECTOR_ID) {
    throw new Error("NANGO_INTERCOM_CONNECTOR_ID not set");
  }

  const connector = await ConnectorModel.findByPk(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Intercom] Connector not found.");
    return new Err({
      message: "Connector not found",
      type: "connector_not_found",
    });
  }

  const intercomWorkspace = await IntercomWorkspace.findOne({
    where: { connectorId: connector.id },
  });

  if (!intercomWorkspace) {
    return new Err({
      type: "connector_update_error",
      message: "Error retrieving intercom workspace to update connector",
    });
  }

  if (connectionId) {
    const oldConnectionId = connector.connectionId;
    const newConnectionId = connectionId;
    const newIntercomWorkspace = await fetchIntercomWorkspace(newConnectionId);

    if (!newIntercomWorkspace) {
      return new Err({
        type: "connector_update_error",
        message: "Error retrieving nango connection info to update connector",
      });
    }
    if (intercomWorkspace.intercomWorkspaceId !== newIntercomWorkspace.id) {
      nangoDeleteConnection(newConnectionId, NANGO_INTERCOM_CONNECTOR_ID).catch(
        (e) => {
          logger.error(
            { error: e, connectorId },
            "Error deleting old Nango connection"
          );
        }
      );
      return new Err({
        type: "connector_oauth_target_mismatch",
        message: "Cannot change workspace of a Intercom connector",
      });
    }

    await connector.update({
      connectionId: newConnectionId,
    });
    await IntercomWorkspace.update(
      {
        intercomWorkspaceId: newIntercomWorkspace.id,
        name: newIntercomWorkspace.name,
      },
      {
        where: { connectorId: connector.id },
      }
    );
    nangoDeleteConnection(oldConnectionId, NANGO_INTERCOM_CONNECTOR_ID).catch(
      (e) => {
        logger.error(
          { error: e, connectorId, oldConnectionId },
          "Error deleting old Nango connection"
        );
      }
    );
  }
  return new Ok(connector.id.toString());
}

export async function cleanupIntercomConnector(
  connectorId: ModelId
): Promise<Result<undefined, Error>> {
  if (!NANGO_INTERCOM_CONNECTOR_ID) {
    throw new Error("INTERCOM_NANGO_CONNECTOR_ID not set");
  }

  const connector = await ConnectorModel.findOne({
    where: { type: "intercom", id: connectorId },
  });
  if (!connector) {
    logger.error({ connectorId }, "Intercom connector not found.");
    return new Err(new Error("Connector not found"));
  }

  await sequelizeConnection.transaction(async (transaction) => {
    await Promise.all([
      IntercomWorkspace.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction: transaction,
      }),
      IntercomHelpCenter.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction: transaction,
      }),
      IntercomCollection.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction: transaction,
      }),
      IntercomArticle.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction: transaction,
      }),
      IntercomTeam.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction: transaction,
      }),
      IntercomConversation.destroy({
        where: {
          connectorId: connector.id,
        },
        transaction: transaction,
      }),
      connector.destroy({
        transaction: transaction,
      }),
    ]);
  });

  const nangoRes = await nangoDeleteConnection(
    connector.connectionId,
    NANGO_INTERCOM_CONNECTOR_ID
  );
  if (nangoRes.isErr()) {
    throw nangoRes.error;
  }

  return new Ok(undefined);
}

export async function stopIntercomConnector(
  connectorId: ModelId
): Promise<Result<undefined, Error>> {
  const res = await stopIntercomSyncWorkflow(connectorId);
  if (res.isErr()) {
    return res;
  }

  return new Ok(undefined);
}

export async function resumeIntercomConnector(
  connectorId: ModelId
): Promise<Result<undefined, Error>> {
  const connector = await ConnectorModel.findByPk(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Intercom] Connector not found.");
    return new Err(new Error("Connector not found"));
  }

  const dataSourceConfig = dataSourceConfigFromConnector(connector);
  try {
    await launchIntercomSyncWorkflow(connector.id, null);
  } catch (e) {
    logger.error(
      {
        workspaceId: dataSourceConfig.workspaceId,
        dataSourceName: dataSourceConfig.dataSourceName,
        error: e,
      },
      "Error launching Intercom sync workflow."
    );
  }

  return new Ok(undefined);
}

export async function retrieveIntercomConnectorPermissions({
  connectorId,
  parentInternalId,
  filterPermission,
}: Parameters<ConnectorPermissionRetriever>[0]): Promise<
  Result<ConnectorNode[], Error>
> {
  const connector = await ConnectorModel.findByPk(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Intercom] Connector not found.");
    return new Err(new Error("Connector not found"));
  }

  try {
    const helpCenterNodes = await retrieveIntercomHelpCentersPermissions({
      connectorId,
      parentInternalId,
      filterPermission,
    });
    const convosNodes = await retrieveIntercomConversationsPermissions({
      connectorId,
      parentInternalId,
      filterPermission,
    });
    const nodes = [...helpCenterNodes, ...convosNodes];
    return new Ok(nodes);
  } catch (e) {
    return new Err(e as Error);
  }
}

export async function setIntercomConnectorPermissions(
  connectorId: ModelId,
  permissions: Record<string, ConnectorPermission>
): Promise<Result<void, Error>> {
  const connector = await ConnectorModel.findByPk(connectorId);
  if (!connector) {
    logger.error({ connectorId }, "[Intercom] Connector not found.");
    return new Err(new Error("Connector not found"));
  }

  const intercomClient = await getIntercomClient(connector.connectionId);
  const toBeSignaledHelpCenterIds = new Set<string>();
  const toBeSignaledTeamIds = new Set<string>();

  try {
    for (const [id, permission] of Object.entries(permissions)) {
      if (permission !== "none" && permission !== "read") {
        return new Err(
          new Error(
            `Invalid permission ${permission} for connector ${connectorId}`
          )
        );
      }

      const helpCenterId = getHelpCenterIdFromInternalId(connectorId, id);
      const collectionId = getHelpCenterCollectionIdFromInternalId(
        connectorId,
        id
      );
      const teamId = getTeamIdFromInternalId(connectorId, id);

      if (helpCenterId) {
        toBeSignaledHelpCenterIds.add(helpCenterId);
        if (permission === "none") {
          await revokeSyncHelpCenter({
            connector,
            helpCenterId,
          });
        }
        if (permission === "read") {
          await allowSyncHelpCenter({
            connector,
            intercomClient,
            helpCenterId,
            withChildren: true,
          });
        }
      } else if (collectionId) {
        if (permission === "none") {
          const revokedCollection = await revokeSyncCollection({
            connector,
            collectionId,
          });
          if (revokedCollection) {
            toBeSignaledHelpCenterIds.add(revokedCollection.helpCenterId);
          }
        }
        if (permission === "read") {
          const newCollection = await allowSyncCollection({
            connector,
            intercomClient,
            collectionId,
          });
          if (newCollection) {
            toBeSignaledHelpCenterIds.add(newCollection.helpCenterId);
          }
        }
      } else if (teamId) {
        if (permission === "none") {
          const revokedTeam = await revokeSyncTeam({
            connector,
            teamId,
          });
          if (revokedTeam) {
            toBeSignaledTeamIds.add(revokedTeam.teamId);
          }
        }
        if (permission === "read") {
          const newTeam = await allowSyncTeam({
            connector,
            teamId,
          });
          if (newTeam) {
            toBeSignaledTeamIds.add(newTeam.teamId);
          }
        }
      }
    }

    if (toBeSignaledHelpCenterIds.size > 0 || toBeSignaledTeamIds.size > 0) {
      const sendSignalToWorkflowResult = await launchIntercomSyncWorkflow(
        connectorId,
        null,
        [...toBeSignaledHelpCenterIds],
        [...toBeSignaledTeamIds]
      );
      if (sendSignalToWorkflowResult.isErr()) {
        return new Err(sendSignalToWorkflowResult.error);
      }
    }

    return new Ok(undefined);
  } catch (e) {
    logger.error(
      {
        connectorId: connectorId,
        error: e,
      },
      "Error setting connector permissions."
    );
    return new Err(new Error("Error setting permissions"));
  }
}

export async function retrieveIntercomNodesTitles(
  connectorId: ModelId,
  internalIds: string[]
): Promise<Result<Record<string, string | null>, Error>> {
  const helpCenterIds: string[] = [];
  const collectionIds: string[] = [];
  const articleIds: string[] = [];
  const teamIds: string[] = [];

  internalIds.forEach((internalId) => {
    let objectId = getHelpCenterIdFromInternalId(connectorId, internalId);
    if (objectId) {
      helpCenterIds.push(objectId);
      return;
    }
    objectId = getHelpCenterCollectionIdFromInternalId(connectorId, internalId);
    if (objectId) {
      collectionIds.push(objectId);
      return;
    }
    objectId = getHelpCenterArticleIdFromInternalId(connectorId, internalId);
    if (objectId) {
      articleIds.push(objectId);
      return;
    }
    objectId = getTeamIdFromInternalId(connectorId, internalId);
    if (objectId) {
      teamIds.push(objectId);
    }
  });

  const [helpCenters, collections, articles, teams] = await Promise.all([
    IntercomHelpCenter.findAll({
      where: {
        connectorId: connectorId,
        helpCenterId: { [Op.in]: helpCenterIds },
      },
    }),
    IntercomCollection.findAll({
      where: {
        connectorId: connectorId,
        collectionId: { [Op.in]: collectionIds },
      },
    }),
    IntercomArticle.findAll({
      where: {
        connectorId: connectorId,
        articleId: { [Op.in]: articleIds },
      },
    }),
    IntercomTeam.findAll({
      where: {
        connectorId: connectorId,
        teamId: { [Op.in]: teamIds },
      },
    }),
  ]);

  const titles: Record<string, string> = {};
  for (const helpCenter of helpCenters) {
    const helpCenterInternalId = getHelpCenterInternalId(
      connectorId,
      helpCenter.helpCenterId
    );
    titles[helpCenterInternalId] = helpCenter.name;
  }
  for (const collection of collections) {
    const collectionInternalId = getHelpCenterCollectionInternalId(
      connectorId,
      collection.collectionId
    );
    titles[collectionInternalId] = collection.name;
  }
  for (const article of articles) {
    const articleInternalId = getHelpCenterArticleInternalId(
      connectorId,
      article.articleId
    );
    titles[articleInternalId] = article.title;
  }
  for (const team of teams) {
    const teamInternalId = getTeamInternalId(connectorId, team.teamId);
    titles[teamInternalId] = team.name;
  }

  return new Ok(titles);
}

export async function retrieveIntercomObjectsParents(
  connectorId: ModelId,
  internalId: string
): Promise<Result<string[], Error>> {
  // No parent for Help Center & Team
  const helpCenterId = getHelpCenterIdFromInternalId(connectorId, internalId);
  if (helpCenterId) {
    return new Ok([]);
  }
  const teamId = getTeamIdFromInternalId(connectorId, internalId);
  if (teamId) {
    return new Ok([]);
  }

  const parents: string[] = [];
  let collection = null;

  const collectionId = getHelpCenterCollectionIdFromInternalId(
    connectorId,
    internalId
  );
  const articleId = getHelpCenterArticleIdFromInternalId(
    connectorId,
    internalId
  );

  if (collectionId) {
    collection = await IntercomCollection.findOne({
      where: {
        connectorId,
        collectionId,
      },
    });
  } else if (articleId) {
    const article = await IntercomArticle.findOne({
      where: {
        connectorId,
        articleId,
      },
    });
    if (article && article.parentType === "collection" && article.parentId) {
      parents.push(
        getHelpCenterCollectionInternalId(connectorId, article.parentId)
      );
      collection = await IntercomCollection.findOne({
        where: {
          connectorId: connectorId,
          collectionId: article.parentId,
        },
      });
    }
  }

  if (collection && collection.parentId) {
    parents.push(
      getHelpCenterCollectionInternalId(connectorId, collection.parentId)
    );
    const parentCollection = await IntercomCollection.findOne({
      where: {
        connectorId: connectorId,
        collectionId: collection.parentId,
      },
    });
    if (parentCollection && parentCollection.parentId) {
      parents.push(
        getHelpCenterCollectionInternalId(
          connectorId,
          parentCollection.parentId
        )
      );
    }
    // we can stop here as Intercom has max 3 levels of collections
  }

  if (collection && collection.helpCenterId) {
    parents.push(getHelpCenterInternalId(connectorId, collection.helpCenterId));
  }

  return new Ok(parents);
}
