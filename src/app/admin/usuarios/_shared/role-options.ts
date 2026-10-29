import { STAFF_ROLES } from "@/domain/registry";
import { ROLE_LABEL } from "@/server/auth";

/** Papéis que a administração pode atribuir (nunca "client" enquanto o login do cliente estiver pendente). */
export const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));
