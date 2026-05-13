import prisma from "../prisma";


export const createLog = async ({
  action,
  entity,
  entityId,
  description,
  userId,
}: {
  action: string;
  entity: string;
  entityId: number;
  description: string;
  userId: number;
}) => {
  return prisma.activityLog.create({
    data: {
      action,
      entity,
      entityId,
      description,
      user: {
        connect: { id: userId },  // ← connecte l'utilisateur existant
      },
    },
  });
};