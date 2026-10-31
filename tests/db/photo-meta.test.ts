import { beforeAll, describe, expect, it } from "vitest";
import { formatDateTimeBR } from "@/domain/dates";
import { loadPhotos } from "@/server/data";
import { addMembership, createClientWithSite, createUser, fakePhoto, serviceClient, today, uid, type TestUser } from "./helpers";

/** R-40: a equipe vê quem enviou cada foto e quando. */

let admin: TestUser;
let worker: TestUser;
let siteId: string;

async function entryWithPhoto(user: TestUser) {
  const photo = await fakePhoto(user, siteId);
  const { data, error } = await user.db.rpc("work_entry_create", {
    p_client_request_id: uid(),
    p_site_id: siteId,
    p_activity_date: today(),
    p_description: "Limpeza de calhas (fictício)",
    p_photo_ids: [photo.id],
  });
  if (error) throw error;
  return { entryId: data.id, photo };
}

beforeAll(async () => {
  [admin, worker] = await Promise.all([createUser("admin", "Admin Foto"), createUser("worker", "Marta Fotógrafa")]);
  siteId = (await createClientWithSite("FotoMeta")).site.id;
  await addMembership(worker.id, siteId);
});

describe("autor e hora da foto", () => {
  it("loadPhotos traz autor e hora do envio", async () => {
    const { entryId, photo } = await entryWithPhoto(worker);
    const photos = await loadPhotos(admin.db, "work_entry", [entryId]);
    const { data } = await serviceClient().from("attachments").select("uploaded_at").eq("id", photo.id).single();
    expect(photos.get(entryId)?.[0]?.meta).toBe(`Marta Fotógrafa · ${formatDateTimeBR(data!.uploaded_at)}`);
  });

  it("pessoa sem nome legível mostra só a data", async () => {
    const { entryId, photo } = await entryWithPhoto(admin);
    const photos = await loadPhotos(worker.db, "work_entry", [entryId]);
    const { data } = await serviceClient().from("attachments").select("uploaded_at").eq("id", photo.id).single();
    const meta = photos.get(entryId)?.[0]?.meta ?? "";
    expect(meta.endsWith(formatDateTimeBR(data!.uploaded_at))).toBe(true);
  });
});
