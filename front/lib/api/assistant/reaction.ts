import { Authenticator } from "@app/lib/auth";
import { Message, MessageReaction } from "@app/lib/models";
import {
  ConversationMessageReactions,
  ConversationType,
  ConversationWithoutContentType,
  MessageReactionType,
} from "@app/types/assistant/conversation";
import { UserType } from "@app/types/user";

/**
 * We retrieve the reactions for a whole conversation, not just a single message.
 */
export async function getMessageReactions(
  auth: Authenticator,
  conversation: ConversationType | ConversationWithoutContentType
): Promise<ConversationMessageReactions> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }

  const messages = await Message.findAll({
    where: {
      conversationId: conversation.id,
    },
    include: [
      {
        model: MessageReaction,
        as: "reactions",
        required: false,
      },
    ],
  });

  return messages.map((m) => ({
    messageId: m.sId,
    reactions: _renderMessageReactions(m.reactions || []),
  }));
}

function _renderMessageReactions(
  reactions: MessageReaction[]
): MessageReactionType[] {
  return reactions.reduce<MessageReactionType[]>(
    (acc: MessageReactionType[], r: MessageReaction) => {
      const reaction = acc.find((r2) => r2.emoji === r.reaction);
      if (reaction) {
        reaction.users.push({
          userId: r.userId,
          username: r.userContextUsername,
          fullName: r.userContextFullName,
        });
      } else {
        acc.push({
          emoji: r.reaction,
          users: [
            {
              userId: r.userId,
              username: r.userContextUsername,
              fullName: r.userContextFullName,
            },
          ],
        });
      }
      return acc;
    },
    []
  );
}

/**
 * We create a reaction for a single message.
 * As user can be null (user from Slack), we also store the user context, as we do for messages.
 */
export async function createMessageReaction(
  auth: Authenticator,
  {
    messageId,
    conversation,
    user,
    context,
    reaction,
  }: {
    messageId: string;
    conversation: ConversationType | ConversationWithoutContentType;
    user: UserType | null;
    context: {
      username: string;
      fullName: string | null;
    };
    reaction: string;
  }
): Promise<boolean | null> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }

  const message = await Message.findOne({
    where: {
      sId: messageId,
      conversationId: conversation.id,
    },
  });

  if (!message) {
    return null;
  }

  const newReaction = await MessageReaction.create({
    messageId: message.id,
    userId: user ? user.id : null,
    userContextUsername: context.username,
    userContextFullName: context.fullName,
    reaction,
  });
  return newReaction !== null;
}

/**
 * The id of a reaction is not exposed on the API so we need to find it from the message id and the user context.
 * We destroy reactions, no point in soft-deleting them.
 */
export async function deleteMessageReaction(
  auth: Authenticator,
  {
    messageId,
    conversation,
    user,
    context,
    reaction,
  }: {
    messageId: string;
    conversation: ConversationType | ConversationWithoutContentType;
    user: UserType | null;
    context: {
      username: string;
      fullName: string | null;
    };
    reaction: string;
  }
): Promise<boolean | null> {
  const owner = auth.workspace();
  if (!owner) {
    throw new Error("Unexpected `auth` without `workspace`.");
  }

  const message = await Message.findOne({
    where: {
      sId: messageId,
      conversationId: conversation.id,
    },
  });

  if (!message) {
    return null;
  }

  const deletedReaction = await MessageReaction.destroy({
    where: {
      messageId: message.id,
      userId: user ? user.id : null,
      userContextUsername: context.username,
      userContextFullName: context.fullName,
      reaction,
    },
  });
  return deletedReaction === 1;
}
