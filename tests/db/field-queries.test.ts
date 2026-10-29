import { beforeAll, describe, expect, it } from "vitest";
import { FIELD_OCCURRENCE_SELECT } from "@/server/field-queries";
import { addMembership, createClientWithSite, createUser, today, uid, type TestUser } from "./helpers";

let admin: TestUser;
let foreman: TestUser;
let siteId: string;

beforeAll(async () => {
  [admin, foreman] = await Promise.all([createUser("admin", "Admin Consultas"), createUser("foreman", "Encarregado Consultas")]);
  siteId = (await createClientWithSite("Consultas")).site.id;
  await addMembership(foreman.id, siteId);
});

describe("consultas da tela de tarefa do campo", () => {
  it("encarregado abre a ocorrência da tarefa (sem embed ambíguo)", async () => {
    const created = await admin.db.rpc("task_create", {
      p_title: "Vistoria consultas",
      p_occurrences: [{ site_id: siteId }],
      p_assignee_ids: [foreman.id],
      p_scheduled_date: today(),
      p_client_request_id: uid(),
    });
    expect(created.error).toBeNull();
    const { data: occ } = await foreman.db.from("task_occurrences").select("id").eq("site_id", siteId).limit(1).single();
    const { data, error } = await foreman.db.from("task_occurrences").select(FIELD_OCCURRENCE_SELECT).eq("id", occ!.id).maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(occ!.id);
  });
});
